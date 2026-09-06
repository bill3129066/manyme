import { createPublicClient, createWalletClient, http, type Hex } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { baseSepolia } from 'viem/chains'
import { manyMeEscrowAbi } from '../../shared/abis/ManyMeEscrow'

export const apiBase = process.env.CATALOG_API_URL || 'http://localhost:3001'
if (!['localhost', '127.0.0.1'].includes(new URL(apiBase).hostname)) throw new Error('Catalog tools require a local API')
export const escrow = process.env.ESCROW_CONTRACT_ADDRESS as Hex
export const publicClient = createPublicClient({ chain: baseSepolia, transport: http(process.env.BASE_RPC_URL) })
export { manyMeEscrowAbi }
export function walletFor(role: 'AUTHOR' | 'PAYER') {
  const key = process.env[`TEST_${role}_PRIVATE_KEY`] as Hex
  if (!key) throw new Error(`TEST_${role}_PRIVATE_KEY required`)
  return createWalletClient({ account: privateKeyToAccount(key), chain: baseSepolia, transport: http(process.env.BASE_RPC_URL) })
}
export async function preflight() {
  if ((await publicClient.getChainId()) !== 84532) throw new Error('Base Sepolia required')
  if (!escrow || !(await publicClient.getCode({ address: escrow }))) throw new Error('Deployed escrow required')
}
export async function api(path: string, method = 'GET', body?: unknown, headers: Record<string,string> = {}) {
  const r = await fetch(`${apiBase}/api${path}`, {
    method, headers: { 'Content-Type': 'application/json', ...headers },
    body: body === undefined ? undefined : JSON.stringify(body), signal: AbortSignal.timeout(180_000),
  })
  const result = await r.json()
  if (!r.ok) throw new Error(`${method} ${path}: ${JSON.stringify(result)}`)
  return result
}
export async function signIn(wallet: ReturnType<typeof walletFor>) {
  const challenge = await api('/auth/challenge', 'POST', { wallet: wallet.account.address })
  const signature = await wallet.signMessage({ message: challenge.message })
  const auth = await api('/auth/verify', 'POST', { wallet: wallet.account.address, nonce: challenge.nonce, signature })
  return { 'x-wallet-address': wallet.account.address, 'x-auth-token': auth.token }
}
export async function confirmed(hash: Hex) {
  const receipt = await publicClient.waitForTransactionReceipt({ hash })
  if (receipt.status !== 'success') throw new Error(`Transaction reverted: ${hash}`)
  return receipt
}
