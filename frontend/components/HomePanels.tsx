'use client'
import { useEffect, useRef, type ReactNode } from 'react'

export function HomePanels({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const panels = Array.from(ref.current!.children) as HTMLElement[]
    const update = () => {
      const header = document.querySelector('header')?.getBoundingClientRect().height ?? 88
      panels.forEach(panel => panel.style.setProperty('--sticky-top', `${Math.min(header, innerHeight - panel.offsetHeight)}px`))
    }
    const observer = new ResizeObserver(update)
    panels.forEach(panel => observer.observe(panel))
    window.addEventListener('resize', update); update()
    return () => { observer.disconnect(); window.removeEventListener('resize', update) }
  }, [])
  return <div className="home-page" ref={ref}>{children}</div>
}
