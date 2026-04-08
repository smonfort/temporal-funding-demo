import {
  condition,
  defineQuery,
  defineSignal,
  log,
  proxyActivities,
  setHandler,
} from '@temporalio/workflow';

// Import activity types only — the workflow sandbox must not execute activity code
import type * as activitiesTypes from './activities/index';
import type {
  DocumentsUpdate,
  FundingRequest,
  FundingRequestDetails,
  FundingRequestStatus,
  ValidationDecision,
  WorkflowResult,
} from '../../domain/FundingRequest';
import { DOCUMENT_WAIT_DAYS, HUMAN_VALIDATION_THRESHOLD } from '../../domain/constants';

// Activities are resolved by the worker — timeout and retry policy configured here
const {
  checkFraud,
  checkDocumentsCompleteness,
  sendMissingDocumentsEmail,
  sendReminderEmail,
  sendAbandonmentEmail,
} = proxyActivities<typeof activitiesTypes>({
  startToCloseTimeout: '30 seconds',
  retry: {
    maximumAttempts: 3,
    initialInterval: '1 second',
    backoffCoefficient: 2,
  },
});

// ── Inbound signals ───────────────────────────────────────────────────────────

/** Human validation decision signal */
export const humanValidationSignal = defineSignal<[ValidationDecision]>('humanValidation');

/** Document update signal */
export const documentsUpdatedSignal = defineSignal<[DocumentsUpdate]>('documentsUpdated');

// ── Queries ───────────────────────────────────────────────────────────────────

/** Returns the current workflow state */
export const getStatusQuery = defineQuery<FundingRequestStatus>('getStatus');

/** Returns the full request details */
export const getDetailsQuery = defineQuery<FundingRequestDetails>('getDetails');

// ── Shared mutable state ──────────────────────────────────────────────────────

interface WorkflowState {
  status: FundingRequestStatus;
  validationDecision: ValidationDecision | null;
  updatedDocuments: string[] | null;
  rejectionReason: string | null;
}

// ── Helper functions ──────────────────────────────────────────────────────────

function registerHandlers(request: FundingRequest, state: WorkflowState): void {
  setHandler(getStatusQuery, () => state.status);

  setHandler(
    getDetailsQuery,
    (): FundingRequestDetails => ({
      id: request.id,
      userId: request.userId,
      userEmail: request.userEmail,
      amount: request.amount,
      purpose: request.purpose,
      documents: request.documents,
      status: state.status,
      rejectionReason: state.rejectionReason,
    }),
  );

  setHandler(humanValidationSignal, (decision: ValidationDecision) => {
    log.info('Human validation signal received', {
      approved: decision.approved,
      validatorId: decision.validatorId,
    });
    state.validationDecision = decision;
  });

  setHandler(documentsUpdatedSignal, ({ documents }: DocumentsUpdate) => {
    log.info('Document update signal received', { count: documents.length });
    state.updatedDocuments = documents;
  });
}

