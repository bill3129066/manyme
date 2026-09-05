import { useAccount, usePublicClient, useWalletClient } from 'wagmi'
import { erc20Abi } from 'viem'
import { manyMeEscrowAbi } from '../../shared/abis/ManyMeEscrow'
import { getNetworkConfig } from './networks'
export function useEscrowActions() {
  const { address } = useAccount()
  const pub = usePublicClient({ chainId: 84532 })
  const { data: wallet } = useWalletClient()
  async function send(
    functionName:
      | 'registerAgent'
      | 'createSession'
      | 'stopSession'
      | 'refundUnused',
    args: readonly unknown[],
  ) {
    if (!wallet || !pub) throw new Error('Connect wallet first')
    if (wallet.chain.id !== 84532) throw new Error('Switch to Base Sepolia')
    const { escrowAddress } = getNetworkConfig(84532)
    if (/^0x0+$/.test(escrowAddress))
      throw new Error('Escrow is not configured')
    const hash = await wallet.writeContract({
      address: escrowAddress,
      abi: manyMeEscrowAbi,
      functionName,
      args,
    } as any)
    const receipt = await pub.waitForTransactionReceipt({
      hash,
      confirmations: 2,
    })
    if (receipt.status !== 'success')
      throw new Error('Escrow transaction reverted')
    return hash
  }
  return {
    async register(rate: number, metadata: string) {
      if (!Number.isSafeInteger(rate) || rate < 0)
        throw new Error('Invalid rate')
      return send('registerAgent', [BigInt(rate), metadata])
    },
    async create(agentId: number, amount: number) {
      if (!wallet || !pub) throw new Error('Connect wallet first')
      if (wallet.chain.id !== 84532) throw new Error('Switch to Base Sepolia')
      const { escrowAddress, usdcAddress } = getNetworkConfig(84532)
      const approval = await wallet.writeContract({
        address: usdcAddress,
        abi: erc20Abi,
        functionName: 'approve',
        args: [escrowAddress, BigInt(amount)],
      })
      const receipt = await pub.waitForTransactionReceipt({
        hash: approval,
        confirmations: 2,
      })
      if (receipt.status !== 'success')
        throw new Error('USDC approval reverted')
      return send('createSession', [BigInt(agentId), BigInt(amount)])
    },
    async stop(id: number) {
      return send('stopSession', [BigInt(id)])
    },
    async refund(id: number) {
      return send('refundUnused', [BigInt(id)])
    },
    async balance() {
      if (!address || !pub) throw new Error('Connect wallet to read balance')
      return Number(
        await pub.readContract({
          address: getNetworkConfig(84532).usdcAddress,
          abi: erc20Abi,
          functionName: 'balanceOf',
          args: [address],
        }),
      )
    },
  }
}
