import { parseEventLogs, type Hex } from 'viem'
import { publicClient } from './baseClient.js'
import { config } from '../../config.js'
import { manyMeEscrowAbi } from '../../../../shared/abis/ManyMeEscrow.js'

export async function escrowEvent(
  txHash: string,
  eventName: 'AgentRegistered' | 'SessionCreated',
) {
  if (!/^0x[0-9a-fA-F]{64}$/.test(txHash))
    throw new Error('Valid on-chain transaction hash required')
  if (!config.escrowAddress) throw new Error('Escrow is not deployed')
  const receipt = await publicClient.getTransactionReceipt({
    hash: txHash as Hex,
  })
  if (receipt.status !== 'success') throw new Error('Transaction reverted')
  const logs = parseEventLogs({
    abi: manyMeEscrowAbi,
    logs: receipt.logs,
    eventName,
  }).filter(
    (log) => log.address.toLowerCase() === config.escrowAddress.toLowerCase(),
  )
  if (logs.length !== 1)
    throw new Error(`Expected one ${eventName} event from configured escrow`)
  return { ...logs[0].args, receiptBlockNumber: receipt.blockNumber } as any
}
