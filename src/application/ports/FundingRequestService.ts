import type {
  FundingRequestDetails,
  FundingRequestStatus,
  ValidationDecision,
} from '../../domain/FundingRequest';

export interface CreateFundingRequestInput {
  userId: string;
  userEmail: string;
  amount: number;
  purpose: string;
  documents: string[];
}

export interface CreatedFundingRequest {
  id: string;
  status: FundingRequestStatus;
}

export interface NotFoundError {
  kind: 'NOT_FOUND';
  id: string;
}

export interface ConflictError {
  kind: 'CONFLICT';
  currentStatus: FundingRequestStatus;
  message: string;
}

export interface FundingRequestService {
  /** Start a new funding request processing workflow. */
  create(input: CreateFundingRequestInput): Promise<CreatedFundingRequest>;

  /** Retrieve current state and details for a single request. */
  getById(id: string): Promise<FundingRequestDetails | NotFoundError>;

  /** List all funding requests (running + recently completed). */
  listAll(): Promise<FundingRequestDetails[]>;

  /** List requests currently awaiting human validation. */
  listPendingValidation(): Promise<FundingRequestDetails[]>;

  /** Submit a validation decision. Returns an error if the request is not in PENDING_VALIDATION. */
  validate(id: string, decision: ValidationDecision): Promise<void | NotFoundError | ConflictError>;

  /** Submit updated documents. Returns an error if the request is not in WAITING_DOCUMENTS. */
  updateDocuments(id: string, documents: string[]): Promise<void | NotFoundError | ConflictError>;
}
