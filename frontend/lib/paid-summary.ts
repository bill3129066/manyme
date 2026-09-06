import { wrapFetchWithPaymentFromConfig, decodePaymentResponseHeader, type SelectPaymentRequirements } from '@x402/fetch'
import { ExactEvmScheme } from '@x402/evm/exact/client'
import { getNetworkConfig } from './networks'

export const selectSummaryPayment: SelectPaymentRequirements = (version, requirements) => {
  const requirement = requirements.find(item =>
    item.scheme === 'exact' && item.network === 'eip155:84532' && item.amount === '1000' &&
    item.asset.toLowerCase() === getNetworkConfig(84532).usdcAddress.toLowerCase() &&
    /^0x[\da-f]{40}$/i.test(item.payTo) && !/^0x0+$/i.test(item.payTo),
  )
  if (version !== 2 || !requirement) throw new Error('付款條件與 0.001 USDC 不符，尚未簽署付款。')
  return requirement
}

export interface AnalysisSummary {
  agentId: string
  agentName: string
  summary: string
  timestamp: string
  transaction: string
}

export async function purchaseSummary(agentId: string, signer: ConstructorParameters<typeof ExactEvmScheme>[0], request: typeof fetch = fetch): Promise<AnalysisSummary> {
  const paidFetch = wrapFetchWithPaymentFromConfig(request, {
    schemes: [{network: 'eip155:84532', client: new ExactEvmScheme(signer)}],
    paymentRequirementsSelector: selectSummaryPayment,
  })
  const base = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'
  const response = await paidFetch(`${base}/queries/agent/${encodeURIComponent(agentId)}/summary`, {method:'GET', cache:'no-store'})
  const body = await response.json().catch(() => null)
  if (!response.ok) throw new Error(body?.error || '摘要暫時無法取得，請先確認錢包付款紀錄。')
  const header = response.headers.get('PAYMENT-RESPONSE')
  if (!header) throw new Error('尚未收到付款確認，請先確認錢包交易紀錄，避免重複付款。')
  const receipt = decodePaymentResponseHeader(header)
  if (!receipt.success || !/^0x[\da-f]{64}$/i.test(receipt.transaction || '')) throw new Error('付款尚未確認，請先查看錢包交易紀錄。')
  if (body?.agentId !== agentId || typeof body.summary !== 'string') throw new Error('已收到付款紀錄，但摘要格式有誤，請勿重複付款。')
  return {...body, transaction:receipt.transaction}
}
