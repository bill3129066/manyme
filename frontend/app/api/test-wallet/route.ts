import { NextRequest, NextResponse } from 'next/server'
import {
  createWalletClient,
  createPublicClient,
  http,
  hexToString,
  decodeFunctionData,
  erc20Abi,
  type Hex,
} from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { baseSepolia } from 'viem/chains'
import { manyMeEscrowAbi } from '../../../../shared/abis/ManyMeEscrow'
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
let queue: Promise<unknown> = Promise.resolve()
export async function POST(req: NextRequest) {
  const host = req.headers.get('host') || ''
  const origin = req.headers.get('origin')
  if (
    process.env.NODE_ENV !== 'development' ||
    process.env.NEXT_PUBLIC_TEST_WALLET !== 'true' ||
    !['localhost:3000', '127.0.0.1:3000'].includes(host) ||
    origin !== `http://${host}`
  )
    return NextResponse.json(
      { error: 'Local test wallet unavailable' },
      { status: 403 },
    )
  try {
    const { role, method, params = [] } = await req.json()
    if (!['payer', 'author'].includes(role))
      throw new Error('Unknown test account')
    const key = process.env[
      role === 'payer' ? 'TEST_PAYER_PRIVATE_KEY' : 'TEST_AUTHOR_PRIVATE_KEY'
    ] as Hex
    const account = privateKeyToAccount(key)
    const transport = http(
      process.env.BASE_RPC_URL || 'https://sepolia.base.org',
    )
    const pub = createPublicClient({ chain: baseSepolia, transport })
    const wallet = createWalletClient({
      account,
      chain: baseSepolia,
      transport,
    })
    if ((await pub.getChainId()) !== 84532)
      throw new Error('Only Base Sepolia is allowed')
    const escrow = process.env.ESCROW_CONTRACT_ADDRESS?.toLowerCase()
    const token = '0x036cbd53842c5426634e7929541ec2318f3dcf7e'
    let result: unknown
    if (method === 'eth_accounts' || method === 'eth_requestAccounts')
      result = [account.address]
    else if (method === 'eth_chainId') result = '0x14a34'
    else if (method === 'personal_sign') {
      const message = hexToString(params[0])
      if (
        params[1]?.toLowerCase() !== account.address.toLowerCase() ||
        !message.startsWith(`ManyMe Sign-In\nDomain: ${process.env.AUTH_DOMAIN || 'localhost:3000'}\nAddress: ${account.address.toLowerCase()}\nChain ID: 84532\nNonce: `)
      )
        throw new Error('Only Base Sepolia ManyMe sign-in signatures are allowed')
      result = await account.signMessage({ message })
    } else if (method === 'eth_signTypedData_v4') {
      const data =
        typeof params[1] === 'string' ? JSON.parse(params[1]) : params[1]
      if (
        params[0]?.toLowerCase() !== account.address.toLowerCase() ||
        Number(data.domain.chainId) !== 84532 ||
        data.domain.verifyingContract?.toLowerCase() !== token ||
        data.primaryType !== 'TransferWithAuthorization' ||
        data.message.from?.toLowerCase() !== account.address.toLowerCase() ||
        data.message.to?.toLowerCase() !==
          process.env.PLATFORM_WALLET?.toLowerCase() ||
        BigInt(data.message.value) <= 0n ||
        BigInt(data.message.value) > 1000000n
      )
        throw new Error('Payment is outside test wallet limits')
      result = await account.signTypedData(data)
    } else if (method === 'eth_sendTransaction') {
      const tx = params[0]
      if (
        tx.from?.toLowerCase() !== account.address.toLowerCase() ||
        BigInt(tx.value || 0) !== 0n ||
        (tx.chainId && Number(tx.chainId) !== 84532)
      )
        throw new Error('Transaction outside test wallet limits')
      const to = tx.to?.toLowerCase()
      if (to === token) {
        const call = decodeFunctionData({ abi: erc20Abi, data: tx.data })
        if (
          call.functionName !== 'approve' ||
          call.args[0].toLowerCase() !== escrow ||
          call.args[1] > 10000000n
        )
          throw new Error('Only bounded escrow approval is allowed')
      } else if (to === escrow) {
        const call = decodeFunctionData({ abi: manyMeEscrowAbi, data: tx.data })
        if (
          ![
            'registerAgent',
            'createSession',
            'stopSession',
            'refundUnused',
            'topUp',
          ].includes(call.functionName)
        )
          throw new Error('Escrow operation not allowed')
        if (call.functionName === 'createSession' && call.args[1] > 10000000n)
          throw new Error('Deposit limit is 10 test USDC')
      } else throw new Error('Contract not allowlisted')
      const operation = queue.then(async () => {
        const hash = await wallet.sendTransaction({
          to: tx.to,
          data: tx.data,
          value: 0n,
        })
        const receipt = await pub.waitForTransactionReceipt({
          hash,
          confirmations: 2,
        })
        if (receipt.status !== 'success')
          throw new Error('Transaction reverted')
        return hash
      })
      queue = operation.catch(() => {})
      result = await operation
    } else if (
      method === 'wallet_switchEthereumChain' &&
      Number(params[0]?.chainId) === 84532
    )
      result = null
    else throw new Error(`Unsupported wallet method: ${method}`)
    return NextResponse.json({ result })
  } catch (e: any) {
    return NextResponse.json(
      { error: e.shortMessage || e.message },
      { status: 400 },
    )
  }
}
