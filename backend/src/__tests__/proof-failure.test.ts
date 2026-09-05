process.env.DATABASE_URL = 'file::memory:'
import { beforeAll, expect, mock, test } from 'bun:test'
import { readFileSync } from 'node:fs'
import { getDb } from '../db/client.js'
import { createAgent } from '../services/agent/agentRegistry.js'

let sends = 0
let beforeSend: (() => void) | undefined
mock.module('../services/onchain/baseClient.js', () => ({
  operatorTransaction: async (send: (wallet: any) => Promise<string>) => {
    beforeSend?.()
    const transactionHash = await send({ writeContract: async () => {
      sends++
      return `0x${'12'.repeat(32)}`
    } })
    return { transactionHash }
  },
}))
mock.module('../services/session/liveSessionOrchestrator.js', () => ({ syncSession: async () => {} }))
mock.module('../services/proof/proofBuilder.js', () => ({
  buildProofPackage: () => ({}),
  hashProofPackage: () => `0x${'34'.repeat(32)}`,
  saveProofPackage: () => 'test://proof',
}))
const { ProofRelayer } = await import('../services/proof/proofRelayer.js')
let agentId: string
const sessionId = 'proof-failure-regression'
const relayer = new ProofRelayer()
const tick = () => (relayer as any).tick() as Promise<void>
const fail = () => getDb().prepare("INSERT INTO agent_executions (id,agent_id,user_wallet,session_id,status) VALUES (?,?,?,?,'failed')").run(crypto.randomUUID(), agentId, 'test-buyer', sessionId)

beforeAll(() => {
  getDb().exec(readFileSync(new URL('../db/schema.sql', import.meta.url), 'utf8'))
  agentId = createAgent({creatorWallet:'test-author',name:'Failure regression',description:'test',systemPrompt:'test'}).id
  getDb().prepare("INSERT INTO sessions (id,onchain_session_id,agent_id,user_wallet,status,total_rate,curator_rate,platform_fee,deposit_amount) VALUES (?,99,?,'test-buyer','active',10000,9700,300,1000000)").run(sessionId,agentId)
})

test('a persisted model failure stops renewal even when the session is still active', async () => {
  await tick()
  expect(sends).toBe(1)
  fail()
  await tick()
  expect(sends).toBe(1)
  expect((getDb().prepare('SELECT COUNT(*) AS n FROM proofs WHERE session_id=?').get(sessionId) as any).n).toBe(1)
})

test('a failure occurring while a proof waits in the operator queue cancels that proof', async () => {
  getDb().prepare('DELETE FROM agent_executions WHERE session_id=?').run(sessionId)
  beforeSend = fail
  await tick()
  beforeSend = undefined
  expect(sends).toBe(1)
  expect((getDb().prepare('SELECT COUNT(*) AS n FROM proofs WHERE session_id=?').get(sessionId) as any).n).toBe(1)
})
