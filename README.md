# Funding Request Workflow

> **Disclaimer**: This is a **fictional use case**, intentionally non-production-ready and not secured (no authentication, no real persistence, simplified mocks). It was created solely to illustrate the capabilities of [Temporal](https://temporal.io/).

A **Temporal** + **Fastify** application that orchestrates the end-to-end processing of funding requests — document verification, fraud detection, and human validation — as a durable workflow.

The project follows **hexagonal architecture** (ports & adapters): the HTTP layer and the Temporal infrastructure are fully decoupled via an application port.

## Architecture

```
┌─────────────────────────────────────────────────────┐
│  Fastify REST API                                    │
│  POST /funding-requests          → create request   │
│  GET  /funding-requests          → list all          │
│  GET  /funding-requests/pending-validation           │
│  GET  /funding-requests/:id      → get details       │
│  POST /funding-requests/:id/validate  → validate     │
│  POST /funding-requests/:id/documents → update docs  │
└──────────────────────────┬──────────────────────────┘
                           │ IFundingRequestService (port)
┌──────────────────────────▼──────────────────────────┐
│  TemporalFundingRequestService (adapter)             │
└──────────────────────────┬──────────────────────────┘
                           │ Temporal Client
┌──────────────────────────▼──────────────────────────┐
│  Temporal Server  (localhost:7233)                   │
└──────────────────────────┬──────────────────────────┘
                           │ Task Queue: funding-requests
┌──────────────────────────▼──────────────────────────┐
│  Temporal Worker                                     │
│  Workflow: fundingRequestWorkflow                    │
│  Activities: checkFraud, checkDocuments, emails…     │
└─────────────────────────────────────────────────────┘
```

Routes depend only on `IFundingRequestService` — they have no knowledge of Temporal signals, queries, or workflow IDs.

## Hexagonal structure

```
src/
├── domain/
│   ├── FundingRequest.ts           # Entities, types, status enum
│   └── constants.ts                # Business rules (required docs, thresholds)
│
├── application/
│   └── ports/
│       └── IFundingRequestService.ts   # Inbound port: create, getById, listAll,
│                                       # listPendingValidation, validate, updateDocuments
│
└── infrastructure/
    ├── temporal/
    │   ├── TemporalFundingRequestService.ts  # Port implementation via Temporal SDK
    │   ├── workflows.ts                      # fundingRequestWorkflow
    │   ├── activities/                       # checkFraud, checkDocuments, emails…
    │   ├── workflowConstants.ts              # Task queue, signal/query names
    │   ├── client.ts                         # Temporal client singleton
    │   └── worker.ts                         # Worker entry point
    └── http/
        ├── server.ts                         # Composition root — wires service into Fastify
        └── routes/
            ├── createFundingRequest.ts
            ├── listFundingRequests.ts
            ├── pendingValidation.ts
            ├── getFundingRequest.ts
            ├── validateFundingRequest.ts
            └── updateDocuments.ts
```

**Dependency rule:** all arrows point inward. `domain/` imports nothing. `application/ports/` imports only from `domain/`. Routes import only the port interface — never the Temporal SDK.

## Workflow steps

```
INITIATED
  │
  ▼
CHECKING_DOCUMENTS ──(incomplete)──► WAITING_DOCUMENTS
  │                                        │
  │  ◄──── documentsUpdated signal ────────┘
  │        (or daily reminder × 6, then ABANDONED after 7 days)
  ▼
CHECKING_FRAUD ──(fraud)──► REJECTED
  │
  ▼
amount > €500 ? ──yes──► PENDING_VALIDATION ──► APPROVED / REJECTED
  │
  └──no──► APPROVED (automatic)
```

| State | Description |
|---|---|
| `INITIATED` | Workflow started |
| `CHECKING_DOCUMENTS` | Verifying document completeness |
| `WAITING_DOCUMENTS` | Suspended — waiting for applicant to upload missing docs |
| `CHECKING_FRAUD` | Calling the fraud detection API |
| `PENDING_VALIDATION` | Suspended — waiting for a human decision |
| `APPROVED` | Request approved |
| `REJECTED` | Rejected (fraud or human decision) |
| `ABANDONED` | No documents received within 7 days |

## Prerequisites

- **Node.js** ≥ 20
- **Docker** (for the Temporal server)

## Getting started

### 1. Start the Temporal server

```bash
docker compose up
```

The Temporal UI is available at <http://localhost:8080>.

### 2. Install dependencies

```bash
pnpm install
```

### 3. Configure environment

```bash
cp .env.example .env
```

| Variable | Default | Description |
|---|---|---|
| `TEMPORAL_ADDRESS` | `localhost:7233` | Temporal gRPC address |
| `TEMPORAL_NAMESPACE` | `default` | Temporal namespace |
| `TASK_QUEUE` | `funding-requests` | Worker task queue name |
| `API_PORT` | `3000` | Fastify listen port |

### 4. Start the worker and the API

```bash
# Both in parallel
pnpm start

# Or separately
pnpm start:worker
pnpm start:api
```

## API reference

### List all requests

```bash
GET /funding-requests
```

Returns all workflows (running and recently completed).

**Response 200**

```json
[
  {
    "id": "uuid",
    "userId": "string",
    "userEmail": "string",
    "amount": 1500,
    "purpose": "string",
    "documents": ["identity", "income_proof", "bank_statement"],
    "status": "APPROVED",
    "rejectionReason": null
  }
]
```

---

### Create a funding request

```bash
POST /funding-requests
```

```json
{
  "userId": "user-42",
  "userEmail": "alice@example.com",
  "amount": 1500,
  "purpose": "Equipment purchase",
  "documents": ["identity", "income_proof", "bank_statement"]
}
```

Required documents: `identity`, `income_proof`, `bank_statement`.
Requests with **amount > €500** require human validation.

**Response 201**

```json
{
  "id": "uuid",
  "status": "INITIATED",
  "message": "Request created and workflow started."
}
```

---

### Get request status

```bash
GET /funding-requests/:id
```

---

### List requests pending validation

```bash
GET /funding-requests/pending-validation
```

---

### Approve or reject a request

```bash
POST /funding-requests/:id/validate
```

```json
{
  "approved": true,
  "validatorId": "validator-1",
  "reason": "All checks passed"
}
```

---

### Upload missing documents

```bash
POST /funding-requests/:id/documents
```

```json
{
  "documents": ["identity", "income_proof", "bank_statement"]
}
```

Only accepted when the request is in `WAITING_DOCUMENTS` state.

## Scripts

The `scripts/` directory contains shell helpers that call the API (require `curl` and `jq`):

| Script | Description |
|---|---|
| `seed.sh` | Creates 6 test requests covering all workflow branches |
| `list-requests.sh` | Lists all requests via `GET /funding-requests` |
| `list-pending-validation.sh` | Lists requests awaiting human validation |
| `approve-request.sh <id> <validatorId> [reason]` | Approves a request |
| `reject-request.sh <id> <validatorId> <reason>` | Rejects a request |
| `submit-documents.sh <id>` | Submits complete documents for a waiting request |

All scripts accept an optional `BASE_URL` argument (default: `http://localhost:3000`).

## Development

```bash
# Type-check without emitting
pnpm typecheck

# Compile to dist/
pnpm build
```

## Mocks

| Component | Behaviour |
|---|---|
| Fraud detection API | Amounts divisible by 13 are flagged as fraudulent |
| Email sending | Emails are printed to the console |
