'use client'
import { useEscrowActions } from '@/lib/escrow-actions'
import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useAccount, useSignMessage } from 'wagmi'
import {
  fetchAgent, createSession, rateAgent, fetchUserRating,
  fetchBalance, depositFunds, fetchAgentStats,
} from '@/lib/agents-api'
import { signAction } from '@/lib/sign-action'
import Link from 'next/link'
import { Icon } from '@/components/Icon'
import { ConnectWalletButton } from '@/components/wallet/ConnectWalletButton'
import { categoryLabel, displayError } from '@/lib/presentation'

interface Agent {
  onchain_agent_id: number | null; id: string; name: string; description: string; category: string
  system_prompt: string; user_prompt_template: string | null
  model: string; temperature: number; max_tokens: number
  input_schema_json: string | null; rate_per_second: number
  run_count: number; avg_rating: number | null
  creator_wallet: string; created_at: string
}

interface InputField { name: string; label: string; type: string; required: boolean }

function parseInputSchema(schemaJson: string | null): InputField[] {
  if (!schemaJson) return []
  try {
    const schema = JSON.parse(schemaJson)
    const props = schema.properties || {}
    const required: string[] = schema.required || []
    return Object.entries(props).map(([name, def]: [string, any]) => ({
      name, label: def.title || ({query:'你的需求', _query:'你的需求'} as Record<string,string>)[name] || name, type: def.type === 'number' ? 'number' : 'text', required: required.includes(name),
    }))
  } catch { return [] }
}

function formatRate(microPerSec: number): string {
  if (microPerSec === 0) return '0 USDC／秒'
  return `${(microPerSec / 1_000_000).toFixed(4)} USDC／秒`
}

