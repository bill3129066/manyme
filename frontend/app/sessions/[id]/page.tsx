'use client'
import { useEscrowActions } from '@/lib/escrow-actions'
import { useEffect, useState, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useAccount, useSignMessage } from 'wagmi'
import { signAction } from '@/lib/sign-action'
import Link from 'next/link'
import { Icon } from '@/components/Icon'
import { displayError } from '@/lib/presentation'
import { chatInSession, stopSession, rateAgent, fetchAgent } from '@/lib/agents-api'

import Markdown from '@/components/Markdown'
import type { CostSnapshot } from '@/lib/session-cost'
import SalaryTicker from '@/components/session/SalaryTicker'
import ActivityTrail from '@/components/session/ActivityTrail'
import SettlementDialog from '@/components/session/SettlementDialog'
import StreamStatusBadge from '@/components/session/StreamStatusBadge'
import CostBreakdown from '@/components/session/CostBreakdown'

interface ChatMessage {
  id: string
  role: 'user' | 'model' | 'error'
  text: string
}

interface AgentStep {
  kind: string
  title: string
  body: string
  ts: string
}

interface ProofEvent {
  seq: number
  proofHash: string
  txHash?: string
  ts: string
}

export default function SessionPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const escrow = useEscrowActions()
  const [onchainId, setOnchainId] = useState<number | null>(null)
  const { address } = useAccount()
  const { signMessageAsync } = useSignMessage()

  const [pageError, setPageError] = useState('')
  const [sessionLoading, setSessionLoading] = useState(true)
  const [sessionAvailable, setSessionAvailable] = useState(false)
  const [clearedHistory, setClearedHistory] = useState<ChatMessage[] | null>(null)
  const [serviceName, setServiceName] = useState('服務對話')
  const [status, setStatus] = useState<'active' | 'paused' | 'stopped'>('active')
  const [steps, setSteps] = useState<AgentStep[]>([])
  const [proofs, setProofs] = useState<ProofEvent[]>([])
  const [costSnapshot, setCostSnapshot] = useState<CostSnapshot | null>(null)
  const [accrued, setAccrued] = useState(0)
  const [ratePerSec, setRatePerSec] = useState(0)
  const [curatorRate, setCuratorRate] = useState(0)
  const [platformFee, setPlatformFee] = useState(0)

  const [chatHistory, setChatHistory] = useState<ChatMessage[]>(() => {
    if (typeof window === 'undefined') return []
    try {
      const saved = localStorage.getItem(`chat_${id}`)
      if (!saved) return []
      return JSON.parse(saved).map((m: any) => ({
        ...m,
        id: m.id || crypto.randomUUID(),
      }))
    } catch {
      return []
    }
  })
  const [chatInput, setChatInput] = useState('')
  const [chatLoading, setChatLoading] = useState(false)
  const [isActionLoading, setIsActionLoading] = useState(false)
  const [showReview, setShowReview] = useState(false)
  const [agentId, setAgentId] = useState<string | null>(null)
  const [reviewRating, setReviewRating] = useState(0)
  const [ratingHover, setRatingHover] = useState(0)
  const [ratingSubmitted, setRatingSubmitted] = useState(false)
  const sessionEndRef = useRef<number | null>(null)
  const sessionStartRef = useRef(Date.now())

  const chatBottomRef = useRef<HTMLDivElement>(null)
  const eventSourceRef = useRef<EventSource | null>(null)
  const initialQuerySentRef = useRef(false)
  const isValidSession = !!id && id !== 'new'

  useEffect(() => {
    if (!isValidSession) {
      router.replace('/marketplace')
      return
    }

    const apiBase = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'
    fetch(`${apiBase}/api/sessions/${id}`)
      .then((r) => {
        if (!r.ok) throw new Error('Unable to load session')
        return r.json()
      })
      .then((session: any) => {
        if (session.agent_name) setServiceName(session.agent_name)
        else if (session.agent_id) {
          void fetchAgent(session.agent_id)
            .then((agent) => setServiceName(agent.name || '服務對話'))
            .catch(() => {})
        }
        if (session.ended_at)
          sessionEndRef.current = new Date(
            session.ended_at.replace(' ', 'T') + (session.ended_at.endsWith('Z') ? '' : 'Z'),
          ).getTime()
        if (session.steps?.length) setSteps(session.steps)
        else if (session.executions?.length) {
          setSteps(
            session.executions.flatMap((execution: any) => [
              { kind: 'api', title: 'Execution started', body: '', ts: execution.created_at },
              ...(execution.completed_at
                ? [
                    {
                      kind: 'finding',
                      title: execution.error_message ? '這次回覆未能完成' : 'Complete',
                      body: '',
                      ts: execution.completed_at,
                    },
                  ]
                : []),
            ]),
          )
        }
        if (session.proofs) setProofs(session.proofs)
        if (session.executions?.length && !sessionStorage.getItem(`session_query_${id}`)) {
          const restored: ChatMessage[] = []
          for (const execution of session.executions) {
            const input = JSON.parse(execution.input_json || '{}')
            if (input.message)
              restored.push({ id: execution.id + '-user', role: 'user', text: input.message })
            if (execution.output_text)
              restored.push({
                id: execution.id + '-model',
                role: 'model',
                text: execution.output_text,
              })
            if (execution.error_message)
              restored.push({
                id: execution.id + '-error',
                role: 'error',
                text: execution.error_message,
              })
          }
          setChatHistory(restored)
        }
        setSessionAvailable(true)
        setOnchainId(session.onchain_session_id)
        setAccrued(session.accrued_total || 0)
        setCostSnapshot(session.cost_snapshot || null)
        if (session.total_rate) setRatePerSec(session.total_rate)
        if (session.curator_rate) setCuratorRate(session.curator_rate)
        if (session.platform_fee) setPlatformFee(session.platform_fee)
        if (session.agent_id) setAgentId(session.agent_id)
        if (session.status && ['active', 'paused', 'stopped'].includes(session.status)) {
          setStatus(session.status)
        }
        if (session.started_at) {
          sessionStartRef.current = new Date(session.started_at).getTime()
        }
      })
      .catch(() => setPageError('目前無法讀取這次服務，請重新整理頁面。'))
      .finally(() => setSessionLoading(false))
  }, [isValidSession, id, router])

  useEffect(() => {
    if (!isValidSession || !sessionAvailable || status === 'stopped') return
    const apiBase = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'

    let disposed = false
    let reconnectTimer: ReturnType<typeof setTimeout> | undefined
    const connect = () => {
      if (disposed) return
      const es = new EventSource(`${apiBase}/api/sessions/${id}/stream`)
      eventSourceRef.current = es

      es.addEventListener('connected', () => {
        if (initialQuerySentRef.current) return
        const storageKey = `session_query_${id}`
        const initialQuery = sessionStorage.getItem(storageKey)
        if (!initialQuery) return
        initialQuerySentRef.current = true
        sessionStorage.removeItem(storageKey)

        setChatHistory((prev) => {
          if (prev.some((m) => m.role === 'user')) return prev
          return [{ id: crypto.randomUUID(), role: 'user', text: initialQuery }]
        })
        setChatLoading(true)
        ;(async () => {
          if (!address) throw new Error('Connect your session wallet')
          const auth = await signAction(signMessageAsync, address, 'chat-session', id)
          return chatInSession(id, initialQuery, [], auth)
        })()
          .then(({ reply }) => {
            setChatHistory((prev) => [
              ...prev,
              { id: crypto.randomUUID(), role: 'model', text: reply },
            ])
          })
          .catch((err) => {
            setChatHistory((prev) => [
              ...prev,
              {
                id: crypto.randomUUID(),
                role: 'error',
                text: displayError(err, '回覆未能完成，請結束本次服務並確認結算。'),
              },
            ])
          })
          .finally(() => setChatLoading(false))
      })

      es.addEventListener('step', (e) => {
        const step = JSON.parse(e.data)
        setSteps((prev) => [...prev.slice(-50), step])
      })

      es.addEventListener('proof', (e) => {
        const proof = JSON.parse(e.data)
        setProofs((prev) => [...prev.slice(-20), proof])
      })

      es.addEventListener('status', (e) => {
        const { status: newStatus } = JSON.parse(e.data)
        setStatus(newStatus)
      })

      es.addEventListener('earnings', (e) => {
        const { accrued: newAccrued, cost_snapshot, status: chainStatus } = JSON.parse(e.data)
        if (cost_snapshot) setCostSnapshot(cost_snapshot)
        if (chainStatus) setStatus(chainStatus)
        setAccrued(newAccrued)
      })

      es.addEventListener('chunk', (e) => {
        const { chunk } = JSON.parse(e.data)
        setChatHistory((prev) => {
          const next = [...prev]
          if (next.length > 0 && next[next.length - 1].role === 'model') {
            next[next.length - 1].text += chunk
          } else {
            next.push({ id: crypto.randomUUID(), role: 'model', text: chunk })
          }
          return next
        })
        setChatLoading(false)
      })

      es.addEventListener('complete', () => {
        setChatLoading(false)
      })

      es.addEventListener('error', (e) => {
        // Custom SSE 'error' events carry data; the native EventSource error does not
        const data = (e as MessageEvent).data
        if (!data) return
        const { error } = JSON.parse(data)
        setChatHistory((prev) => [
          ...prev,
          {
            id: crypto.randomUUID(),
            role: 'error',
            text: displayError(error, '回覆未能完成，請結束本次服務並確認結算。'),
          },
        ])
        setChatLoading(false)
      })

      es.onerror = () => {
        es.close()
        reconnectTimer = setTimeout(connect, 3000)
      }
    }

    connect()
    return () => {
      disposed = true
      clearTimeout(reconnectTimer)
      eventSourceRef.current?.close()
    }
  }, [id, isValidSession, sessionAvailable, status, address, signMessageAsync])

  useEffect(() => {
    if (isValidSession && chatHistory.length > 0) {
      localStorage.setItem(`chat_${id}`, JSON.stringify(chatHistory))
    }
    const area = chatBottomRef.current?.parentElement
    if (area) area.scrollTop = area.scrollHeight
  }, [chatHistory, id, isValidSession])

  const handleStop = async () => {
    if (!address) return
    setPageError('')
    setIsActionLoading(true)
    try {
      if (onchainId == null) throw new Error('Session has no on-chain identifier')
      await escrow.stop(onchainId)
      await escrow.refund(onchainId)
      const auth = await signAction(signMessageAsync, address, 'stop-session', id)
      await stopSession(id, auth)
      const apiBase = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'
      const response = await fetch(`${apiBase}/api/sessions/${id}`)
      if (!response.ok) throw new Error('Session stopped; refresh to read final settlement')
      const settled = await response.json()
      if (settled.ended_at)
        sessionEndRef.current = new Date(
          settled.ended_at.replace(' ', 'T') + (settled.ended_at.endsWith('Z') ? '' : 'Z'),
        ).getTime()
      setAccrued(settled.accrued_total)
      setCostSnapshot(settled.cost_snapshot)
      setStatus('stopped')
      eventSourceRef.current?.close()
      setShowReview(true)
    } catch (e: any) {
      setPageError(displayError(e, '結束或退款尚未完成，請確認錢包狀態後再次操作。'))
    } finally {
      setIsActionLoading(false)
    }
  }

  const sessionDuration = () => {
    const secs = Math.floor(
      ((sessionEndRef.current ?? Date.now()) - sessionStartRef.current) / 1000,
    )
    const m = Math.floor(secs / 60)
    const s = secs % 60
    if (m === 0) return `${s}s`
    return `${m}m ${s}s`
  }

  const handleRateAgent = async (stars: number) => {
    if (!address || !agentId) return
    setReviewRating(stars)
    try {
      const auth = await signAction(signMessageAsync, address, 'rate-agent', agentId)
      await rateAgent(agentId, stars, auth)
      setRatingSubmitted(true)
    } catch {
      setReviewRating(0)
      setPageError('評分尚未送出，請稍後再試。')
    }
  }

  async function sendMessage() {
    const text = chatInput.trim()
    if (!text || chatLoading || status !== 'active') return

    const userMsg: ChatMessage = { id: crypto.randomUUID(), role: 'user', text }
    const nextHistory = [...chatHistory, userMsg]
    setChatHistory(nextHistory)
    setChatInput('')
    setChatLoading(true)

    try {
      const geminiHistory = nextHistory
        .slice(0, -1)
        .filter((m): m is ChatMessage & { role: 'user' | 'model' } => m.role !== 'error')
        .map((m) => ({
          role: m.role,
          parts: [{ text: m.text }],
        }))

      if (!address) throw new Error('Connect your session wallet')
      const auth = await signAction(signMessageAsync, address, 'chat-session', id)
      const { reply } = await chatInSession(id, text, geminiHistory, auth)

      setChatHistory((prev) => {
        const next = [...prev]
        if (next.length > 0 && next[next.length - 1].role === 'model') {
          next[next.length - 1].text = reply || next[next.length - 1].text
        } else if (reply) {
          next.push({ id: crypto.randomUUID(), role: 'model', text: reply })
        }
        return next
      })
    } catch (e: any) {
      setChatHistory((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          role: 'error',
          text: displayError(e, '回覆未能完成，請結束本次服務並確認結算。'),
        },
      ])
    } finally {
      setChatLoading(false)
    }
  }

  if (!isValidSession) {
    return null
  }

  return (
    <div className="page-width page-section session-page">
      <nav className="session-destinations" aria-label="服務導覽">
        <Link href="/agents" className="breadcrumb">
          <Icon name="back" />
          探索服務
        </Link>
        <Link href="/sessions" className="text-link">
          我的紀錄
          <Icon />
        </Link>
      </nav>
      <div className="page-heading">
        <div>
          <h1>{serviceName}</h1>
        </div>
        {sessionAvailable && <StreamStatusBadge status={status} />}
      </div>
      {pageError && (
        <div role="alert" className="notice mb-6">
          {pageError}
        </div>
      )}
      {sessionLoading ? (
        <p role="status" className="py-16">
          正在讀取對話與費用紀錄…
        </p>
      ) : !sessionAvailable ? (
        <Link href="/sessions" className="button-secondary">
          查看我的紀錄
        </Link>
      ) : (
        <>
          <div className="session-mobile-cost">
            <span>
              {status === 'stopped' ? '結算費用' : '已確認費用'}：{(accrued / 1e6).toFixed(6)} USDC
            </span>
            {status !== 'stopped' && (
              <button onClick={handleStop} disabled={!address || isActionLoading}>
                {isActionLoading ? '正在結束與退款…' : '結束並結算'}
              </button>
            )}
          </div>
          {showReview && (
            <SettlementDialog onClose={() => setShowReview(false)}>
              <div className="flex flex-wrap justify-between gap-4">
                <div>
                  <h2 id="settlement-title">這回，分身收工。</h2>
                  <p>
                    最終費用 {(accrued / 1e6).toFixed(6)} USDC · 使用時間 {sessionDuration()}
                    。對話仍可在這裡查看。
                  </p>
                </div>
              </div>
              {address && agentId && (
                <div className="mt-4">
                  <p>這次的服務對你有幫助嗎？</p>
                  {pageError && (
                    <p role="alert" className="text-accent">
                      {pageError}
                    </p>
                  )}
                  {ratingSubmitted ? (
                    <p role="status">謝謝，你的 {reviewRating} 分評價已送出。</p>
                  ) : (
                    <div className="rating-buttons">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <button
                          key={star}
                          type="button"
                          aria-label={`評分 ${star} 分`}
                          onClick={() => handleRateAgent(star)}
                          onMouseEnter={() => setRatingHover(star)}
                          onMouseLeave={() => setRatingHover(0)}
                          className={
                            (ratingHover || reviewRating) >= star
                              ? 'text-accent'
                              : 'text-text-secondary'
                          }
                        >
                          ★
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
              <div className="settlement-actions">
                <Link href="/agents" className="button-primary">
                  再找一位神隊友
                  <Icon />
                </Link>
                <Link href="/sessions" className="text-link">
                  查看我的紀錄
                </Link>
              </div>
            </SettlementDialog>
          )}
          <div className="session-layout">
            <section className="session-chat" aria-label="與服務對話">
              <div className="session-chat-header">
                <span>這次的討論</span>
                {clearedHistory ? (
                  <button
                    className="text-link text-xs"
                    onClick={() => {
                      setChatHistory((current) => [...clearedHistory, ...current])
                      setClearedHistory(null)
                    }}
                  >
                    復原清除
                  </button>
                ) : (
                  <button
                    className="text-link text-xs"
                    disabled={!chatHistory.length || chatLoading}
                    onClick={() => {
                      setClearedHistory(chatHistory)
                      setChatHistory([])
                    }}
                  >
                    清除畫面
                  </button>
                )}
              </div>
              <div className="chat-messages" role="log" aria-label="對話內容" aria-live="polite">
                {chatHistory.length === 0 && (
                  <div className="py-12 text-text-secondary">
                    <h2 className="text-xl mb-3 text-text-primary">從你最在意的問題開始。</h2>
                    <p className="text-sm">說明背景、希望達成的事，以及目前遇到的限制。</p>
                  </div>
                )}
                {chatHistory.map((msg) => (
                  <div key={msg.id} className={`chat-message chat-message-${msg.role}`}>
                    <p className="message-speaker">
                      {msg.role === 'user' ? '你' : msg.role === 'error' ? '服務提示' : 'AI 回覆'}
                    </p>
                    {msg.role === 'model' ? (
                      <Markdown>{msg.text}</Markdown>
                    ) : (
                      <p className="whitespace-pre-wrap break-words">{msg.text}</p>
                    )}
                  </div>
                ))}
                {chatLoading && (
                  <p className="text-sm text-text-secondary" role="status">
                    正在整理回覆，請稍候…
                  </p>
                )}
                <div ref={chatBottomRef} />
              </div>
              <form
                className="chat-composer"
                onSubmit={(e) => {
                  e.preventDefault()
                  void sendMessage()
                }}
              >
                <textarea
                  rows={2}
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (
                      e.key === 'Enter' &&
                      !e.shiftKey &&
                      !e.nativeEvent.isComposing &&
                      e.keyCode !== 229
                    ) {
                      e.preventDefault()
                      void sendMessage()
                    }
                  }}
                  placeholder={
                    status === 'stopped'
                      ? '本次服務已結束，可回看對話。'
                      : '補充你的情況，或接著問…'
                  }
                  disabled={chatLoading || status !== 'active'}
                  aria-label="你的訊息"
                />
                <button
                  type="submit"
                  className="button-primary"
                  disabled={chatLoading || !chatInput.trim() || status !== 'active'}
                >
                  {chatLoading ? '回覆中' : '送出'}
                  <Icon />
                </button>
              </form>
            </section>
            <aside className="session-sidebar" aria-label="費用與操作">
              <SalaryTicker
                accrued={accrued}
                ratePerSec={ratePerSec}
                status={status}
                snapshot={costSnapshot}
              />
              {status !== 'stopped' && <p>離開頁面不會停止計費，請按「結束並結算」。</p>}
              {status !== 'stopped' ? (
                <button
                  className="button-secondary"
                  onClick={handleStop}
                  disabled={!address || isActionLoading}
                >
                  {isActionLoading ? '正在結束與退款…' : '結束並結算'}
                </button>
              ) : (
                <button className="button-secondary" onClick={() => setShowReview(true)}>
                  查看結算結果
                  <Icon />
                </button>
              )}
              {!address && status !== 'stopped' && (
                <p>請用本次服務的錢包連接，才能繼續對話或結束服務。</p>
              )}
              <details className="technical-details">
                <summary>費率明細</summary>
                <div>
                  <CostBreakdown curatorRate={curatorRate} platformFee={platformFee} />
                </div>
              </details>
            </aside>
          </div>
          <ActivityTrail
            steps={steps}
            proofs={proofs}
            working={chatLoading}
            stopped={status === 'stopped'}
          />
        </>
      )}
    </div>
  )
}
