import type { EmailResult, ReminderEmailParams } from '../../../domain/FundingRequest';

const DOC_LABELS: Record<string, string> = {
  identity: 'Government-issued ID',
  income_proof: 'Proof of income',
  bank_statement: 'Bank statement',
};

/**
 * Sends a daily reminder email to the applicant when documents are still missing.
 * Mocked implementation — prints the email to the console.
 */
export async function sendReminderEmail({
  userEmail,
  missingDocuments,
  requestId,
  dayNumber,
}: ReminderEmailParams): Promise<EmailResult> {
  const missingLabels = missingDocuments.map((d) => DOC_LABELS[d] ?? d);
  const daysLeft = 7 - dayNumber;

  console.log('\n[EMAIL] ════════════════════════════════════════════');
  console.log(`[EMAIL] To      : ${userEmail}`);
  console.log(`[EMAIL] Subject : Request #${requestId} — Reminder ${dayNumber}/6 — Missing documents`);
  console.log('[EMAIL] Body    :');
  console.log(`[EMAIL]   Hello, this is a reminder (day ${dayNumber}).`);
  console.log('[EMAIL]   Your funding request is still incomplete.');
  console.log('[EMAIL]   Missing documents:');
  missingLabels.forEach((label) => console.log(`[EMAIL]     • ${label}`));
  console.log(`[EMAIL]   ⚠️  Your request will be abandoned in ${daysLeft} day(s) if no action is taken.`);
  console.log('[EMAIL]   Best regards, the Funding team');
  console.log('[EMAIL] ════════════════════════════════════════════\n');

  return { sent: true, timestamp: new Date().toISOString() };
}
