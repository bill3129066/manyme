'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useAccount } from 'wagmi'
import { fetchAgents } from '@/lib/agents-api'
import { categoryLabel, displayError } from '@/lib/presentation'
import { Icon } from '@/components/Icon'

interface Agent { id:string|number; name:string; description:string; category:string; rate_per_second:number; creator_wallet:string; avg_rating:number|null; run_count:number }
const CATEGORIES = ['all','general','research','defi','trading','nft','security']
export default function AgentsPage() {
  const { address } = useAccount()
  const [agents,setAgents] = useState<Agent[]>([])
  const [loading,setLoading] = useState(true)
  const [category,setCategory] = useState('all')
  const [search,setSearch] = useState('')
  const [tab,setTab] = useState<'all'|'mine'>('all')
  const [error,setError] = useState('')
  const [retry,setRetry] = useState(0)
  useEffect(() => {
    let cancelled=false
    setLoading(true); setError('')
    const timer=setTimeout(() => {
      fetchAgents({category:category==='all'?undefined:category,q:search.trim()||undefined})
        .then(rows => {if(!cancelled)setAgents(rows)})
        .catch(e => {if(!cancelled)setError(displayError(e))})
        .finally(() => {if(!cancelled)setLoading(false)})
    },200)
    return () => {cancelled=true;clearTimeout(timer)}
  },[category,search,retry])
  const displayed=tab==='mine' ? agents.filter(a=>address && a.creator_wallet?.toLowerCase()===address.toLowerCase()) : agents
  return <div className="page-width page-section">
    <div className="page-heading"><div><h1>找一份，適合你的經驗。</h1><p>從眼前的問題出發，看看哪份服務能陪你釐清下一步。</p></div><div className="market-tabs" aria-label="服務範圍"><button type="button" aria-pressed={tab==='all'} onClick={()=>setTab('all')}>探索服務</button><button type="button" aria-pressed={tab==='mine'} onClick={()=>setTab('mine')}>我上架的</button></div></div>
    <div className="filter-bar"><label htmlFor="service-search" className="field-label">你想找哪方面的幫助？</label><div className="search-box"><Icon name="search" /><input id="service-search" value={search} onChange={e=>setSearch(e.target.value)} placeholder="搜尋服務名稱或關鍵字" type="search" /></div><div className="filter-options" aria-label="服務分類">{CATEGORIES.map(cat=><button type="button" key={cat} aria-pressed={category===cat} onClick={()=>setCategory(cat)}>{categoryLabel(cat)}</button>)}</div></div>
    {error ? <div className="notice" role="alert">{error}<button onClick={()=>setRetry(n=>n+1)}>重新載入</button></div> : tab==='mine'&&!address ? <div className="empty-state"><h2>連接錢包，查看你上架的服務</h2><p>請開啟右上方「我的錢包」，使用上架時的錢包連接。</p><Link href="/agents/new" className="text-link">先看看怎麼上架<Icon /></Link></div> : loading ? <div className="py-16" role="status"><p className="text-text-secondary">正在整理服務列表…</p><div className="mt-8 space-y-6" aria-hidden="true">{[1,2,3].map(n=><div key={n} className="h-24 border-b border-border-subtle bg-surface-dim animate-pulse" />)}</div></div> : displayed.length===0 ? <div className="empty-state"><h2>{tab==='mine'?'第一份經驗，從這裡開始。':'還沒找到符合的服務'}</h2><p>{tab==='mine'?'把你熟悉的方法整理上架，讓需要的人找到。':'換個關鍵字，或放寬分類再找找。'}</p>{tab==='mine'?<Link href="/agents/new" className="button-primary">上架我的服務<Icon name="plus" /></Link>:<button className="button-secondary" onClick={()=>{setSearch('');setCategory('all')}}>查看全部服務</button>}</div> : <><p className="text-sm text-text-secondary py-4" role="status">{displayed.length} 份服務，從介紹開始認識。</p><div>{displayed.map(agent=><Link key={agent.id} href={`/agents/${agent.id}`} className="service-row"><span className="service-monogram" aria-hidden="true">{agent.name.slice(0,1)}</span><div><div className="service-category">{categoryLabel(agent.category)}</div><h2>{agent.name}</h2><p>{agent.description}</p><div className="service-meta"><span>{agent.run_count||0} 次使用</span><span>{agent.avg_rating?`評分 ${agent.avg_rating.toFixed(1)} / 5`:'尚無評價'}</span>{address&&agent.creator_wallet?.toLowerCase()===address.toLowerCase()&&<span>你提供的服務</span>}</div></div><div className="service-price"><div><strong>{agent.rate_per_second ? (agent.rate_per_second/1e6).toFixed(4) : '0'}</strong><small>USDC／秒 · 服務費率</small></div><span className="text-link">了解服務<Icon /></span></div></Link>)}</div><p className="section-footnote">開始前可設定本次預算。費用依使用計算，實際總費率請見服務開始頁與費用明細。</p></>}
  </div>
}
