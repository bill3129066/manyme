import { createConfig, http } from 'wagmi'
import { testWallet } from './test-wallet'
import { getDefaultConfig } from '@rainbow-me/rainbowkit'
import { baseSepolia } from './networks'

export { baseSepolia } from './networks'

export function createWagmiConfig() {
  if (process.env.NEXT_PUBLIC_TEST_WALLET === 'true') return createConfig({chains:[baseSepolia],transports:{[baseSepolia.id]:http()},connectors:[testWallet('payer'),testWallet('author')],ssr:true})
  return getDefaultConfig({
    appName: 'ManyMe',
    projectId: process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || 'manyme',
    chains: [baseSepolia],
    ssr: true,
  })
}
