# PRD — Funding Request Processing Workflow

**Version**: 0.1 (draft)
**Date**: 2026-04-07
**Status**: In progress

---

## 1. Context and objective

### 1.1 Context

The company processes funding requests submitted by users. This process involves several sequential steps: supporting document collection, fraud detection, and human review for high-value amounts. Today this process is handled manually or through brittle systems with no execution guarantees.

### 1.2 Objective

Automate and harden the funding request processing pipeline using a durable workflow engine (Temporal), exposed through a REST API. The system must guarantee that no request is lost, every step is auditable, and human interventions are correctly orchestrated.

### 1.3 Non-goals (out of scope for v1)

- User-facing front-end interface
- Authentication and role management (IAM)
- Dedicated relational database for business data
- Real-time notifications (WebSocket, SSE)
- Production SLAs and alerting

---

## 2. Target users

| Persona             | Description                                                           | Primary interactions                          |
| ------------------- | --------------------------------------------------------------------- | --------------------------------------------- |
| **Applicant**       | End user who submits a funding request                                | Create a request, update supporting documents |
| **Validator**       | Internal agent responsible for approving or rejecting requests > €500 | View pending requests, submit a decision      |
| **External system** | Third-party fraud detection API                                       | Called automatically by the workflow          |

---

## 3. Functional requirements

### 3.1 Request creation

**FR-01** — The API must allow submitting a funding request with the following fields:

- `userId`: user identifier (required)
- `userEmail`: user email address (required)
- `amount`: requested amount in euros, positive number (required)
- `purpose`: purpose of the request (required)
- `documents`: list of provided supporting document codes (optional, array)

**FR-02** — On creation, a unique request identifier (`id`) and a Temporal `workflowId` must be returned.

### 3.2 Supporting document verification

**FR-04** — The workflow must check document completeness at startup. Required documents are:

- `identity`: government-issued ID
- `income_proof`: proof of income
- `bank_statement`: bank statement

**FR-05** — If documents are missing, the workflow must:

1. Transition to the `WAITING_DOCUMENTS` state
2. Send an email to `userEmail` listing the missing documents
3. Suspend execution and wait up to 24 hours for the applicant to provide the missing documents

**FR-05a** — If the applicant does not respond within 24 hours, the workflow must send a new reminder email and restart the 24-hour wait. This cycle repeats for a maximum of **7 days (7 reminder emails)**.

**FR-05b** — If the applicant has not provided the missing documents after 7 days, the request transitions to the `ABANDONED` state and the workflow terminates. A final notification email is sent to inform the applicant.

**FR-06** — The API must allow the applicant to submit updated documents (`POST /funding-requests/:id/documents`). This action cancels the current wait timer and resumes workflow execution immediately.

**FR-07** — Document updates are only accepted when the request is in the `WAITING_DOCUMENTS` state. Any other state must return a `409 Conflict` error.

### 3.3 Fraud detection

**FR-08** — After document validation, the workflow must call an external fraud detection API (mocked in v1).

**FR-09** — If the request is flagged as fraudulent, the request transitions to `REJECTED` with the reason `"Fraud detected"` and the workflow terminates.

**FR-10** — If the fraud API fails (network error, timeout), the system must automatically retry up to 3 times with exponential backoff before propagating the error.

### 3.4 Human validation

**FR-11** — Any request with an amount **strictly greater than €500** requires human approval before being accepted.

**FR-12** — The workflow must transition to `PENDING_VALIDATION` and suspend execution until a decision signal is received.

**FR-13** — The API must allow listing all requests awaiting human validation (`GET /funding-requests/pending-validation`).

**FR-14** — The API must allow approving or rejecting a request (`POST /funding-requests/:id/validate`) with:

- `approved`: `true` (approve) or `false` (reject), required
- `validatorId`: validator identifier, required
- `reason`: rejection reason (optional, recommended when `approved: false`)

**FR-15** — The validation action is only accepted when the request is in the `PENDING_VALIDATION` state. Any other state must return a `409 Conflict` error.

### 3.5 Automatic approval

**FR-16** — For requests with an amount **less than or equal to €500**, after a successful fraud check, the request is automatically approved (`APPROVED` state) without human intervention.

### 3.6 Request consultation

**FR-17** — The API must allow querying the state and details of a request at any time (`GET /funding-requests/:id`), whether it is in progress or completed.

**FR-18** — The response must include: `id`, `userId`, `userEmail`, `amount`, `purpose`, `documents`, `status`, `rejectionReason` (when rejected).

---

## 4. Workflow states

