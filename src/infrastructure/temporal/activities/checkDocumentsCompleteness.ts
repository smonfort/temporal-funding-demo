import { REQUIRED_DOCUMENTS } from '../../../domain/constants';
import type { DocumentsCheckResult } from '../../../domain/FundingRequest';

/**
 * Checks that all required supporting documents have been provided.
 */
export async function checkDocumentsCompleteness(documents: string[]): Promise<DocumentsCheckResult> {
  const provided = Array.isArray(documents) ? documents : [];
  const missing = REQUIRED_DOCUMENTS.filter((doc) => !provided.includes(doc));

  console.log(`[DOCUMENTS] Provided: ${provided.join(', ') || 'none'}`);
  console.log(`[DOCUMENTS] Missing:  ${missing.join(', ') || 'none'}`);

  return { complete: missing.length === 0, missing };
}
