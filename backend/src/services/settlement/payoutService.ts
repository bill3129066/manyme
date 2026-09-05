import { erc20Abi } from 'viem'
import { getDb } from '../../db/client.js'
import { config } from '../../config.js'
import { publicClient, operatorTransaction } from '../onchain/baseClient.js'
import { manyMeEscrowAbi } from '../../../../shared/abis/ManyMeEscrow.js'
import { getSession } from '../onchain/contractClient.js'
export class PayoutError extends Error {
  constructor(
    message: string,
    public status: number = 400,
  ) {
    super(message)
  }
}
const inFlight = new Set<string>()
export async function payoutCurator(
  curatorWallet: string,
): Promise<{ amount: number; txHash: string }> {
  const wallet = curatorWallet.toLowerCase()
  if (inFlight.has(wallet))
    throw new PayoutError('Payout is already in progress', 409)
  inFlight.add(wallet)
  try {
    const db = getDb()
    const rows = db
      .prepare(
        `SELECT ce.*,s.onchain_session_id FROM curator_earnings ce JOIN sessions s ON s.id=ce.session_id WHERE ce.curator_wallet=? COLLATE NOCASE AND ce.paid_out=0`,
      )
      .all(wallet) as any[]
    if (!rows.length) throw new PayoutError('No pending earnings to pay out')
    const prior = rows.find((r) => r.payout_tx_hash)
    if (prior) {
      const receipt = await publicClient.waitForTransactionReceipt({
        hash: prior.payout_tx_hash,
      })
      if (receipt.status !== 'success') {
        db.prepare(
          'UPDATE curator_earnings SET payout_tx_hash=NULL WHERE payout_tx_hash=?',
        ).run(prior.payout_tx_hash)
        throw new PayoutError('Previous payout reverted; retry')
      }
      const included = rows.filter(
        (r) => r.payout_tx_hash === prior.payout_tx_hash,
      )
      db.prepare(
        'UPDATE curator_earnings SET paid_out=1 WHERE payout_tx_hash=?',
      ).run(prior.payout_tx_hash)
      return {
        amount: included.reduce((n, r) => n + r.earned_amount, 0),
        txHash: prior.payout_tx_hash,
      }
    }
    for (const row of rows) {
      if (row.onchain_session_id == null)
        throw new PayoutError('Earnings lack on-chain session')
      const chain = await getSession(BigInt(row.onchain_session_id))
      if (!chain || chain.status !== 3)
        throw new PayoutError('Stop session before payout')
      if (chain.accruedTotal > chain.totalClaimed)
        await operatorTransaction((client) =>
          client.writeContract({
            address: config.escrowAddress as `0x${string}`,
            abi: manyMeEscrowAbi,
            functionName: 'claimEarnings',
            args: [BigInt(row.onchain_session_id)],
          }),
        )
    }
    const amount = rows.reduce((n, r) => n + r.earned_amount, 0)
    if (amount <= 0) throw new PayoutError('No pending earnings to pay out')
    const receipt = await operatorTransaction(async (client) => {
      const hash = await client.writeContract({
        address: config.usdcAddress as `0x${string}`,
        abi: erc20Abi,
        functionName: 'transfer',
        args: [wallet as `0x${string}`, BigInt(amount)],
      })
      db.transaction(() => {
        for (const row of rows)
          db.prepare(
            'UPDATE curator_earnings SET payout_tx_hash=? WHERE id=?',
          ).run(hash, row.id)
      })()
      return hash
    })
    db.prepare(
      'UPDATE curator_earnings SET paid_out=1 WHERE payout_tx_hash=?',
    ).run(receipt.transactionHash)
    return { amount, txHash: receipt.transactionHash }
  } finally {
    inFlight.delete(wallet)
  }
}
