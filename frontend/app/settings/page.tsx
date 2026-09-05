'use client'

import Link from 'next/link'
import { useAccount, useReadContract } from 'wagmi'
import { erc20Abi, formatUnits } from 'viem'
import { getNetworkConfig } from '@/lib/networks'

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
    <div className="page-width page-section space-y-8 max-w-3xl">
      <h1 className="font-display text-4xl font-bold">錢包與服務預算</h1>
      <section className="space-y-3">
        <h2 className="font-display text-2xl font-semibold">目前使用的錢包</h2>
        {address ? (
          <>
            <p className="font-mono text-sm break-all">{address}</p>
            <p>
              {balance.isError
                ? '目前無法讀取餘額，請重新整理。'
                : balance.data === undefined
                  ? '正在讀取餘額…'
                  : `${formatUnits(balance.data, 6)} USDC`}
            </p>
            <button className="underline" onClick={() => balance.refetch()}>
              重新讀取餘額
            </button>
          </>
        ) : (
          <p>請開啟右上方「我的錢包」完成連接。</p>
        )}
      </section>
      <section className="space-y-3">
        <h2 className="font-display text-2xl font-semibold">每次開始前，先確認預算</h2>
        <p>
          選擇服務、填寫需求，再設定這次最多願意花多少 test USDC。開始時，錢包會要求授權
          USDC，並將這筆預算存入服務合約。
        </p>
        <p>
          按下「結束並結算」，完成操作後停止計費，未使用的 USDC
          會退回錢包。想休息時，請先結束服務；下次需要時再開啟新的服務。關閉分頁不等於結束計費。
        </p>
        <Link className="inline-block underline" href="/agents">
          探索服務 →
        </Link>
      </section>
      <Link className="inline-block underline" href="/sessions">
        查看使用紀錄 →
      </Link>
    </div>
  )
}
