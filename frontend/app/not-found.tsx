import Link from 'next/link'

export default function NotFound() {
  return (
    <div className="bg-background min-h-[60vh] flex items-center justify-center">
      <div className="text-center max-w-lg px-6">
        <h1 className="font-display text-3xl font-bold text-text-primary leading-none mb-4">404</h1>
        <p className="font-display italic text-2xl text-text-secondary mb-8">
          這一頁，暫時找不到。
        </p>
        <Link
          href="/"
          className="bg-text-primary text-surface-elevated font-bold px-8 py-3 text-xs uppercase tracking-widest hover:bg-accent transition-colors inline-block"
        >
          回到首頁
        </Link>
      </div>
    </div>
  )
}
