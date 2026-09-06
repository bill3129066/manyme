// Run from the root: bun --env-file=.env backend/scripts/publish-catalog.ts --apply
import { Database } from 'bun:sqlite'
import { resolve } from 'node:path'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { parseEventLogs, type Hex } from 'viem'
import { DEMO_CATALOG } from '../src/db/demoCatalog'
import { retireDemoAgents } from '../src/db/retireDemoAgents'
import { api, confirmed, escrow, manyMeEscrowAbi, preflight, publicClient, signIn, walletFor } from './catalog-client'

if (!process.argv.includes('--apply')) throw new Error('Use --apply to register and publish the catalog; --retire also hides known old demos')
await preflight()
const dbUrl = process.env.DATABASE_URL
if (!dbUrl?.startsWith('file:')) throw new Error('Explicit file: DATABASE_URL required')
const dbPath = resolve('backend', dbUrl.slice(5))
if (!existsSync(dbPath)) throw new Error('Start run.bash to initialize the target database first')
const db = new Database(dbPath)
const localIds = (db.query('SELECT id FROM agents WHERE active=1').all() as {id:string}[]).map(a => a.id).sort()
const remoteIds = (await api('/agents')).map((a: any) => a.id).sort()
if (JSON.stringify(localIds) !== JSON.stringify(remoteIds)) throw new Error('API and DATABASE_URL point to different catalogs')
const wallet = walletFor('AUTHOR')
const headers = await signIn(wallet)
const journalPath = '.catalog-registration.json'
const journal: Record<string, Hex> = existsSync(journalPath) ? JSON.parse(readFileSync(journalPath, 'utf8')) : {}
const keepIds: string[] = []
const report: unknown[] = []
for (const entry of DEMO_CATALOG) {
  const marker = `manyme://catalog/v1/${entry.id}`
  const rows = await api('/agents')
  const matches = rows.filter((a: any) => a.creator_wallet.toLowerCase() === wallet.account.address.toLowerCase() &&
    (a.metadata_uri === marker || (entry.id === 'three-generation-travel' && a.name === '三代旅行規劃師')))
  if (matches.length > 1) throw new Error(`Ambiguous existing service: ${entry.name}`)
  let agent = matches[0]
  let registrationTxHash: Hex | undefined
  const body = {
    name: entry.name, description: entry.description, category: entry.category,
    systemPrompt: entry.systemPrompt, userPromptTemplate: '{{query}}',
    inputSchemaJson: JSON.stringify({ type: 'object', properties: { query: { type: 'string' } }, required: ['query'] }),
    model: process.env.CATALOG_MODEL || ({ general: 'gemini-3.7-flash', research: 'gemini-3.7-flash', defi: 'gemini-3.6-flash', trading: 'gemini-3.6-flash', nft: 'gemini-3.5-flash', security: 'gemini-3.5-flash' } as Record<string, string>)[entry.category], temperature: 0.3, maxTokens: 4096, metadataUri: marker,
  }
  if (!agent) {
    const journalKey = `${escrow.toLowerCase()}:${wallet.account.address.toLowerCase()}:${entry.id}`
    registrationTxHash = journal[journalKey]
    if (!registrationTxHash) {
      registrationTxHash = await wallet.writeContract({ address: escrow, abi: manyMeEscrowAbi,
        functionName: 'registerAgent', args: [9700n, marker] })
      // Persist before waiting so a timeout can resume the same registration.
      journal[journalKey] = registrationTxHash
      writeFileSync(journalPath, JSON.stringify(journal, null, 2) + '\n')
    }
    const receipt = await confirmed(registrationTxHash)
    const event = parseEventLogs({ abi: manyMeEscrowAbi, eventName: 'AgentRegistered',
      logs: receipt.logs.filter(l => l.address.toLowerCase() === escrow.toLowerCase()) })[0]
    if (!event || event.args.curator.toLowerCase() !== wallet.account.address.toLowerCase() || event.args.metadataURI !== marker)
      throw new Error(`Registration mismatch: ${entry.id}`)
    agent = await api('/agents', 'POST', { ...body, registrationTxHash }, headers)
  } else {
    agent = await api(`/agents/${agent.id}`, 'PUT', body, headers)
  }
  if (agent.onchain_agent_id == null) throw new Error(`Unregistered service: ${entry.name}`)
  const chain = await publicClient.readContract({ address: escrow, abi: manyMeEscrowAbi,
    functionName: 'getAgent', args: [BigInt(agent.onchain_agent_id)] })
  const rates = await publicClient.readContract({ address: escrow, abi: manyMeEscrowAbi,
    functionName: 'sessionRate', args: [BigInt(agent.onchain_agent_id)] })
  if (!chain.active || chain.curator.toLowerCase() !== agent.creator_wallet.toLowerCase() || Number(rates[0]) !== agent.rate_per_second)
    throw new Error(`Chain state/rate mismatch: ${entry.name}`)
  keepIds.push(agent.id)
  report.push({ id: agent.id, name: agent.name, category: agent.category, onchainAgentId: agent.onchain_agent_id,
    totalRate: Number(rates[0]), registrationTxHash })
  console.log(`Published ${entry.name} (chain ${agent.onchain_agent_id})`)
}
const retired = process.argv.includes('--retire') ? retireDemoAgents(db, keepIds) : 0
console.log(JSON.stringify({ chainId: 84532, escrow, retired, services: report }, null, 2))
db.close()
