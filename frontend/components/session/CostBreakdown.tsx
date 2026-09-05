import { formatRate } from '@/lib/utils'

export default function CostBreakdown({
  curatorRate,
  platformFee,
}: {
  curatorRate: number
  platformFee: number
}) {
  return (
    <div className="bg-transparent">
      <p className="text-text-tertiary text-xs uppercase tracking-widest mb-4">每秒費用組成</p>
      <div className="text-sm">
        <div className="flex justify-between py-3 border-b border-border-subtle">
          <span className="text-text-secondary">提供者</span>
          <span className="text-text-primary">{formatRate(curatorRate)}</span>
        </div>
        <div className="flex justify-between py-3 border-b border-border-subtle">
          <span className="text-text-secondary">平台</span>
          <span className="text-text-primary">{formatRate(platformFee)}</span>
        </div>
        <div className="flex justify-between py-3 font-bold text-accent">
          <span>合計</span>
          <span>{formatRate(curatorRate + platformFee)}</span>
        </div>
      </div>
    </div>
  )
}
