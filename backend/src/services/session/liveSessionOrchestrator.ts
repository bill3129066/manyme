import { costSnapshot } from './costSnapshot.js'
import { getDb } from '../../db/client.js'
import { randomUUID } from 'crypto'
import { chatWithAgent } from '../agent/agentExecutor.js'
import { sseHub } from '../realtime/sseHub.js'
import { escrowEvent } from '../onchain/receipts.js'
import { getSession } from '../onchain/contractClient.js'

// On-chain escrow owns session status and accrual. SQLite mirrors confirmed state.
export async function startSession(
  agentId: string,
  userWallet: string,
  inputs: Record<string, string> = {},
  txHash?: string,
) {
  const db = getDb()
  const agent = db
    .prepare('SELECT * FROM agents WHERE id = ? AND active = 1')
    .get(agentId) as any
  if (!agent) throw new Error('Agent not found or inactive')
  if (!txHash)
    throw new Error(
      'Create the escrow session in your wallet and provide txHash',
    )
  const event = await escrowEvent(txHash, 'SessionCreated')
  if (event.user.toLowerCase() !== userWallet.toLowerCase())
    throw new Error('Transaction belongs to another wallet')
  if (
    agent.onchain_agent_id == null ||
    BigInt(agent.onchain_agent_id) !== event.agentId
  )
    throw new Error('On-chain agent does not match')
  const existing = db
    .prepare('SELECT id FROM sessions WHERE onchain_session_id = ?')
    .get(Number(event.sessionId)) as any
  if (existing) return { sessionId: existing.id }
  const chain = await getSession(event.sessionId)
  if (!chain || chain.status !== 1)
    throw new Error('On-chain session is not active')
  const id = randomUUID()
  db.prepare(
    `INSERT INTO sessions (id,onchain_session_id,agent_id,user_wallet,status,total_rate,curator_rate,platform_fee,deposit_amount,started_at)
    VALUES (?,?,?,?,?,?,?,?,?,?)`,
  ).run(
    id,
    Number(event.sessionId),
    agentId,
    userWallet.toLowerCase(),
    'active',
    Number(chain.totalRatePerSecond),
    Number(chain.curatorRate),
    Number(chain.platformFee),
    Number(chain.depositedBalance),
    new Date(Number(chain.startedAt) * 1000).toISOString(),
  )
  db.prepare('UPDATE agents SET run_count=run_count+1 WHERE id=?').run(agentId)
  return { sessionId: id }
}

function owned(sessionId: string, wallet: string) {
  const row = getSessionDetails(sessionId) as any
  if (!row) throw new Error('Session not found')
  if (row.user_wallet.toLowerCase() !== wallet.toLowerCase())
    throw new Error('Not authorized: wallet does not own session')
  return row
}

export async function syncSession(sessionId: string) {
  const db = getDb()
  const row = getSessionDetails(sessionId) as any
  if (!row || row.onchain_session_id == null) return
  const chain = await getSession(BigInt(row.onchain_session_id))
  if (!chain) return
  const status = ['created', 'active', 'paused', 'stopped'][chain.status]
  db.prepare(
    "UPDATE sessions SET status=?, ended_at=CASE WHEN ?='stopped' THEN COALESCE(ended_at,datetime('now')) ELSE ended_at END WHERE id=?",
  ).run(status, status, sessionId)
  if (row.status !== status) sseHub.emitStatus(sessionId, status)
  sseHub.emit(sessionId, 'earnings', { accrued: Number(chain.accruedTotal), cost_snapshot: costSnapshot(chain), status, ts: new Date().toISOString() })
  // Earnings become withdrawable only after the escrow session has stopped.
  if (status === 'stopped') {
    const agent = db
      .prepare('SELECT creator_wallet FROM agents WHERE id=?')
      .get(row.agent_id) as any
    const amount =
      chain.totalRatePerSecond > 0n
        ? (chain.accruedTotal * BigInt(chain.curatorRate)) /
          BigInt(chain.totalRatePerSecond)
        : 0n
    db.prepare(
      'INSERT OR IGNORE INTO curator_earnings (id,curator_wallet,agent_id,session_id,earned_amount,paid_out) VALUES (?,?,?,?,?,0)',
    ).run(
      randomUUID(),
      agent.creator_wallet,
      row.agent_id,
      sessionId,
      Number(amount),
    )
  }
}
export async function stopSession(sessionId: string, wallet: string) {
  owned(sessionId, wallet)
  await syncSession(sessionId)
  if (getSessionDetails(sessionId)?.status !== 'stopped')
    throw new Error('Stop the escrow session with your wallet first')
}
export function pauseSession(sessionId: string, wallet: string) {
  owned(sessionId, wallet)
  throw new Error(
    'Manual pause is not supported by this escrow. Stop the session to end billing.',
  )
}
export function resumeSession(sessionId: string, wallet: string) {
  owned(sessionId, wallet)
  throw new Error(
    'This escrow cannot resume. Stop and refund this session, then start a new one.',
  )
}
export async function chatInSession(
  sessionId: string,
  message: string,
  history: Array<{ role: 'user' | 'model'; parts: Array<{ text: string }> }>,
  wallet: string,
) {
  const row = owned(sessionId, wallet)
  await syncSession(sessionId)
  if (getSessionDetails(sessionId)?.status !== 'active')
    throw new Error('Session is not active')
  const db = getDb()
  if (
    db
      .prepare(
        "SELECT 1 FROM agent_executions WHERE session_id=? AND status='failed'",
      )
      .get(sessionId)
  )
    throw new Error('Generation failed. End this session and start a new one.')
  const executionId = randomUUID()
  db.prepare(
    "INSERT INTO agent_executions (id,agent_id,user_wallet,session_id,input_json,status) VALUES (?,?,?,?,?,'running')",
  ).run(
    executionId,
    row.agent_id,
    wallet,
    sessionId,
    JSON.stringify({ message }),
  )
  const started = Date.now()
  try {
    const result = await chatWithAgent(
      row.agent_id,
      row.user_wallet,
      message,
      history,
      {},
      (step) => {
        const seq = (
          db
            .prepare(
              'SELECT COALESCE(MAX(seq),0)+1 AS seq FROM session_steps WHERE session_id=?',
            )
            .get(sessionId) as any
        ).seq
        db.prepare(
          'INSERT INTO session_steps (id,session_id,seq,step_type,title,body) VALUES (?,?,?,?,?,?)',
        ).run(randomUUID(), sessionId, seq, step.kind, step.title, step.body)
        sseHub.emitStep(sessionId, step)
      },
    )
    db.prepare(
      "UPDATE agent_executions SET status='completed',output_text=?,tokens_used=?,duration_ms=?,completed_at=datetime('now') WHERE id=?",
    ).run(result.reply, result.tokensUsed, Date.now() - started, executionId)
    return result
  } catch (e: any) {
    db.prepare(
      "UPDATE agent_executions SET status='failed',error_message=?,completed_at=datetime('now') WHERE id=?",
    ).run(e.message, executionId)
    throw e
  }
}
export function getSessionDetails(
  sessionId: string,
): Record<string, unknown> | null {
  return (
    (getDb()
      .prepare('SELECT * FROM sessions WHERE id=?')
      .get(sessionId) as Record<string, unknown>) ?? null
  )
}
