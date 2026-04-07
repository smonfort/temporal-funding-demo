export const TASK_QUEUE = process.env.TASK_QUEUE ?? 'funding-requests';

export const WORKFLOW_TYPE = 'fundingRequestWorkflow';

// Temporal signal names
export const SIGNALS = {
  HUMAN_VALIDATION: 'humanValidation',
  DOCUMENTS_UPDATED: 'documentsUpdated',
} as const;

// Temporal query names
export const QUERIES = {
  GET_STATUS: 'getStatus',
  GET_DETAILS: 'getDetails',
} as const;
