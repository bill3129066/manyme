export function costSnapshot(chain: {
  accruedTotal: bigint; lastCheckpointAt: number; lastProofAt: number;
  proofWindow: number; depositedBalance: bigint;
}) {
  return {
    accrued: Number(chain.accruedTotal),
    checkpointAt: Number(chain.lastCheckpointAt),
    proofExpiresAt: Number(chain.lastProofAt) + Number(chain.proofWindow),
    deposit: Number(chain.depositedBalance),
  }
}