```
INITIATED
    │
    ▼
CHECKING_DOCUMENTS ──(incomplete)──▶ WAITING_DOCUMENTS ◀─────────────────────┐
    │                                       │                                  │
    │                         ┌────────────┴─────────────┐                    │
    │                         │                           │                    │
    │               documentsUpdated signal       24h elapsed, < 7 days        │
    │                         │                           │                    │
    │◀────────────────────────┘               send reminder email ─────────────┘
    │
    │                         7 days elapsed, no response
    │◀────────────────────────────────────────────────────── ABANDONED
    ▼
CHECKING_FRAUD ──(fraud detected)──▶ REJECTED
    │
    ▼
amount > €500 ?
    │ yes
    ▼
PENDING_VALIDATION ──(rejected)──▶ REJECTED
    │ approved
    ▼
APPROVED
    │
    ▼ (amount ≤ €500, no fraud)
APPROVED (automatic)
```

| State                | Description                                                          |
| -------------------- | -------------------------------------------------------------------- |
| `INITIATED`          | Request created, workflow started                                    |
| `CHECKING_DOCUMENTS` | Document completeness check in progress                              |
| `WAITING_DOCUMENTS`  | Suspended, waiting for the applicant to upload missing documents     |
| `CHECKING_FRAUD`     | Fraud detection check in progress                                    |
| `PENDING_VALIDATION` | Suspended, waiting for a human decision                              |
| `APPROVED`           | Request approved                                                     |
| `REJECTED`           | Request rejected (fraud or human decision)                           |
| `ABANDONED`          | Request abandoned after 7 days without a response from the applicant |

---

## 5. REST API contract

### `POST /funding-requests`

Creates a new funding request and starts the workflow.

**Request body**

```json
{
  "userId": "string",
  "userEmail": "string (email)",
  "amount": "number (> 0)",
  "purpose": "string",
  "documents": ["identity", "income_proof", "bank_statement"]
}
```

**Response 201**

```json
{
  "id": "uuid",
  "workflowId": "funding-request-<uuid>",
  "status": "INITIATED",
  "message": "Request created and workflow started."
}
```

---

### `GET /funding-requests/pending-validation`

Lists all requests in the `PENDING_VALIDATION` state.

**Response 200**

```json
[
  {
    "workflowId": "funding-request-<uuid>",
    "startTime": "ISO8601",
    "id": "uuid",
    "userId": "string",
    "userEmail": "string",
    "amount": 1500,
    "purpose": "string",
    "status": "PENDING_VALIDATION"
  }
]
```

---

### `GET /funding-requests/:id`

Returns the details of a request.

**Response 200**

```json
{
  "workflowId": "funding-request-<uuid>",
  "id": "uuid",
  "userId": "string",
  "userEmail": "string",
  "amount": 1500,
  "purpose": "string",
  "documents": ["identity", "income_proof"],
  "status": "PENDING_VALIDATION",
  "rejectionReason": null
}
```

**Response 404** — Request not found.

---

### `POST /funding-requests/:id/validate`

Approves or rejects a request awaiting human validation.

**Request body**

```json
{
  "approved": true,
  "validatorId": "string",
  "reason": "string (optional, recommended when approved=false)"
}
```

**Response 200**

```json
{
  "id": "uuid",
  "workflowId": "string",
  "decision": "APPROVED",
  "message": "Decision submitted to the workflow."
}
```

**Response 409** — Request is not in `PENDING_VALIDATION` state.

---

### `POST /funding-requests/:id/documents`

Updates the supporting documents for a suspended request.

**Request body**

```json
{
  "documents": ["identity", "income_proof", "bank_statement"]
}
```

**Response 200**

```json
{
  "id": "uuid",
  "workflowId": "string",
  "message": "Documents updated, processing resumed."
}
```

**Response 409** — Request is not in `WAITING_DOCUMENTS` state.

---

## 6. Non-functional requirements

| ID     | Requirement                                                                                   | v1 level                            |
| ------ | --------------------------------------------------------------------------------------------- | ----------------------------------- |
| NFR-01 | **Durability** — An in-progress request must not be lost on service restart                   | Guaranteed by Temporal              |
| NFR-02 | **Idempotency** — Starting the same workflow twice with the same `workflowId` must be a no-op | Guaranteed by Temporal              |
| NFR-03 | **Observability** — Every workflow step must be visible in the Temporal UI                    | Guaranteed by Temporal              |
| NFR-04 | **Automatic retry** — Failed activities must be retried automatically                         | Configured (3 attempts, backoff ×2) |
| NFR-05 | **API latency** — Routes must respond in < 500 ms excluding Temporal I/O                      | To be measured                      |
| NFR-06 | **Scalability** — The worker must be deployable as multiple instances                         | Supported by Temporal               |

---

## 7. Technical dependencies

| Component           | Technology         | Version           |
| ------------------- | ------------------ | ----------------- |
| Workflow engine     | Temporal Server    | latest (dev mode) |
| Runtime             | Node.js            | ≥ 20              |
| Temporal SDK        | `@temporalio/*`    | ^1.11.0           |
| REST API            | Fastify            | ^4.28             |
| Fraud detection API | Internal stub (v1) | —                 |
| Email               | Console stub (v1)  | —                 |
