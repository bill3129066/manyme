import { getDb } from '../../db/client.js'
import { config } from '../../config.js'
import {
  buildProofPackage,
  hashProofPackage,
  saveProofPackage,
} from './proofBuilder.js'
import { sseHub } from '../realtime/sseHub.js'
import { randomUUID } from 'crypto'
import { operatorTransaction } from '../onchain/baseClient.js'
import { manyMeEscrowAbi } from '../../../../shared/abis/ManyMeEscrow.js'
import { syncSession } from '../session/liveSessionOrchestrator.js'

export class ProofRelayer {
  private intervalId?: ReturnType<typeof setInterval>
  private busy = false
  async start() {
    if (!config.platformOperatorKey || !config.escrowAddress)
      throw new Error(
        'Real proof relayer requires operator and deployed escrow',
      )
    this.intervalId = setInterval(() => void this.tick(), 4000)
  }
  private async tick() {
    if (this.busy) return
    this.busy = true
    try {
      const rows = getDb()
        .prepare(
          "SELECT * FROM sessions WHERE status='active' AND onchain_session_id IS NOT NULL AND COALESCE((SELECT e.status FROM agent_executions e WHERE e.session_id=sessions.id ORDER BY e.rowid DESC LIMIT 1),'') != 'failed'",
        )
        .all() as any[]
      for (const row of rows) {
        try {
          await syncSession(row.id)
          if (
            (
              getDb()
                .prepare('SELECT status FROM sessions WHERE id=?')
                .get(row.id) as any
            )?.status !== 'active'
          )
            continue
          const last = getDb()
            .prepare(
              'SELECT seq FROM proofs WHERE session_id=? ORDER BY seq DESC LIMIT 1',
            )
            .get(row.id) as any
          const seq = (last?.seq ?? 0) + 1
          const steps = getDb()
            .prepare(
              'SELECT * FROM session_steps WHERE session_id=? ORDER BY seq',
            )
            .all(row.id)
          const pkg = buildProofPackage(row.id, seq, steps)
          const proofHash = hashProofPackage(pkg)
          const metadataUri = saveProofPackage(pkg)
          const receipt = await operatorTransaction((wallet) => {
            // A queued proof must not renew billing after generation has failed.
            const failed = getDb()
              .prepare(
                "SELECT 1 FROM (SELECT status FROM agent_executions WHERE session_id=? ORDER BY rowid DESC LIMIT 1) WHERE status='failed'",
              )
              .get(row.id)
            if (failed)
              throw new Error('Proof cancelled after generation failure')
            return wallet.writeContract({
              address: config.escrowAddress as `0x${string}`,
              abi: manyMeEscrowAbi,
              functionName: 'submitProof',
              args: [BigInt(row.onchain_session_id), proofHash, metadataUri],
            })
          })
          getDb()
            .prepare(
              'INSERT INTO proofs (id,session_id,seq,proof_hash,metadata_uri,tx_hash) VALUES (?,?,?,?,?,?)',
            )
            .run(
              randomUUID(),
              row.id,
              seq,
              proofHash,
              metadataUri,
              receipt.transactionHash,
            )
          sseHub.emitProof(row.id, {
            seq,
            proofHash,
            txHash: receipt.transactionHash,
            ts: new Date().toISOString(),
          })
          await syncSession(row.id)
        } catch (e: any) {
          console.error(
            '[ProofRelayer] Confirmation failed:',
            e.shortMessage || e.message,
          )
        }
      }
    } finally {
      this.busy = false
    }
  }
  stop() {
    if (this.intervalId) clearInterval(this.intervalId)
  }
}
