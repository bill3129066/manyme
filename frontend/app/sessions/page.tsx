'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useAccount } from 'wagmi'
import { fetchSessions } from '@/lib/api'
import { Icon } from '@/components/Icon'
import { ConnectWalletButton } from '@/components/wallet/ConnectWalletButton'
import { sessionStatusLabel, displayError } from '@/lib/presentation'

const STATUS_STYLES: Record<string, string> = {
  active: 'border border-accent text-accent',
  paused: 'border border-warning text-warning',
  stopped: 'border border-border-strong text-text-tertiary',
}

function formatCost(microUnits: number) {
  return `$${(microUnits / 1_000_000).toFixed(6)}`
}

function formatDuration(createdAt: string, endedAt: string | null) {
  const start = new Date(createdAt).getTime()
  const end = endedAt ? new Date(endedAt).getTime() : Date.now()
  const secs = Math.floor((end - start) / 1000)
  if (secs < 60) return `${secs}s`
  if (secs < 3600) return `${Math.floor(secs / 60)}m ${secs % 60}s`
  return `${Math.floor(secs / 3600)}h ${Math.floor((secs % 3600) / 60)}m`
}

export default function SessionsPage() {
  const { address } = useAccount()
  const [sessions, setSessions] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setSessions([])
    setError(null)
    if (!address) {
      setLoading(false)
      return
    }
    let cancelled = false
    setLoading(true)
    fetchSessions(address)
      .then((rows) => {
        if (!cancelled) setSessions(rows)
      })
      .catch((e: any) => {
        if (!cancelled) setError(displayError(e))
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [address])

  return (
    <div className="page-width page-section">
      <div className="page-heading">
        <div>
          <h1>上次聊到哪，回來接著看。</h1>
          <p>你的服務紀錄與費用，都留在這裡。</p>
        </div>
        <Link href="/agents" className="button-secondary">
          探索其他服務
          <Icon />
        </Link>
      </div>
      {error && (
        <p role="alert" className="notice mb-6">
          {error}
        </p>
      )}
      {!address ? (
        <div className="empty-state">
          <h2>連接錢包，找回你的紀錄。</h2>
          <p>請使用當時開啟服務的錢包。</p>
          <div className="flex justify-center">
            <ConnectWalletButton />
          </div>
        </div>
      ) : loading ? (
        <p role="status" className="py-12">
          正在讀取服務紀錄…
        </p>
      ) : !sessions.length ? (
        <div className="empty-state">
          <h2>還沒有使用紀錄</h2>
          <p>從一份適合你的服務開始，之後就能在這裡回看。</p>
          <Link className="text-link" href="/agents">
            找找適合我的服務
            <Icon />
          </Link>
        </div>
      ) : (
        <div className="history-list">
          {sessions.map((s) => (
            <Link className="history-row" href={`/sessions/${s.id}`} key={s.id}>
              <div>
                <span
                  className={`inline-flex px-3 py-1 text-xs mb-3 ${STATUS_STYLES[s.status] || STATUS_STYLES.stopped}`}
                >
                  {sessionStatusLabel(s.status)}
                </span>
                <h2>{s.agent_name || '服務對話'}</h2>
                <p>
                  {new Date(s.started_at || `${s.created_at.replace(' ', 'T')}Z`).toLocaleString(
                    'zh-TW',
                  )}{' '}
                  · 使用時間{' '}
                  {formatDuration(
                    s.started_at || `${s.created_at.replace(' ', 'T')}Z`,
                    s.ended_at
                      ? `${s.ended_at.replace(' ', 'T')}${s.ended_at.endsWith('Z') ? '' : 'Z'}`
                      : null,
                  )}
                </p>
              </div>
              <div className="history-cost">
                <strong>
                  {s.accrued_total == null
                    ? '尚未取得'
                    : formatCost(s.accrued_total).replace('$', '')}{' '}
                  <small>USDC</small>
                </strong>
                <p>{s.status === 'stopped' ? '最終結算費用' : '鏈上已確認費用'}</p>
                <span className="text-link text-sm mt-3">
                  {s.status === 'stopped' ? '回看對話' : '開啟對話'}
                  <Icon />
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
