export default function Loading() {
  return (
    <div className="bg-background min-h-[60vh] flex items-center justify-center">
      <div className="text-center">
        <div className="w-8 h-8 border-2 border-accent border-t-transparent animate-spin mx-auto mb-6" />
        <p className="text-xs uppercase tracking-widest text-text-tertiary">正在載入，請稍候…</p>
      </div>
    </div>
  )
}
