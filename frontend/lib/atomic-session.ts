import { encodeFunctionData, erc20Abi, type Hash } from 'viem'
import { manyMeEscrowAbi } from '../../shared/abis/ManyMeEscrow'

// Return null only before submitting anything. A rejected or uncertain batch must
// never fall back to a second set of transactions.
export async function createAtomicSession(wallet: {
  getCapabilities: (args: {chainId: number}) => Promise<{atomic?: {status: string}}>
  sendCalls: (args: any) => Promise<{id: string}>
  waitForCallsStatus: (args: any) => Promise<{status: string | undefined; receipts?: readonly {transactionHash: Hash; status: string}[]}>
}, escrow: Hash, token: Hash, agentId: bigint, amount: bigint): Promise<Hash | null> {
  let atomic: string | undefined
  try { atomic = (await wallet.getCapabilities({chainId: 84532})).atomic?.status }
  catch { return null }
  if (atomic !== 'supported' && atomic !== 'ready') return null
  const {id} = await wallet.sendCalls({
    forceAtomic: true, experimental_fallback: false,
    calls: [
      {to: token, data: encodeFunctionData({abi: erc20Abi, functionName:'approve', args:[escrow,amount]})},
      {to: escrow, data: encodeFunctionData({abi: manyMeEscrowAbi, functionName:'createSession', args:[agentId,amount]})},
    ],
  })
  const result = await wallet.waitForCallsStatus({id,throwOnFailure:true})
  const receipt = result.receipts?.at(-1)
  if (result.status !== 'success' || !receipt || receipt.status !== 'success') throw new Error('批次交易尚未確認，請先查看錢包交易紀錄。')
  return receipt.transactionHash
}
