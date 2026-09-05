import {
  createPublicClient,
  createWalletClient,
  http,
  parseEther,
  type Hex,
} from '../../backend/node_modules/viem'
import { privateKeyToAccount } from '../../backend/node_modules/viem/accounts'
import { baseSepolia } from '../../backend/node_modules/viem/chains'
import { readFileSync, writeFileSync, chmodSync } from 'node:fs'
const publicClient = createPublicClient({
  chain: baseSepolia,
  transport: http(process.env.BASE_RPC_URL),
})
if ((await publicClient.getChainId()) !== 84532)
  throw new Error('Refusing deployment outside Base Sepolia')
const account = privateKeyToAccount(process.env.PLATFORM_OPERATOR_KEY as Hex)
const wallet = createWalletClient({
  account,
  chain: baseSepolia,
  transport: http(process.env.BASE_RPC_URL),
})
const artifact = JSON.parse(
  readFileSync(
    new URL(
      '../../contracts/out/ManyMeEscrow.sol/ManyMeEscrow.json',
      import.meta.url,
    ),
    'utf8',
  ),
)
let address = process.env.ESCROW_CONTRACT_ADDRESS as Hex
if (
  !address ||
  (await publicClient.getCode({ address })) === '0x' ||
  !(await publicClient.getCode({ address }))
) {
  const hash = await wallet.deployContract({
    abi: artifact.abi,
    bytecode: artifact.bytecode.object,
    args: [account.address, account.address, 300n, process.env.USDC_ADDRESS],
  })
  const receipt = await publicClient.waitForTransactionReceipt({ hash })
  if (receipt.status !== 'success' || !receipt.contractAddress)
    throw new Error('Deployment failed')
  address = receipt.contractAddress
  console.log(
    JSON.stringify({
      deployment: hash,
      address,
      block: String(receipt.blockNumber),
    }),
  )
  let env = readFileSync('.env', 'utf8').replace(
    /^ESCROW_CONTRACT_ADDRESS=.*$/m,
    `ESCROW_CONTRACT_ADDRESS=${address}`,
  )
  writeFileSync('.env', env)
  chmodSync('.env', 0o600)
  writeFileSync(
    'scripts/testnet/deployment.json',
    JSON.stringify(
      { chainId: 84532, address, hash, block: String(receipt.blockNumber) },
      null,
      2,
    ) + '\n',
  )
}
let front = readFileSync('frontend/.env.local', 'utf8').replace(
  /^NEXT_PUBLIC_ESCROW_CONTRACT_ADDRESS=.*$/m,
  `NEXT_PUBLIC_ESCROW_CONTRACT_ADDRESS=${address}`,
)
writeFileSync('frontend/.env.local', front)
for (const key of ['TEST_PAYER_PRIVATE_KEY', 'TEST_AUTHOR_PRIVATE_KEY']) {
  const to = privateKeyToAccount(process.env[key] as Hex).address
  const target = parseEther('0.00002')
  const balance = await publicClient.getBalance({ address: to })
  if (balance >= target) continue
  const hash = await wallet.sendTransaction({ to, value: target - balance })
  const receipt = await publicClient.waitForTransactionReceipt({ hash })
  if (receipt.status !== 'success') throw new Error('Gas funding failed')
  console.log(JSON.stringify({ funded: to, hash }))
}
