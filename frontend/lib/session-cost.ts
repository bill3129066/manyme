export interface CostSnapshot {
  accrued: number
  checkpointAt: number
  proofExpiresAt: number
  deposit: number
}

// UI estimate mirrors the escrow's checkpoint bounds; settlement stays on-chain.
export function estimateSessionCost(snapshot: CostSnapshot, rate: number, status: string, now: number) {
  if (status !== 'active') return snapshot.accrued
  const elapsed = Math.max(0, Math.min(now, snapshot.proofExpiresAt) - snapshot.checkpointAt)
  return Math.min(snapshot.deposit, snapshot.accrued + elapsed * rate)
}

export function parseCuratorRate(value: string) {
  if (!/^\d+(\.\d{1,6})?$/.test(value)) throw new Error('Enter a non-negative USDC rate with up to 6 decimal places')
  const [whole, fraction = ''] = value.split('.')
  const amount = Number(whole) * 1_000_000 + Number(fraction.padEnd(6, '0'))
  if (!Number.isSafeInteger(amount)) throw new Error('USDC rate is too large')
  return amount
}
