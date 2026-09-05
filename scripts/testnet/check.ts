import {
  createPublicClient,
  http,
  erc20Abi,
  formatEther,
} from '../../backend/node_modules/viem'
import { baseSepolia } from '../../backend/node_modules/viem/chains'
import { privateKeyToAccount } from '../../backend/node_modules/viem/accounts'
const c = createPublicClient({
  chain: baseSepolia,
  transport: http(process.env.BASE_RPC_URL),
})
if ((await c.getChainId()) !== 84532)
  throw new Error('Testnet tools require Base Sepolia')
for (const k of [
  'PLATFORM_OPERATOR_KEY',
  'TEST_PAYER_PRIVATE_KEY',
  'TEST_AUTHOR_PRIVATE_KEY',
]) {
  const a = privateKeyToAccount(process.env[k] as `0x${string}`)
  console.log(
    JSON.stringify({
      role: k,
      address: a.address,
      eth: formatEther(await c.getBalance({ address: a.address })),
      usdc: String(
        await c.readContract({
          address: process.env.USDC_ADDRESS as `0x${string}`,
          abi: erc20Abi,
          functionName: 'balanceOf',
          args: [a.address],
        }),
      ),
    }),
  )
}
