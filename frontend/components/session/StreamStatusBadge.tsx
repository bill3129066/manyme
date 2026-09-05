import { sessionStatusLabel } from '@/lib/presentation'
export default function StreamStatusBadge({ status }: { status: string }) {
  return <span role="status" className={`inline-flex px-3 py-2 text-sm whitespace-nowrap ${status==='active'?'bg-success/10 text-success':'bg-surface-dim text-text-secondary'}`}>{sessionStatusLabel(status)}</span>
}
