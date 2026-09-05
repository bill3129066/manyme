'use client'

import Link from 'next/link'
import { useAccount, useReadContract } from 'wagmi'
import { erc20Abi, formatUnits } from 'viem'
import { getNetworkConfig } from '@/lib/networks'
import { ConnectWalletButton } from '@/components/wallet/ConnectWalletButton'

export default function SettingsPage() {
  const { address } = useAccount()
  const network = getNetworkConfig(84532)
  const balance = useReadContract({
    chainId: 84532,
    address: network.usdcAddress,
    abi: erc20Abi,
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
    query: { enabled: Boolean(address) },
  })
  return (
    <div className="page-width page-section wallet-page">
      <h1>我的錢包</h1>
      {address ? (
        <section className="wallet-overview" aria-label="錢包餘額">
          <p>可用餘額 · Base Sepolia 測試網</p>
          <div className="wallet-balance" role="status">
            {balance.isError
              ? '餘額暫時讀不到'
              : balance.data === undefined
                ? '讀取中…'
                : formatUnits(balance.data, 6)}
            {balance.data !== undefined && !balance.isError && <span>test USDC</span>}
          </div>
          <p className="wallet-address">{address}</p>
          <div className="wallet-controls">
            <button
              className="text-link"
              disabled={balance.isFetching}
              onClick={() => balance.refetch()}
            >
              {balance.isFetching ? '更新中…' : '更新餘額'}
            </button>
            <ConnectWalletButton />
          </div>
        </section>
      ) : (
        <section className="wallet-overview">
          <h2>錢包連上，帳就清楚。</h2>
          <p>連接自己的錢包，查看可用餘額與使用紀錄。</p>
          <ConnectWalletButton />
        </section>
      )}
      <div className="wallet-destinations">
        <Link href="/agents" className="button-primary">
          探索服務 →
        </Link>
        {address && (
          <Link href="/sessions" className="text-link">
            查看使用紀錄 →
          </Link>
        )}
      </div>
    </div>
  )
}
