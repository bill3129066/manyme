process.env.DATABASE_URL = 'file::memory:'
import { expect, test, mock } from 'bun:test'
import { readFileSync } from 'node:fs'
import { getDb } from '../../db/client'
const chain = { accruedTotal:301n,totalRatePerSecond:301n,curatorRate:1n,status:1,lastCheckpointAt:100,lastProofAt:100,proofWindow:60,depositedBalance:1000000n }
mock.module('../../services/onchain/contractClient.js',()=>({getSession:async()=>chain}))
let attempts=0
mock.module('../../services/agent/agentExecutor.js',()=>({chatWithAgent:async()=>{if(++attempts===1)throw new Error('503 Service Unavailable');return {reply:'接著討論',tokensUsed:1,toolCallCount:0}}}))
const {chatInSession,syncSession}=await import('../../services/session/liveSessionOrchestrator')
getDb().exec(readFileSync(new URL('../../db/schema.sql',import.meta.url),'utf8'))
getDb().prepare("INSERT INTO agents(id,creator_wallet,name,description,system_prompt) VALUES('a','owner','test','test','test')").run()
getDb().prepare("INSERT INTO sessions(id,onchain_session_id,agent_id,user_wallet,status,total_rate,curator_rate,platform_fee,deposit_amount) VALUES('s',1,'a','owner','active',301,1,300,1000000)").run()
test('a model failure permits a follow-up in the same active session',async()=>{
 await expect(chatInSession('s','hi',[],'owner')).rejects.toThrow('503')
 await expect(chatInSession('s','retry',[],'owner')).resolves.toEqual({reply:'接著討論',tokensUsed:1,toolCallCount:0})
})
test('self-use earns one micro-USDC after settlement without rounding it away',async()=>{
 chain.status=3
 await syncSession('s')
 expect((getDb().prepare("SELECT earned_amount FROM curator_earnings WHERE session_id='s'").get() as any).earned_amount).toBe(1)
})
