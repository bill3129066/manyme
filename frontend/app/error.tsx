'use client'

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <div className="bg-background min-h-[60vh] flex items-center justify-center">
      <div className="text-center max-w-lg px-6">
        <h1 className="font-display text-3xl font-bold text-text-primary mb-4">頁面暫時無法載入</h1>
        <p className="text-text-secondary mb-8">請重新載入；如果仍無法開啟，可以稍後再試。</p>
        <button
          type="button"
          onClick={reset}
          className="bg-text-primary text-surface-elevated font-bold px-8 py-3 text-xs uppercase tracking-widest hover:bg-accent transition-colors"
        >
          重新載入
        </button>
      </div>
    </div>
  )
}
