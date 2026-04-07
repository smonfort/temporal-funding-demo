// Required documents for a complete application
export const REQUIRED_DOCUMENTS: string[] = ['identity', 'income_proof', 'bank_statement'];

// Amount threshold above which human validation is required (in euros)
export const HUMAN_VALIDATION_THRESHOLD = 500;

// Maximum number of days to wait for missing documents before abandoning the request
export const DOCUMENT_WAIT_DAYS = 7;
