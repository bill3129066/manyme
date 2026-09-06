'use client'
import { useEffect, useRef, useState } from 'react'
import { useAccount, useConfig } from 'wagmi'
import { fetchAgents } from '@/lib/api'
import { prepareBaseWallet } from '@/lib/prepare-wallet'
import { displayError } from '@/lib/presentation'
import { type AnalysisSummary as Summary, purchaseSummary } from '@/lib/paid-summary'
import Markdown from '@/components/Markdown'
import { Icon } from '@/components/Icon'

type Agent = {id: string; name: string}
export function AnalysisSummary({onPaid}: {onPaid: () => void}) {
  const {address} = useAccount()
  const config = useConfig()
  const currentWallet = useRef(address); currentWallet.current = address
  const [agents, setAgents] = useState<Agent[]>([])
  const [selected, setSelected] = useState('')
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState<Summary | null>(null)
  useEffect(() => {
    let live = true
    fetchAgents().then(list => {if(live) {setAgents(list); setSelected(list[0]?.id || '')}})
      .catch(() => {if(live) setError('服務清單暫時讀不到，請重新整理頁面。')})
      .finally(() => {if(live) setLoading(false)})
    return () => {live = false}
  }, [])
  useEffect(() => {setResult(null); setError('')}, [address])
  const buy = async () => {
    if (!address || !selected || busy) return
    const owner = address
    setBusy(true); setError(''); setResult(null)
    try {
      const wallet = await prepareBaseWallet(config)
      if(wallet.account.address.toLowerCase() !== owner.toLowerCase()) throw new Error('錢包已切換，請確認後重新操作。')
      const summary = await purchaseSummary(selected, {
        address:wallet.account.address,
        signTypedData: (data) => wallet.signTypedData({...data, account:wallet.account}),
      })
      if(currentWallet.current === owner) {setResult(summary); onPaid()}
    } catch(e) {
      if(currentWallet.current === owner) setError(displayError(e, '摘要未能取得，請先確認錢包付款紀錄，再決定是否重試。'))
    } finally {setBusy(false)}
  }
  return <section className="wallet-summary" aria-labelledby="summary-title">
    <div>
      <h2 id="summary-title">最近分析摘要</h2>
      <p>選一份服務，花 0.001 USDC 取得最近的分析摘要。</p>
      <p className="field-hint">讀取既有分析，不會開啟計時服務；尚無分析的服務會回傳空結果。</p>
    </div>
    <div>
      <label className="field-label" htmlFor="summary-agent">選擇服務</label>
      <select id="summary-agent" value={selected} disabled={loading || busy || !agents.length}
        onChange={e=>{setSelected(e.target.value);setResult(null);setError('')}}>
        {!agents.length && <option value="">{loading ? '正在讀取服務…' : '目前沒有可查詢的服務'}</option>}
        {agents.map(agent=><option value={agent.id} key={agent.id}>{agent.name}</option>)}
      </select>
      <button className="button-primary" onClick={buy} disabled={!address || !selected || busy || loading}>
        {busy ? '正在確認付款與摘要…' : '付 0.001 USDC，取得摘要'}<Icon />
      </button>
      {!address && <p className="field-hint">先在上方連接錢包，即可付費查詢。</p>}
      {error && <p className="notice" role="alert">{error}</p>}
      {busy && <p role="status" className="field-hint">請在錢包確認本次付款授權。</p>}
    </div>
    {result && <article className="summary-result" aria-live="polite">
      <h3>{result.agentName} · 分析摘要</h3>
      <Markdown>{result.summary === 'No analysis available yet. Start a session to generate insights.' ? '這份服務目前尚無分析摘要。' : result.summary}</Markdown>
      <a className="text-link" href={`https://sepolia.basescan.org/tx/${result.transaction}`} target="_blank" rel="noopener noreferrer">查看付款交易<Icon /></a>
    </article>}
  </section>
}
