process.env.DATABASE_URL = 'file::memory:'
import { expect, test, mock } from 'bun:test'
import { readFileSync } from 'node:fs'
import { Hono } from 'hono'
import { getDb } from '../../db/client'
const chain = { accruedTotal: 820000n, status: 3, lastCheckpointAt: 182, lastProofAt: 180, proofWindow: 10, depositedBalance:1000000n }
mock.module('../../services/onchain/contractClient.js',()=>({getSession:async()=>chain}))
mock.module('../../services/session/liveSessionOrchestrator.js',()=>({syncSession:async()=>{},getSessionDetails:(id:string)=>getDb().prepare('SELECT * FROM sessions WHERE id=?').get(id),startSession:async()=>{},pauseSession:()=>{},resumeSession:()=>{},stopSession:async()=>{},chatInSession:async()=>{}}))
const { sessionsRoutes } = await import('../../api/sessions.routes')
const app = new Hono().route('/api/sessions', sessionsRoutes)
getDb().exec(readFileSync(new URL('../../db/schema.sql',import.meta.url),'utf8'))
getDb().prepare("INSERT INTO agents(id,creator_wallet,name,description,system_prompt) VALUES('cost-agent','seller','Trip planner','test','test')").run()
getDb().prepare("INSERT INTO sessions(id,onchain_session_id,agent_id,user_wallet,status,total_rate,curator_rate,platform_fee,deposit_amount) VALUES('cost-session',4,'cost-agent','0xbuyer','stopped',10000,9700,300,1000000)").run()
test('history and detail return the same actual chain charge, not four seconds of fees',async()=>{
 const list=await (await app.request('/api/sessions?wallet=0xBuyer')).json()
 const detail=await (await app.request('/api/sessions/cost-session')).json()
 expect(list).toHaveLength(1)
 expect(list[0].accrued_total).toBe(820000)
 expect(list[0].accrued_total).toBe(detail.accrued_total)
 expect(list[0].agent_name).toBe('Trip planner')
 expect(await (await app.request('/api/sessions?wallet=0xOther')).json()).toEqual([])
})
