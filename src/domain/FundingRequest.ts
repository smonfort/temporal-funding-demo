export interface FundingRequest {
  id: string;
  userId: string;
  userEmail: string;
  amount: number;
  purpose: string;
  documents: string[];
}

export interface FraudCheckParams {
  id: string;
  amount: number;
  userId: string;
}

export interface DocumentsCheckResult {
  complete: boolean;
  missing: string[];
}

export interface MissingDocumentsEmailParams {
  userEmail: string;
  missingDocuments: string[];
  requestId: string;
}

export interface ReminderEmailParams {
  userEmail: string;
  missingDocuments: string[];
  requestId: string;
  dayNumber: number;
}

export interface AbandonmentEmailParams {
  userEmail: string;
  requestId: string;
}

export interface EmailResult {
  sent: boolean;
  timestamp: string;
}

export interface ValidationDecision {
  approved: boolean;
  reason?: string;
  validatorId: string;
}

export interface DocumentsUpdate {
  documents: string[];
}

export type FundingRequestStatus =
  | 'INITIATED'
  | 'CHECKING_DOCUMENTS'
  | 'WAITING_DOCUMENTS'
  | 'CHECKING_FRAUD'
  | 'PENDING_VALIDATION'
  | 'APPROVED'
  | 'REJECTED'
  | 'ABANDONED';

export interface FundingRequestDetails extends FundingRequest {
  status: FundingRequestStatus;
  rejectionReason: string | null;
}

export interface WorkflowResult {
  status: FundingRequestStatus;
  reason?: string;
}
