// Real paid sessions: deposit -> API chat -> stop -> refund, for every curated service.
// Run from root: bun --env-file=.env backend/scripts/check-catalog.ts
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { erc20Abi, parseEventLogs, type Hex } from 'viem'
import { DEMO_CATALOG } from '../src/db/demoCatalog'
import { api, confirmed, escrow, manyMeEscrowAbi, preflight, publicClient, signIn, walletFor } from './catalog-client'

await preflight()
const wallet = walletFor('PAYER')
const headers = await signIn(wallet)
const token = await publicClient.readContract({ address: escrow, abi: manyMeEscrowAbi, functionName: 'paymentToken' })
const deposit = 500_000n
const allowance = await publicClient.readContract({ address: token, abi: erc20Abi, functionName: 'allowance', args: [wallet.account.address, escrow] })
if (allowance < deposit) await confirmed(await wallet.writeContract({ maxPriorityFeePerGas: 0n, address: token, abi: erc20Abi, functionName: 'approve', args: [escrow, deposit * BigInt(DEMO_CATALOG.length)] }))
const reportPath = process.env.CATALOG_REPORT_PATH || '.catalog-smoke.json'
const report: any = existsSync(reportPath) ? JSON.parse(readFileSync(reportPath, 'utf8')) : {
  chainId: 84532, escrow, payer: wallet.account.address, results: [],
}
if (report.escrow.toLowerCase() !== escrow.toLowerCase() || report.payer.toLowerCase() !== wallet.account.address.toLowerCase()) throw new Error('Report belongs to another deployment or payer')
const currentFingerprints = new Set<string>()
const save = () => writeFileSync(reportPath, JSON.stringify(report, null, 2) + '\n')
for (const entry of DEMO_CATALOG) {
  const rows = await api('/agents')
  const matches = rows.filter((a: any) => a.metadata_uri === `manyme://catalog/v1/${entry.id}`)
  if (matches.length !== 1) throw new Error(`Expected one published service: ${entry.id}`)
  const agent = matches[0]
  const chainAgent = await publicClient.readContract({ address: escrow, abi: manyMeEscrowAbi, functionName: 'getAgent', args: [BigInt(agent.onchain_agent_id)] })
  const rates = await publicClient.readContract({ address: escrow, abi: manyMeEscrowAbi, functionName: 'sessionRate', args: [BigInt(agent.onchain_agent_id)] })
  if (!chainAgent.active || chainAgent.metadataURI !== agent.metadata_uri || chainAgent.curator.toLowerCase() !== agent.creator_wallet.toLowerCase() || Number(rates[0]) !== agent.rate_per_second) throw new Error(`Published chain configuration mismatch: ${entry.name}`)
  const executionConfig = {
    verifierVersion: 2, escrow, chainId: 84532, deposit: Number(deposit), id: agent.id,
    onchainAgentId: agent.onchain_agent_id, creator: agent.creator_wallet, metadataUri: agent.metadata_uri,
    totalRate: agent.rate_per_second, systemPrompt: agent.system_prompt, model: agent.model,
    template: agent.user_prompt_template, schema: agent.input_schema_json, tools: agent.tools_json,
    temperature: agent.temperature, maxTokens: agent.max_tokens, input: entry.sampleInput,
  }
  const fingerprint = createHash('sha256').update(JSON.stringify(executionConfig)).digest('hex')
  currentFingerprints.add(fingerprint)
  const attempts = report.results.filter((r: any) => r.id === agent.id && r.fingerprint === fingerprint)
  if (attempts.some((r: any) => r.status === 'passed')) continue
  let result = attempts.reverse().find((r: any) => !r.completedAt)
  if (!result) {
    result = { id: agent.id, name: agent.name, category: agent.category, onchainAgentId: agent.onchain_agent_id,
      fingerprint, executionConfig, input: entry.sampleInput, model: agent.model, status: 'running', startedAt: new Date().toISOString() }
    report.results.push(result); save()
  }
  delete result.error
  save()
  let chainSessionId: bigint | undefined
  try {
    if (!result.createHash) {
      const fees = await publicClient.estimateFeesPerGas()
      const gasReserve = fees.maxFeePerGas * 600_000n + 100_000_000_000n
      if (await publicClient.getBalance({ address: wallet.account.address }) < gasReserve) throw new Error('Top up payer test ETH before starting; reserve gas for stop and refund')
      if (await publicClient.readContract({ address: token, abi: erc20Abi, functionName: 'balanceOf', args: [wallet.account.address] }) < deposit) throw new Error('Top up payer test USDC')
      result.createHash = await wallet.writeContract({ maxPriorityFeePerGas: 0n, address: escrow, abi: manyMeEscrowAbi,
        functionName: 'createSession', args: [BigInt(agent.onchain_agent_id), deposit] })
      save()
    }
    const receipt = await confirmed(result.createHash)
    const event = parseEventLogs({ abi: manyMeEscrowAbi, eventName: 'SessionCreated',
      logs: receipt.logs.filter(l => l.address.toLowerCase() === escrow.toLowerCase()) })[0]
    if (!event) throw new Error('SessionCreated event missing')
    chainSessionId = event.args.sessionId
    result.onchainSessionId = Number(chainSessionId); save()
    const session = result.sessionId ? { id: result.sessionId } : await api('/sessions', 'POST', { agentId: agent.id, txHash: result.createHash }, headers)
    result.sessionId = session.id; save()
    if (!result.stopHash && !result.refundHash && result.status !== 'answered') {
    const chat = await api(`/sessions/${session.id}/chat`, 'POST', { message: entry.sampleInput }, headers)
    if (typeof chat.reply !== 'string' || chat.reply.trim().length < 80) throw new Error('Empty or unexpectedly short reply')
    result.reply = chat.reply
    result.toolCallCount = chat.toolCallCount
    if (chat.toolCallCount !== 0) throw new Error('Text-only catalog unexpectedly invoked tools')
    if (DEMO_CATALOG.find(e => e.category === entry.category)?.id === entry.id) {
      const followup = '請根據剛才的情境，把建議縮成我現在能做的三個步驟，保留最重要的限制。'
      const next = await api(`/sessions/${session.id}/chat`, 'POST', { message: followup,
        history: [{ role: 'user', parts: [{ text: entry.sampleInput }] }, { role: 'model', parts: [{ text: chat.reply }] }] }, headers)
      if (!next.reply?.trim()) throw new Error('Empty follow-up')
      result.followup = { input: followup, reply: next.reply }
    }
    result.status = 'answered'; save()
    }
  } catch (error) {
    result.error = (error as Error).message
    result.status = 'failed'; save()
  } finally {
    // Also recover the chain session if API/model execution fails.
    if (chainSessionId !== undefined) {
      result.stopHash ||= await wallet.writeContract({ maxPriorityFeePerGas: 0n, address: escrow, abi: manyMeEscrowAbi, functionName: 'stopSession', args: [chainSessionId] }); save()
      await confirmed(result.stopHash)
      result.refundHash ||= await wallet.writeContract({ maxPriorityFeePerGas: 0n, address: escrow, abi: manyMeEscrowAbi, functionName: 'refundUnused', args: [chainSessionId] }); save()
      await confirmed(result.refundHash)
      if (result.sessionId) await api(`/sessions/${result.sessionId}/stop`, 'POST', {}, headers)
      const chain = await publicClient.readContract({ address: escrow, abi: manyMeEscrowAbi, functionName: 'getSession', args: [chainSessionId] })
      const refunded = await publicClient.readContract({ address: escrow, abi: manyMeEscrowAbi, functionName: 'refundedAmount', args: [chainSessionId] })
      if (chain.status !== 3 || chain.accruedTotal <= 0n || refunded + chain.accruedTotal !== deposit) throw new Error('Settlement invariant failed')
      result.deposit = Number(deposit); result.charged = Number(chain.accruedTotal); result.refunded = Number(refunded)
      if (result.sessionId) {
        const details = await api(`/sessions/${result.sessionId}`)
        result.proofCount = details.proofs.length
        if (result.status === 'answered' && !result.proofCount) throw new Error('No confirmed activity proof recorded')
        if (result.reply && !details.executions.some((e: any) => e.status === 'completed' && e.output_text === result.reply)) throw new Error('Reply was not persisted')
      }
      if (result.status === 'answered') result.status = 'passed'
      result.completedAt = new Date().toISOString(); save()
    }
  }
  console.log(JSON.stringify({ name: result.name, status: result.status, charged: result.charged, refunded: result.refunded, error: result.error }))
  if (result.status !== 'passed') throw new Error(`Catalog check failed: ${entry.name}`)
}
const passed = new Set(report.results.filter((r: any) => r.status === 'passed' && currentFingerprints.has(r.fingerprint)).map((r: any) => r.fingerprint)).size
if (passed !== DEMO_CATALOG.length) throw new Error('Not all current services passed')
console.log(`Verified ${passed} paid services; report: ${reportPath}`)
