import { expect, mock, test } from 'bun:test'
import { Database } from 'bun:sqlite'
import { readFileSync } from 'node:fs'
import { encodeAbiParameters, encodeEventTopics } from 'viem'
import { Hono } from 'hono'
import { manyMeEscrowAbi } from '../../../../shared/abis/ManyMeEscrow'

const escrow = '0x1111111111111111111111111111111111111111'
const author = '0x2222222222222222222222222222222222222222'
process.env.ESCROW_CONTRACT_ADDRESS = escrow
const db = new Database(':memory:')
db.exec(readFileSync(new URL('../../db/schema.sql', import.meta.url), 'utf8'))
mock.module('../../db/client', () => ({ getDb: () => db }))
mock.module('../../middleware/verifySignature', () => ({ requireSignature: () => async (c: any, next: any) => { c.set('verifiedWallet', author); await next() } }))
let observedBlock: bigint | undefined
mock.module('../../services/onchain/baseClient', () => ({ publicClient: {
  getTransactionReceipt: async () => ({ status: 'success', blockNumber: 123n, logs: [{ address: escrow,
    topics: encodeEventTopics({ abi: manyMeEscrowAbi, eventName: 'AgentRegistered', args: { agentId: 7n, curator: author } }),
    data: encodeAbiParameters([{ type: 'uint96' }, { type: 'string' }], [9700n, 'manyme://catalog/example']),
  }] }),
  readContract: async (args: any) => {
    observedBlock = args.blockNumber
    // Latest may be served by a node which has not seen this registration yet.
    return args.blockNumber === 123n ? [10000n, 9700n, 300n] : [300n, 0n, 300n]
  },
} }))
const { agentsRoutes } = await import('../../api/agents.routes')
const app = new Hono().route('/agents', agentsRoutes)
test('stores the confirmed total rate', async () => {
  const r = await app.request('/agents', { method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'Example', description: 'Example', systemPrompt: 'Example', registrationTxHash: `0x${'a'.repeat(64)}` }) })
  expect(r.status).toBe(201)
  const agent = await r.json()
  expect(observedBlock).toBe(123n)
  expect(agent.onchain_agent_id).toBe(7)
  expect(agent.rate_per_second).toBe(10000)
})
