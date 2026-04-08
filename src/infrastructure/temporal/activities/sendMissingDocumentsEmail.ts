import type { EmailResult, MissingDocumentsEmailParams } from '../../../domain/fundingRequest';

const DOC_LABELS: Record<string, string> = {
  identity: 'Government-issued ID',
  income_proof: 'Proof of income',
  bank_statement: 'Bank statement',
};

/**
 * Sends an email to the applicant asking them to upload their missing documents.
 * Mocked implementation — prints the email to the console.
 */
export async function sendMissingDocumentsEmail({
  userEmail,
  missingDocuments,
  requestId,
}: MissingDocumentsEmailParams): Promise<EmailResult> {
  const missingLabels = missingDocuments.map((d) => DOC_LABELS[d] ?? d);

  console.log('\n[EMAIL] ════════════════════════════════════════════');
  console.log(`[EMAIL] To      : ${userEmail}`);
  console.log(`[EMAIL] Subject : Request #${requestId} — Missing supporting documents`);
  console.log('[EMAIL] Body    :');
  console.log('[EMAIL]   Hello,');
  console.log('[EMAIL]   Your funding request is incomplete.');
  console.log('[EMAIL]   Missing documents:');
  missingLabels.forEach((label) => console.log(`[EMAIL]     • ${label}`));
  console.log('[EMAIL]   Please upload the missing documents via the API.');
  console.log('[EMAIL]   Best regards, the Funding team');
  console.log('[EMAIL] ════════════════════════════════════════════\n');

  return { sent: true, timestamp: new Date().toISOString() };
}
