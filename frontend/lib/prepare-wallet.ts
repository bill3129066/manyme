import type { Config } from 'wagmi'
import { getAccount, getWalletClient, switchChain } from 'wagmi/actions'
import { baseSepolia } from 'viem/chains'

/** Resolve the connected provider at action time, after switching the actual wallet. */
export async function prepareBaseWallet(config: Config) {
  const { address, connector } = getAccount(config)
  if (!address || !connector) throw new Error('Connect a wallet to continue')
  if (await connector.getChainId() !== baseSepolia.id) {
    await switchChain(config, { chainId: baseSepolia.id, connector })
  }
  if (await connector.getChainId() !== baseSepolia.id) {
    throw new Error('Switch your wallet to Base Sepolia to continue')
  }
  return getWalletClient<Config, number>(config, { chainId: baseSepolia.id, connector, account: address })
}
