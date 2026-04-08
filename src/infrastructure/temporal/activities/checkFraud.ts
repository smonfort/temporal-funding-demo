import type { FraudCheckParams } from '../../../domain/fundingRequest';

/**
 * Checks whether a funding request is fraudulent via a mocked external API.
 * Mock rule: amounts divisible by 13 are flagged as fraudulent.
 */
export async function checkFraud({ id, amount, userId }: FraudCheckParams): Promise<boolean> {
  console.log(`[FRAUD CHECK] Checking request ${id} — user: ${userId}, amount: €${amount}`);

  // Simulate external API latency
  await new Promise<void>((resolve) => setTimeout(resolve, 300 + Math.random() * 400));

  const isFraud = amount % 13 === 0;

  console.log(`[FRAUD CHECK] Result for ${id}: ${isFraud ? '⚠️  FRAUD DETECTED' : '✅ CLEAN'}`);
  return isFraud;
}
