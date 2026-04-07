import { WorkflowNotFoundError, type Client } from '@temporalio/client';
import { v4 as uuidv4 } from 'uuid';
import type {
  FundingRequestDetails,
  FundingRequestStatus,
  ValidationDecision,
} from '../../domain/FundingRequest';
import type {
  ConflictError,
  CreateFundingRequestInput,
  CreatedFundingRequest,
  FundingRequestService,
  NotFoundError,
} from '../../application/ports/FundingRequestService';
import { QUERIES, SIGNALS, TASK_QUEUE, WORKFLOW_TYPE } from './workflowConstants';

export class TemporalFundingRequestService implements FundingRequestService {
  constructor(private readonly client: Client) {}

  async create(input: CreateFundingRequestInput): Promise<CreatedFundingRequest> {
    const id = uuidv4();
    const workflowId = this.toWorkflowId(id);

    await this.client.workflow.start(WORKFLOW_TYPE, {
      taskQueue: TASK_QUEUE,
      workflowId,
      args: [{ ...input, id }],
    });

    return { id, status: 'INITIATED' };
  }

  async getById(id: string): Promise<FundingRequestDetails | NotFoundError> {
    try {
      const handle = this.client.workflow.getHandle(this.toWorkflowId(id));
      return await handle.query<FundingRequestDetails>(QUERIES.GET_DETAILS);
    } catch (err) {
      if (err instanceof WorkflowNotFoundError) return { kind: 'NOT_FOUND', id };
      throw err;
    }
  }

  async listAll(): Promise<FundingRequestDetails[]> {
    const results: FundingRequestDetails[] = [];
    for await (const wf of this.client.workflow.list({
      query: `WorkflowType = '${WORKFLOW_TYPE}'`,
    })) {
      try {
        const handle = this.client.workflow.getHandle(wf.workflowId);
        results.push(await handle.query<FundingRequestDetails>(QUERIES.GET_DETAILS));
      } catch {
        // Skip workflows that became unavailable between list and query
      }
    }
    return results;
  }

  async listPendingValidation(): Promise<FundingRequestDetails[]> {
    const results: FundingRequestDetails[] = [];
    for await (const wf of this.client.workflow.list({
      query: `WorkflowType = '${WORKFLOW_TYPE}' AND ExecutionStatus = 'Running'`,
    })) {
      try {
        const handle = this.client.workflow.getHandle(wf.workflowId);
        const details = await handle.query<FundingRequestDetails>(QUERIES.GET_DETAILS);
        if (details.status === 'PENDING_VALIDATION') {
          results.push(details);
        }
      } catch {
        // Skip workflows that became unavailable between list and query
      }
    }
    return results;
  }

  async validate(
    id: string,
    decision: ValidationDecision,
  ): Promise<void | NotFoundError | ConflictError> {
    try {
      const handle = this.client.workflow.getHandle(this.toWorkflowId(id));
      const status = await handle.query<FundingRequestStatus>(QUERIES.GET_STATUS);
      if (status !== 'PENDING_VALIDATION') {
        return {
          kind: 'CONFLICT',
          currentStatus: status,
          message: `Request is not awaiting validation. Current status: ${status}`,
        };
      }
      await handle.signal(SIGNALS.HUMAN_VALIDATION, decision);
    } catch (err) {
      if (err instanceof WorkflowNotFoundError) return { kind: 'NOT_FOUND', id };
      throw err;
    }
  }

  async updateDocuments(
    id: string,
    documents: string[],
  ): Promise<void | NotFoundError | ConflictError> {
    try {
      const handle = this.client.workflow.getHandle(this.toWorkflowId(id));
      const status = await handle.query<FundingRequestStatus>(QUERIES.GET_STATUS);
      if (status !== 'WAITING_DOCUMENTS') {
        return {
          kind: 'CONFLICT',
          currentStatus: status,
          message: `Request is not awaiting document updates. Current status: ${status}`,
        };
      }
      await handle.signal(SIGNALS.DOCUMENTS_UPDATED, { documents });
    } catch (err) {
      if (err instanceof WorkflowNotFoundError) return { kind: 'NOT_FOUND', id };
      throw err;
    }
  }

  private toWorkflowId(id: string): string {
    return `funding-request-${id}`;
  }
}
