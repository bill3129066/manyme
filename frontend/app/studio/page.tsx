'use client'
import { useEffect, useState } from 'react'
import { PLATFORM_FEE } from '@/lib/utils'
import { signAction } from '@/lib/sign-action'
import { useAccount, useSignMessage } from 'wagmi'
import Link from 'next/link'
import { fetchAgents } from '@/lib/agents-api'
import { Icon } from '@/components/Icon'
import { ConnectWalletButton } from '@/components/wallet/ConnectWalletButton'
import { categoryLabel, displayError } from '@/lib/presentation'

export default function StudioPage() {
  const { address } = useAccount()
  const [agents, setAgents] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const { signMessageAsync } = useSignMessage()
  const [earnings, setEarnings] = useState<{
    totalEarned: number
    pendingPayout: number
    sessions: any[]
  }>({ totalEarned: 0, pendingPayout: 0, sessions: [] })
  const [payoutPending, setPayoutPending] = useState(false)
  const [error, setError] = useState('')
  const [payoutTx, setPayoutTx] = useState('')
  const api = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'
  async function refreshEarnings(wallet: string) {
    const response = await fetch(`${api}/api/curator/${wallet}/earnings`)
    if (!response.ok) throw new Error('Unable to load earnings')
    setEarnings(await response.json())
  }
  async function claimPayout() {
    if (!address) return
    setPayoutPending(true)
    setError('')
    try {
      const auth = await signAction(signMessageAsync, address, 'payout')
      const response = await fetch(`${api}/api/curator/payout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...auth },
        body: '{}',
      })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error || 'Payout failed')
      setPayoutTx(result.txHash)
      await refreshEarnings(address)
    } catch (e: any) {
      setError(displayError(e, '目前無法取得收益或完成領款，請稍後再試。'))
    } finally {
      setPayoutPending(false)
    }
  }

  useEffect(() => {
    if (!address) {
      setLoading(false)
      setAgents([])
      setEarnings({ totalEarned: 0, pendingPayout: 0, sessions: [] })
      return
    }
    setLoading(true)
    refreshEarnings(address).catch((e) =>
      setError(displayError(e, '目前無法取得收益或完成領款，請稍後再試。')),
    )
    fetchAgents({ creator: address })
      .then(setAgents)
      .catch((e) => setError(displayError(e)))
      .finally(() => setLoading(false))
  }, [address])

  const totalEarned = earnings.totalEarned / 1000000
  const pendingPayout = earnings.pendingPayout / 1000000

  return (
    <div className="page-width page-section">
      <div className="page-heading">
        <div>
          <h1>達人工作室</h1>
          <p>照顧你的服務，也看看經驗帶來的回饋與收入。</p>
        </div>
        <Link href="/agents/new" className="button-primary">
          上架我的服務
          <Icon name="plus" />
        </Link>
      </div>
      {!address ? (
        <div className="empty-state">
          <h2>歡迎回來，連接你的錢包。</h2>
          <p>使用上架時的錢包，查看服務與可領收入。</p>
          <div className="flex justify-center">
            <ConnectWalletButton />
          </div>
        </div>
      ) : (
        <>
          <div className="flex flex-wrap gap-4 items-center text-sm mb-8">
            <span className="text-text-secondary">目前使用的錢包</span>
            <span className="font-mono break-all">{address}</span>
            <button
              className="text-link text-sm"
              onClick={() =>
                navigator.clipboard
                  .writeText(address)
                  .catch(() => setError('無法複製，請選取錢包地址自行複製。'))
              }
            >
              複製地址
            </button>
          </div>
          {error && (
            <div role="alert" className="notice mb-6">
              {error}
            </div>
          )}
          {payoutTx && (
            <p role="status" className="mb-6 text-success">
              收入已領取。
              <a
                className="underline ml-2"
                href={`https://sepolia.basescan.org/tx/${payoutTx}`}
                target="_blank"
                rel="noreferrer"
              >
                查看交易明細
              </a>
            </p>
          )}
          <div className="studio-summary">
            <div>
              <h2>累積收入</h2>
              <p>
                {totalEarned.toFixed(6)}
                <small>USDC</small>
              </p>
            </div>
            <div>
              <h2>上架中的服務</h2>
              <p>
                {agents.filter((a) => a.active).length}
                <small>共 {agents.length} 份</small>
              </p>
            </div>
            <div>
              <h2>目前可領收入</h2>
              <p>
                {pendingPayout.toFixed(6)}
                <small>USDC</small>
              </p>
              <button
                className="button-secondary mt-4"
                disabled={pendingPayout <= 0 || payoutPending}
                onClick={claimPayout}
              >
                {payoutPending ? '正在確認領款…' : '領取收入'}
              </button>
            </div>
          </div>
          <p className="field-hint mb-12">
            付費服務結束後，收入才會列入可領金額。你的費率為零時不產生收入；平台費不計入你的收益。
          </p>
          <div className="page-heading">
            <div>
              <h2 className="text-2xl font-semibold">你上架的服務</h2>
              <p>查看服務介紹、費率與使用情況。</p>
            </div>
          </div>
          {loading ? (
            <p role="status" className="py-12">
              正在載入服務…
            </p>
          ) : !agents.length ? (
            <div className="empty-state">
              <h2>你的第一份服務，從這裡開始。</h2>
              <p>把熟悉的方法整理出來，讓需要的人找到。</p>
              <Link className="text-link" href="/agents/new">
                上架我的服務
                <Icon />
              </Link>
            </div>
          ) : (
            <div>
              {agents.map((agent) => (
                <Link className="service-row" href={`/agents/${agent.id}`} key={agent.id}>
                  <span className="service-monogram" aria-hidden="true">
                    {agent.name.slice(0, 1)}
                  </span>
                  <div>
                    <div className="service-category">
                      {categoryLabel(agent.category)} · {agent.active ? '上架中' : '未啟用'}
                    </div>
                    <h2>{agent.name}</h2>
                    <p>{agent.description}</p>
                    <div className="service-meta">
                      <span>
                        使用費率 {((agent.rate_per_second || 0) / 1e6).toFixed(6)} USDC／秒
                      </span>
                      <span>
                        累積收入{' '}
                        {(
                          earnings.sessions
                            .filter((s) => s.agent_id === agent.id)
                            .reduce((total, s) => total + s.earned_amount, 0) / 1e6
                        ).toFixed(6)}{' '}
                        USDC
                      </span>
                    </div>
                    {agent.rate_per_second === PLATFORM_FEE && (
                      <p className="field-hint">提供者費率為零，這份服務不產生可領收入。</p>
                    )}
                  </div>
                  <div className="service-price">
                    <span className="text-link">
                      查看服務
                      <Icon />
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}
