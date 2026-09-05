'use client'

import { useEffect, useRef, type ReactNode } from 'react'

export default function SettlementDialog({
  children,
  onClose,
}: {
  children: ReactNode
  onClose: () => void
}) {
  const ref = useRef<HTMLDialogElement>(null)
  useEffect(() => {
    const dialog = ref.current
    const previous = document.activeElement as HTMLElement | null
    dialog?.showModal()
    return () => {
      dialog?.close()
      previous?.focus()
    }
  }, [])
  return (
    <dialog
      ref={ref}
      className="settlement-dialog"
      aria-labelledby="settlement-title"
      onCancel={onClose}
    >
      <button className="dialog-close" onClick={onClose} aria-label="關閉結算結果" autoFocus>
        關閉 ×
      </button>
      {children}
    </dialog>
  )
}
