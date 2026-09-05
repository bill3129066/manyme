import { createPublicClient, createWalletClient, http, type Chain } from 'viem'
import { base, baseSepolia } from 'viem/chains'
import { privateKeyToAccount } from 'viem/accounts'
import { config } from '../../config.js'

if (![84532, 8453].includes(config.chainId))
  throw new Error('Unsupported BASE_CHAIN_ID')
const activeChain: Chain = config.chainId === 84532 ? baseSepolia : base

export const publicClient = createPublicClient({
  chain: activeChain,
  transport: http(config.baseRpc),
})

export function getWalletClient(privateKey: `0x${string}`) {
  const account = privateKeyToAccount(privateKey)
  return createWalletClient({
    account,
    chain: activeChain,
    transport: http(config.baseRpc),
  })
}

// All writes by the platform share one nonce/receipt queue.
let pending: Promise<unknown> = Promise.resolve()
export function operatorTransaction(
  send: (wallet: ReturnType<typeof getWalletClient>) => Promise<`0x${string}`>,
) {
  const operation = pending.then(async () => {
    if (!config.platformOperatorKey)
      throw new Error('Platform operator key required')
    if ((await publicClient.getChainId()) !== config.chainId)
      throw new Error('RPC chain mismatch')
    const wallet = getWalletClient(config.platformOperatorKey as `0x${string}`)
    const hash = await send(wallet)
    const receipt = await publicClient.waitForTransactionReceipt({ hash })
    if (receipt.status !== 'success')
      throw new Error(`Transaction reverted: ${hash}`)
    return receipt
  })
  pending = operation.catch(() => {})
  return operation
}
