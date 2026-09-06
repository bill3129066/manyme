'use client'
import { useEffect, useRef, useState } from 'react'

export function ExperienceWave() {
  const ref = useRef<HTMLCanvasElement>(null)
  const [paused, setPaused] = useState(false)
  useEffect(() => {
    const canvas = ref.current!
    const ctx = canvas.getContext('2d')!
    const media = matchMedia('(prefers-reduced-motion: reduce)')
    let frame = 0, time = 0, previous = 0, visible = true
    const draw = (now: number) => {
      const size = canvas.clientWidth
      const dpr = Math.min(devicePixelRatio, 2)
      if (canvas.width !== Math.round(size * dpr)) {
        canvas.width = Math.round(size * dpr)
        canvas.height = canvas.width
      }
      if (previous && !paused && !media.matches && visible) time += Math.min(now - previous, 40) / 1000
      previous = now
      ctx.setTransform(dpr * size / 600, 0, 0, dpr * size / 600, 0, 0)
      ctx.clearRect(0, 0, 600, 600)
      // A continuous woven surface: one rhythm takes many different paths.
      for (let line = 0; line < 64; line++) {
        const v = line / 63, phase = time * Math.PI / 10
        ctx.beginPath()
        for (let step = 0; step <= 180; step++) {
          const u = step / 180, angle = u * Math.PI * 2
          const swell = Math.sin(angle * 2 + phase + v * 2.5)
          const radius = 118 + v * 90 + 27 * swell
          const x = 300 + Math.cos(angle) * radius
          const y = 300 + Math.sin(angle) * radius * 0.66 + 49 * Math.sin(angle + v * 3 + phase)
          if (!step) ctx.moveTo(x, y); else ctx.lineTo(x, y)
        }
        ctx.closePath()
        ctx.strokeStyle = line < 32 ? `rgba(49,87,74,${0.22 + v * 0.32})` : `rgba(176,61,40,${0.28 + v * 0.28})`
        ctx.lineWidth = 0.85
        ctx.stroke()
      }
      if (!paused && !media.matches && visible && !document.hidden) frame = requestAnimationFrame(draw)
    }
    const restart = () => { cancelAnimationFrame(frame); previous = 0; frame = requestAnimationFrame(draw) }
    const observer = new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; restart() })
    observer.observe(canvas)
    const resize = new ResizeObserver(restart); resize.observe(canvas)
    media.addEventListener('change', restart)
    document.addEventListener('visibilitychange', restart)
    restart()
    return () => { cancelAnimationFrame(frame); observer.disconnect(); resize.disconnect(); media.removeEventListener('change', restart); document.removeEventListener('visibilitychange', restart) }
  }, [paused])
  return <div className="experience-wave">
    <canvas ref={ref} aria-hidden="true" />
    <button className="wave-toggle" aria-pressed={paused} onClick={() => setPaused(!paused)}>{paused ? '播放動畫' : '暫停動畫'}</button>
  </div>
}
