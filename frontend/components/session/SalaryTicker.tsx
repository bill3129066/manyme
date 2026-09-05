import { estimateSessionCost, type CostSnapshot } from '@/lib/session-cost'
import { useEffect, useState } from 'react'
import { formatUSDC } from '@/lib/utils'

export default function SalaryTicker({ accrued, ratePerSec, status, snapshot }: {
  accrued: number
  ratePerSec: number
  snapshot?: CostSnapshot | null
  status: string
}) {
  const [displayValue, setDisplayValue] = useState(accrued)
  useEffect(() => {
    const update = () => setDisplayValue(snapshot ? estimateSessionCost(snapshot, ratePerSec, status, Date.now() / 1000) : accrued)
    update()
    if (status !== 'active') return
    const timer = setInterval(update, 100)
    return () => clearInterval(timer)
  }, [accrued, ratePerSec, status, snapshot])

  return (
    <div className="border border-border-subtle p-8 bg-surface-elevated">
      <p className="text-text-tertiary text-xs uppercase tracking-widest mb-4">{status === 'active' ? 'Estimated Session Cost' : 'Session Cost'}</p>
      <div 
        className={`text-6xl font-display font-bold transition-colors ${
          status === 'active' ? 'text-accent' : 'text-text-tertiary'
        }`}
        style={{ fontVariantNumeric: 'tabular-nums' }}
      >
        {formatUSDC(displayValue)}
      </div>
      <p className="text-sm text-text-secondary mt-3">{status === 'active' ? 'Updates live within the funded proof window. Final cost is settled on Base.' : 'Settled on Base Sepolia.'}</p>
      <div className="flex items-center gap-3 mt-6">
        <div 
          className={`w-2 h-2 ${
            status === 'active' ? 'bg-accent' : 'bg-text-tertiary'
          }`}
          style={status === 'active' ? { animation: 'breathe 2s ease-in-out infinite' } : {}}
        />
        <span className="text-xs uppercase tracking-widest text-text-secondary">
          {status === 'active' ? `${formatUSDC(ratePerSec)}/sec` : status}
        </span>
      </div>
    </div>
  )
}
