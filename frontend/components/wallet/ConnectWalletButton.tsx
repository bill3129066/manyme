'use client'
import { ConnectButton } from '@rainbow-me/rainbowkit'
import { useConnect, useAccountEffect, useAccount, useDisconnect, useSwitchChain } from 'wagmi'
import { displayError } from '@/lib/presentation'
import { clearAuthSession } from '@/lib/sign-action'
export function ConnectWalletButton() {
  useAccountEffect({ onDisconnect: () => clearAuthSession() })
  const { connect, connectors, error, isPending } = useConnect()
  const { isConnected, address, chainId } = useAccount()
  const { switchChain, error: switchError, isPending: switching } = useSwitchChain()
  const { disconnect } = useDisconnect()
  if (process.env.NEXT_PUBLIC_TEST_WALLET !== 'true')
    return (
      <ConnectButton
        label="連接錢包"
        accountStatus="address"
        chainStatus="icon"
        showBalance={false}
      />
    )
  return (
    <div className="flex flex-wrap items-center gap-3 text-sm">
      {isConnected ? (
        <button onClick={() => disconnect()}>
          {address?.slice(0, 6)}…{address?.slice(-4)} · 中斷連接
        </button>
      ) : (
        connectors.map((connector) => (
          <button
            key={connector.id}
            disabled={isPending}
            onClick={() => connect({ connector, chainId: 84532 })}
            className="border border-border-subtle px-3 py-2 disabled:opacity-50"
          >
            {connector.name.includes('payer')
              ? '連接測試使用者錢包'
              : connector.name.includes('author')
                ? '連接測試提供者錢包'
                : connector.id === 'injected'
                  ? '連接自己的錢包（MetaMask 等）'
                  : `連接 ${connector.name}`}
          </button>
        ))
      )}
      {isConnected &&
        (chainId === 84532 ? (
          <span>Base Sepolia</span>
        ) : (
          <button disabled={switching} onClick={() => switchChain({ chainId: 84532 })}>
            {switching ? '正在切換網路…' : '切換至 Base Sepolia'}
          </button>
        ))}
      {(error || switchError) && (
        <span role="alert">
          {displayError(error || switchError, '錢包連接未完成，請再試一次。')}
        </span>
      )}
    </div>
  )
}
