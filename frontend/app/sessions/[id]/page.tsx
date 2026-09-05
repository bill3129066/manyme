'use client'
import { useEscrowActions } from '@/lib/escrow-actions'
import { useEffect, useState, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useAccount, useSignMessage } from 'wagmi'
import { signAction } from '@/lib/sign-action'
import Link from 'next/link'
import { Icon } from '@/components/Icon'
import { displayError } from '@/lib/presentation'
import { chatInSession, stopSession, rateAgent } from '@/lib/agents-api'

import Markdown from '@/components/Markdown'
import type { CostSnapshot } from '@/lib/session-cost'
import SalaryTicker from '@/components/session/SalaryTicker'
import ProofHeartbeatTimeline from '@/components/session/ProofHeartbeatTimeline'
import AgentWorkTimeline from '@/components/session/AgentWorkTimeline'
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
  const escrow=useEscrowActions()
  const [onchainId,setOnchainId]=useState<number|null>(null)
  const { address } = useAccount()
  const { signMessageAsync } = useSignMessage()

  const [pageError, setPageError] = useState('')
  const [sessionLoading,setSessionLoading] = useState(true)
  const [clearedHistory,setClearedHistory] = useState<ChatMessage[]|null>(null)
  const [serviceName,setServiceName] = useState('服務對話')
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
        id: m.id || crypto.randomUUID()
      }))
    } catch { return [] }
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
  
  const [toolCallCount, setToolCallCount] = useState(0)
  interface ToolActivityItem {
    id: string
    name: string
  }
  const [toolActivity, setToolActivity] = useState<ToolActivityItem[]>([])

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
      .then(r => { if(!r.ok) throw new Error('Unable to load session'); return r.json() })
      .then((session: any) => {
        if (session.agent_name) setServiceName(session.agent_name)
        if (session.ended_at) sessionEndRef.current = new Date(session.ended_at.replace(' ', 'T') + (session.ended_at.endsWith('Z') ? '' : 'Z')).getTime()
        if (session.steps) setSteps(session.steps)
        if (session.proofs) setProofs(session.proofs)
        if (session.executions?.length && !sessionStorage.getItem(`session_query_${id}`)) {
          const restored: ChatMessage[] = []
          for (const execution of session.executions) {
            const input = JSON.parse(execution.input_json || '{}')
            if (input.message) restored.push({id: execution.id + '-user', role:'user', text:input.message})
            if (execution.output_text) restored.push({id:execution.id + '-model',role:'model',text:execution.output_text})
            if (execution.error_message) restored.push({id:execution.id + '-error',role:'error',text:execution.error_message})
          }
          setChatHistory(restored)
        }
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
    if (!isValidSession) return
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

        setChatHistory(prev => {
          if (prev.some(m => m.role === 'user')) return prev
          return [{ id: crypto.randomUUID(), role: 'user', text: initialQuery }]
        })
        setChatLoading(true)

        ;(async()=>{if(!address)throw new Error('Connect your session wallet'); const auth=await signAction(signMessageAsync,address,'chat-session',id);return chatInSession(id,initialQuery,[],auth)})()
          .then(({ reply, toolCallCount: tc }) => {
            setChatHistory(prev => [...prev, { id: crypto.randomUUID(), role: 'model', text: reply }])
            if (tc) setToolCallCount(prev => prev + tc)
          })
          .catch((err) => {
            setChatHistory(prev => [...prev, { id: crypto.randomUUID(), role: 'error', text: displayError(err, '回覆未能完成，請結束本次服務並確認結算。') }])
          })
          .finally(() => setChatLoading(false))
      })

      es.addEventListener('step', (e) => {
        const step = JSON.parse(e.data)
        setSteps(prev => [...prev.slice(-50), step])
      })

      es.addEventListener('proof', (e) => {
        const proof = JSON.parse(e.data)
        setProofs(prev => [...prev.slice(-20), proof])
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
        setChatHistory(prev => {
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

      es.addEventListener('tool_use', (e) => {
        const tool = JSON.parse(e.data)
        setToolActivity(prev => [...prev.slice(-9), { id: crypto.randomUUID(), name: tool.name }])
        setToolCallCount(prev => prev + 1)
      })

      es.addEventListener('tool_result', () => {})

      es.addEventListener('complete', () => {
        setChatLoading(false)
      })

      es.addEventListener('error', (e) => {
        // Custom SSE 'error' events carry data; the native EventSource error does not
        const data = (e as MessageEvent).data
        if (!data) return
        const { error } = JSON.parse(data)
        setChatHistory(prev => [...prev, { id: crypto.randomUUID(), role: 'error', text: displayError(error, '回覆未能完成，請結束本次服務並確認結算。') }])
        setChatLoading(false)
      })

      es.onerror = () => {
        es.close()
        reconnectTimer = setTimeout(connect, 3000)
      }
    }

    connect()
    return () => { disposed = true; clearTimeout(reconnectTimer); eventSourceRef.current?.close() }
  }, [id, isValidSession, address, signMessageAsync])

  useEffect(() => {
    if (isValidSession && chatHistory.length > 0) {
      localStorage.setItem(`chat_${id}`, JSON.stringify(chatHistory))
    }
    const area = chatBottomRef.current?.parentElement
    if(area) area.scrollTop = area.scrollHeight
  }, [chatHistory, id, isValidSession])

  const handleStop = async () => {
    if (!address) return
    setPageError('')
    setIsActionLoading(true)
    try {
      if(onchainId==null)throw new Error('Session has no on-chain identifier')
      await escrow.stop(onchainId)
      await escrow.refund(onchainId)
      const auth = await signAction(signMessageAsync, address, 'stop-session', id)
      await stopSession(id, auth)
      const apiBase = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'
      const response = await fetch(`${apiBase}/api/sessions/${id}`)
      if (!response.ok) throw new Error('Session stopped; refresh to read final settlement')
      const settled = await response.json()
      if (settled.ended_at) sessionEndRef.current = new Date(settled.ended_at.replace(' ', 'T') + (settled.ended_at.endsWith('Z') ? '' : 'Z')).getTime()
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

  // Close escrow after a failed generation; the backend also stops proof renewal.
  const failureCloseAttempted = useRef(false)
  const hasChatError = chatHistory.some(message => message.role === 'error')
  useEffect(() => {
    if (!hasChatError || status === 'stopped' || !address || onchainId == null || failureCloseAttempted.current) return
    failureCloseAttempted.current = true
    void handleStop()
  }, [hasChatError, status, address, onchainId])

  const sessionDuration = () => {
    const secs = Math.floor(((sessionEndRef.current ?? Date.now()) - sessionStartRef.current) / 1000)
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
      const geminiHistory = nextHistory.slice(0, -1).filter((m): m is ChatMessage & { role: 'user' | 'model' } => m.role !== 'error').map(m => ({
        role: m.role,
        parts: [{ text: m.text }],
      }))
      
      if(!address)throw new Error('Connect your session wallet')
      const auth=await signAction(signMessageAsync,address,'chat-session',id)
      const { reply, toolCallCount: newToolCount } = await chatInSession(id, text, geminiHistory,auth)
      
      setChatHistory(prev => {
        const next = [...prev]
        if (next.length > 0 && next[next.length - 1].role === 'model') {
          next[next.length - 1].text = reply || next[next.length - 1].text
        } else if (reply) {
          next.push({ id: crypto.randomUUID(), role: 'model', text: reply })
        }
        return next
      })
      
      if (newToolCount) {
        setToolCallCount(prev => prev + newToolCount)
      }
    } catch (e: any) {
      setChatHistory(prev => [...prev, { id: crypto.randomUUID(), role: 'error', text: displayError(e, '回覆未能完成，請結束本次服務並確認結算。') }])
    } finally {
      setChatLoading(false)
    }
  }

  if (!isValidSession) {
    return null
  }

  return <div className="page-width page-section session-page">
    <Link href="/sessions" className="breadcrumb"><Icon name="back" />回到我的紀錄</Link>
    <div className="page-heading"><div><h1>{serviceName}</h1><p>說說你的情況，也可以接著補充與追問。</p></div>{!sessionLoading&&<StreamStatusBadge status={status} />}</div>
    {pageError&&<div role="alert" className="notice mb-6">{pageError}</div>}
    {sessionLoading ? <p role="status" className="py-16">正在讀取對話與費用紀錄…</p> : <>
    <div className="session-mobile-cost"><span>{status==='stopped'?'結算費用':'已確認費用'}：{(accrued/1e6).toFixed(4)} USDC</span>{status!=='stopped'&&<button onClick={handleStop} disabled={!address||isActionLoading}>{isActionLoading?'正在結束與退款…':'結束並結算'}</button>}</div>
    {showReview&&<section className="notice mb-6" aria-label="結算結果"><div className="flex flex-wrap justify-between gap-4"><div><h2 className="text-xl font-semibold">這次服務已結束，結算完成。</h2><p>最終費用 {(accrued/1e6).toFixed(4)} USDC · 使用時間 {sessionDuration()}。對話仍可在這裡查看。</p></div><button onClick={()=>setShowReview(false)}>收起</button></div>{address&&agentId&&<div className="mt-4"><p>這次的服務對你有幫助嗎？</p>{ratingSubmitted?<p role="status">謝謝，你的 {reviewRating} 分評價已送出。</p>:<div className="rating-buttons">{[1,2,3,4,5].map(star=><button key={star} type="button" aria-label={`評分 ${star} 分`} onClick={()=>handleRateAgent(star)} onMouseEnter={()=>setRatingHover(star)} onMouseLeave={()=>setRatingHover(0)} className={(ratingHover||reviewRating)>=star?'text-accent':'text-text-secondary'}>★</button>)}</div>}</div>}</section>}
    <div className="session-layout">
      <section className="session-chat" aria-label="與服務對話">
        <div className="session-chat-header"><span>這次的討論</span>{clearedHistory?<button className="text-link text-xs" onClick={()=>{setChatHistory(clearedHistory);setClearedHistory(null)}}>復原清除</button>:<button className="text-link text-xs" disabled={!chatHistory.length||chatLoading} onClick={()=>{setClearedHistory(chatHistory);setChatHistory([])}}>清除畫面</button>}</div>
        <div className="chat-messages" role="log" aria-label="對話內容" aria-live="polite">
          {chatHistory.length===0&&<div className="py-12 text-text-secondary"><h2 className="text-xl mb-3 text-text-primary">從你最在意的問題開始。</h2><p className="text-sm">說明背景、希望達成的事，以及目前遇到的限制。</p></div>}
          {chatHistory.map(msg=><div key={msg.id} className={`chat-message chat-message-${msg.role}`}><p className="message-speaker">{msg.role==='user'?'你':msg.role==='error'?'服務提示':'AI 回覆'}</p>{msg.role==='model'?<Markdown>{msg.text}</Markdown>:<p className="whitespace-pre-wrap break-words">{msg.text}</p>}</div>)}
          {chatLoading&&<p className="text-sm text-text-secondary" role="status">正在整理回覆，請稍候…</p>}<div ref={chatBottomRef} />
        </div>
        <form className="chat-composer" onSubmit={e=>{e.preventDefault();void sendMessage()}}><textarea rows={2} value={chatInput} onChange={e=>setChatInput(e.target.value)} onKeyDown={e=>{if(e.key==='Enter'&&!e.shiftKey&&!e.nativeEvent.isComposing&&e.keyCode!==229){e.preventDefault();void sendMessage()}}} placeholder={status==='stopped'?'本次服務已結束，可回看對話。':'補充你的情況，或接著問…'} disabled={chatLoading||status!=='active'} aria-label="你的訊息" /><button type="submit" className="button-primary" disabled={chatLoading||!chatInput.trim()||status!=='active'}>{chatLoading?'回覆中':'送出'}<Icon /></button></form>
      </section>
      <aside className="session-sidebar" aria-label="費用與操作"><SalaryTicker accrued={accrued} ratePerSec={ratePerSec} status={status} snapshot={costSnapshot} /><p>畫面費用為估算，最終以合約結算為準。離開頁面不等於結束服務。</p>{status!=='stopped'?<button className="button-secondary" onClick={handleStop} disabled={!address||isActionLoading}>{isActionLoading?'正在結束與退款…':'結束並結算'}</button>:<Link href="/agents" className="button-secondary">探索其他服務<Icon /></Link>}{!address&&status!=='stopped'&&<p>請用本次服務的錢包連接，才能繼續對話或結束服務。</p>}<details className="technical-details"><summary>費率明細</summary><div><CostBreakdown curatorRate={curatorRate} platformFee={platformFee} /></div></details></aside>
    </div>
    <details className="technical-details"><summary>工作紀錄與鏈上活動</summary><div className="grid grid-cols-1 md:grid-cols-2 gap-6"><AgentWorkTimeline steps={steps} /><ProofHeartbeatTimeline proofs={proofs} /><p className="text-sm text-text-secondary md:col-span-2">活動證明記錄服務活動，不代表回覆內容已經查證。工具呼叫 {toolCallCount} 次。服務編號：<span className="break-all">{id}</span></p>{toolActivity.length>0&&<p className="text-xs break-words">最近使用的工具：{toolActivity.map(t=>t.name).join('、')}</p>}</div></details>
    </>}
  </div>
}