async function runDocumentVerification(
  request: FundingRequest,
  state: WorkflowState,
): Promise<WorkflowResult | null> {
  state.status = 'CHECKING_DOCUMENTS';
  log.info('Step 1 — Checking document completeness', { requestId: request.id });

  const { complete, missing } = await checkDocumentsCompleteness(request.documents ?? []);

  if (!complete) {
    state.status = 'WAITING_DOCUMENTS';
    log.info('Incomplete documents — sending initial email', { missing });

    await sendMissingDocumentsEmail({
      userEmail: request.userEmail,
      missingDocuments: missing,
      requestId: request.id,
    });

    // Wait for documents with daily reminders, up to DOCUMENT_WAIT_DAYS days.
    // condition() returns true if the signal arrived before the timeout, false if timed out.
    let docsReceived;

    for (let day = 0; day < DOCUMENT_WAIT_DAYS; day++) {
      docsReceived = await condition(() => state.updatedDocuments !== null, '24 hours');

      if (docsReceived) break;

      if (day === DOCUMENT_WAIT_DAYS - 1) {
        // Days elapsed with no response — abandon the request
        state.status = 'ABANDONED';
        log.warn('Request abandoned — no documents received after 7 days', {
          requestId: request.id,
        });
        await sendAbandonmentEmail({ userEmail: request.userEmail, requestId: request.id });
        return {
          status: state.status,
          reason: 'Request abandoned: supporting documents not provided within 7 days',
        };
      }

      // Send daily reminder (days 1 through DOCUMENT_WAIT_DAYS - 1)
      log.info(`Sending reminder day ${day + 1}`, { requestId: request.id });
      await sendReminderEmail({
        userEmail: request.userEmail,
        missingDocuments: missing,
        requestId: request.id,
        dayNumber: day + 1,
      });
    }

    // state.updatedDocuments is guaranteed non-null here because docsReceived is true
    request.documents = state.updatedDocuments!;
    log.info('Documents updated by applicant', { requestId: request.id });
  }

  return null;
}

async function runFraudDetection(
  request: FundingRequest,
  state: WorkflowState,
): Promise<WorkflowResult | null> {
  state.status = 'CHECKING_FRAUD';
  log.info('Step 2 — Running fraud detection', { requestId: request.id });

  const isFraud = await checkFraud({
    id: request.id,
    amount: request.amount,
    userId: request.userId,
  });

  if (isFraud) {
    state.status = 'REJECTED';
    state.rejectionReason = 'Fraud detected by the anti-fraud system';
    log.warn('Request rejected — fraud detected', { requestId: request.id });
    return { status: state.status, reason: state.rejectionReason };
  }

  return null;
}

async function runHumanValidation(
  request: FundingRequest,
  state: WorkflowState,
): Promise<WorkflowResult> {
  if (request.amount <= HUMAN_VALIDATION_THRESHOLD) {
    state.status = 'APPROVED';
    log.info(`Request auto-approved (amount ≤ €${HUMAN_VALIDATION_THRESHOLD})`, {
      requestId: request.id,
      amount: request.amount,
    });
    return { status: state.status };
  }

  state.status = 'PENDING_VALIDATION';
  log.info('Step 3 — Awaiting human validation', { requestId: request.id, amount: request.amount });

  // Wait indefinitely for the validation signal
  await condition(() => state.validationDecision !== null);

  // state.validationDecision is guaranteed non-null after condition resolves
  const decision = state.validationDecision!;

  if (decision.approved) {
    state.status = 'APPROVED';
    log.info('Request approved by validator', {
      requestId: request.id,
      validatorId: decision.validatorId,
    });
    return { status: state.status };
  } else {
    state.status = 'REJECTED';
    state.rejectionReason = decision.reason ?? 'Rejected by validator';
    log.info('Request rejected by validator', {
      requestId: request.id,
      reason: state.rejectionReason,
    });
    return { status: state.status, reason: state.rejectionReason };
  }
}

// ── Main workflow ─────────────────────────────────────────────────────────────

/**
 * Funding request processing workflow.
 *
 * Steps:
 *  1. Verify document completeness — send daily reminder emails for up to 7 days,
 *     then abandon if no response.
 *  2. Run fraud detection via a mocked external API.
 *  3. For amounts > €500, suspend until a human validator sends a decision signal.
 *     Amounts ≤ €500 are auto-approved.
 */
export async function fundingRequestWorkflow(request: FundingRequest): Promise<WorkflowResult> {
  const state: WorkflowState = {
    status: 'INITIATED',
    validationDecision: null,
    updatedDocuments: null,
    rejectionReason: null,
  };

  registerHandlers(request, state);

  const docResult = await runDocumentVerification(request, state);
  if (docResult) return docResult;

  const fraudResult = await runFraudDetection(request, state);
  if (fraudResult) return fraudResult;

  return runHumanValidation(request, state);
}
