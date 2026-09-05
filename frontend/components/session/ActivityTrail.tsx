'use client'

import { useState } from 'react'
import { activityEntries, type ActivityStep, type ActivityProof } from '@/lib/activity-trail'

export default function ActivityTrail({
  steps,
  proofs,
  working,
  stopped,
}: {
  steps: ActivityStep[]
  proofs: ActivityProof[]
  working: boolean
  stopped: boolean
}) {
  const [expanded, setExpanded] = useState(false)
  const entries = activityEntries(steps, proofs)
  const visible = expanded ? entries : entries.slice(0, 3)
  const toolUses = entries.filter(
    (entry) => entry.id.startsWith('step-') && entry.title === '調用工具，接著查',
  ).length
  const transactions = proofs.filter((proof) =>
    /^0x[a-fA-F0-9]{64}$/.test(proof.txHash || ''),
  ).length
  return (
    <section className="activity-trail" aria-label="分身的足跡">
      <div className="activity-heading">
        <h2>
          <span className={working ? 'activity-dot is-working' : 'activity-dot'} />
          {working ? '分身有在忙' : '分身的足跡'}
        </h2>
        <span>
          {transactions} 筆鏈上紀錄{toolUses > 0 && ` · ${toolUses} 次工具使用`}
        </span>
      </div>
      {entries.length ? (
        <ol className="activity-events" aria-live="polite" aria-relevant="additions">
          {visible.map((entry) => (
            <li key={entry.id}>
              <span className="activity-symbol" aria-hidden="true">
                {entry.url ? '↗' : '·'}
              </span>
              <div>
                {entry.url ? (
                  <a href={entry.url} target="_blank" rel="noreferrer">
                    {entry.title} ↗
                  </a>
                ) : (
                  <strong>{entry.title}</strong>
                )}
                {entry.detail && <p>{entry.detail}</p>}
              </div>
              <time>{entry.time}</time>
            </li>
          ))}
        </ol>
      ) : (
        <p className="activity-empty">
          {stopped ? '這次服務沒有留下活動紀錄。' : '分身就位，收到的工作進展會出現在這裡。'}
        </p>
      )}
      {entries.length > 3 && (
        <button
          className="text-link"
          aria-expanded={expanded}
          onClick={() => setExpanded(!expanded)}
        >
          {expanded ? '收起活動' : `查看全部 ${entries.length} 筆活動`}
        </button>
      )}
    </section>
  )
}