export default function AgentDetailPage() {
  const { id } = useParams<{ id: string }>()
  const escrow=useEscrowActions()
  const { address } = useAccount()
  const { signMessageAsync } = useSignMessage()
  const router = useRouter()
  const [agent, setAgent] = useState<Agent | null>(null)
  const [inputs, setInputs] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [balance, setBalance] = useState<number | null>(null)
  const [userRating, setUserRating] = useState<number | null>(null)
  const [ratingHover, setRatingHover] = useState(0)
  const [showRating, setShowRating] = useState(false)
  const [starting, setStarting] = useState(false)
  const [budget,setBudget]=useState('1')

  useEffect(() => {
    if (!id) return
    fetchAgent(id).then(a => { setAgent(a); setLoading(false) }).catch(() => { setError('目前找不到這份服務，請回到列表選擇其他服務。'); setLoading(false) })
  }, [id])

  useEffect(() => {
    setBalance(null)
    if (!address) return
    escrow.balance().then(setBalance).catch(() => {})
    if (id) fetchUserRating(id, address).then(r => setUserRating(r)).catch(() => {})
  }, [address, id])

  const handleStartSession = async () => {
    if (!address || !agent) return
    setError('')
    setStarting(true)
    try {
      if(agent.onchain_agent_id==null)throw new Error('這份服務尚未完成鏈上登記，目前無法開始使用。請選擇其他服務。')
      const deposit=Math.round(Number(budget)*1000000)
      if(!Number.isFinite(deposit)||deposit<100000||deposit>10000000)throw new Error('請設定 0.1 至 10 test USDC 的服務預算。')
      await escrow.prepare()
      const auth = await signAction(signMessageAsync, address, 'create-session')
      const txHash=await escrow.create(agent.onchain_agent_id,deposit)
      const session = await createSession(agent.id, inputs, auth, txHash)
      const queryText = inputs._query || inputs.query || Object.values(inputs).join(' ')
      if (queryText) {
        sessionStorage.setItem(`session_query_${session.id}`, queryText)
      }
      router.push(`/sessions/${session.id}`)
    } catch (e: any) {
      setError(displayError(e, '服務尚未開始，請確認錢包操作後再試。'))
      setStarting(false)
    }
  }

  const handleRate = async (rating: number) => {
    if (!address || !id) return
    try {
      const auth = await signAction(signMessageAsync, address, 'rate-agent', id)
      const result = await rateAgent(id, rating, auth)
      setUserRating(rating)
      if (agent) setAgent({ ...agent, avg_rating: result.avg_rating })
    } catch (e) { setError(displayError(e, '評分尚未送出，請再試一次。')) }
  }

  if (loading) return <div className="page-width page-section" role="status">正在載入服務介紹…</div>
  if (!agent) return <div className="page-width page-section"><div className="empty-state"><h1 className="text-2xl mb-4">{error || '目前找不到這份服務'}</h1><Link href="/agents" className="text-link">回到服務列表<Icon name="back" /></Link></div></div>
  const fields = parseInputSchema(agent.input_schema_json)
  return <div className="page-width page-section">
    <Link href="/agents" className="breadcrumb"><Icon name="back" />回到服務列表</Link>
    <div className="detail-layout">
      <div className="detail-intro">
        <h1>{agent.name}</h1><p className="detail-description">{agent.description}</p>
        <div className="detail-facts"><span>{categoryLabel(agent.category)}</span><span>{agent.run_count} 次使用</span><span>{agent.avg_rating ? `評分 ${agent.avg_rating.toFixed(1)} / 5` : '尚無評價'}</span></div>
        <div className="detail-explainer"><h2>從你的情況開始，接著問下去。</h2><p>這份服務由提供者設定方法與內容，AI 依照設定回應。說明你想處理的問題、已知條件，使用中也可以繼續補充與追問。</p></div>
        <div className="detail-explainer"><h2>費用，你可以先設上限。</h2><p>服務費率為 <strong className="text-text-primary">{formatRate(agent.rate_per_second)}</strong>。開始後依使用計費，結束時由合約結算，未用完的預算退回錢包。請在離開前結束服務。</p></div>
        <details className="technical-details"><summary>查看提供者與技術設定</summary><div className="space-y-3 break-words"><p>提供者錢包：<span className="font-mono text-xs break-all">{agent.creator_wallet}</span></p><p>AI 模型：{agent.model}</p><p>回應變化程度（Temperature）：{agent.temperature}</p><p>回覆長度上限：{agent.max_tokens} tokens</p></div></details>
        {address && <div className="mt-6">{showRating ? <div><span className="text-sm">你覺得這份服務如何？</span><div className="rating-buttons">{[1,2,3,4,5].map(star=><button type="button" key={star} aria-label={`${star} 分`} aria-pressed={userRating===star} onClick={()=>handleRate(star)} onMouseEnter={()=>setRatingHover(star)} onMouseLeave={()=>setRatingHover(0)} className={(ratingHover||userRating||0)>=star?'text-accent':'text-text-tertiary'}>★</button>)}</div>{userRating && <p role="status" className="text-sm text-text-secondary">已收到你的 {userRating} 分評價。</p>}<button className="text-link text-sm" onClick={()=>setShowRating(false)}>收起評分</button></div>:<button className="text-link text-sm" onClick={()=>setShowRating(true)}>{userRating?`你的評分：${userRating} / 5`:'留下你的評分'}</button>}</div>}
      </div>
      <form className="service-form" onSubmit={e=>{e.preventDefault();void handleStartSession()}}>
        <h2>這次，想解決什麼？</h2><p>說得具體一點，服務才能從你的情況出發。</p>
        {fields.length ? fields.map(field=><div className="form-group" key={field.name}><label htmlFor={`field-${field.name}`} className="field-label">{field.label}{field.required && <span className="text-accent text-xs ml-2">必填</span>}</label><input className="field-input" id={`field-${field.name}`} type={field.type} required={field.required} value={inputs[field.name]||''} onChange={e=>setInputs(prev=>({...prev,[field.name]:e.target.value}))} /></div>) : <div className="form-group"><label htmlFor="field-query" className="field-label">你的需求<span className="text-accent text-xs ml-2">必填</span></label><textarea id="field-query" required className="field-input" value={inputs._query||''} onChange={e=>setInputs({_query:e.target.value})} rows={5} placeholder="我想要…，目前的情況是…，最在意的是…" /><p className="field-hint">可以補充背景、限制，以及希望服務幫你釐清的問題。</p></div>}
        <div className="form-group border-t border-border-strong pt-6"><label className="field-label" htmlFor="session-budget">本次服務預算上限</label><div className="budget-field"><input id="session-budget" type="number" required min="0.1" max="10" step="0.1" value={budget} onChange={e=>setBudget(e.target.value)} /><span>test USDC</span></div><p className="field-hint">可設定 0.1–10 test USDC。這是使用服務的預算，未使用金額於結束時退回。</p>{balance!==null && <p className="field-hint">錢包可用餘額：{(balance/1e6).toFixed(4)} test USDC</p>}</div>
        {!address && <div className="form-group"><p className="field-label">連接錢包，再確認開始</p><ConnectWalletButton /></div>}
        {error && <p role="alert" className="notice mt-5">{error}</p>}
        <button type="submit" className="button-primary" disabled={!address||starting}>{starting?'正在確認錢包與建立服務…':'確認預算，開始使用'}{!starting&&<Icon />}</button>
        <p className="field-hint mt-4" role="status">{starting?'請依錢包提示完成簽署與交易，完成後會進入對話。':'目前使用 Base Sepolia 測試網。開始時需透過錢包授權並存入本次預算。'}</p>
      </form>
    </div>
  </div>
}
