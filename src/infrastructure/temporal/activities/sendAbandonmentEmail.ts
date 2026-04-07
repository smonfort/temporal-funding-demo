import type { AbandonmentEmailParams, EmailResult } from '../../../domain/FundingRequest';

/**
 * Sends an abandonment notification email after 7 days without a response.
 * Mocked implementation — prints the email to the console.
 */
export async function sendAbandonmentEmail({
  userEmail,
  requestId,
}: AbandonmentEmailParams): Promise<EmailResult> {
  console.log('\n[EMAIL] ════════════════════════════════════════════');
  console.log(`[EMAIL] To      : ${userEmail}`);
  console.log(`[EMAIL] Subject : Request #${requestId} — Request abandoned`);
  console.log('[EMAIL] Body    :');
  console.log('[EMAIL]   Hello,');
  console.log('[EMAIL]   Your funding request has been abandoned because the required');
  console.log('[EMAIL]   supporting documents were not provided within 7 days.');
  console.log('[EMAIL]   You are welcome to submit a new request at any time.');
  console.log('[EMAIL]   Best regards, the Funding team');
  console.log('[EMAIL] ════════════════════════════════════════════\n');

  return { sent: true, timestamp: new Date().toISOString() };
}
