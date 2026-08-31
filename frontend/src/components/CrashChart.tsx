import { useEffect, useRef } from 'react'
import { formatMultiplier } from '@/lib/money'
import { useGameStore } from '@/stores/gameStore'

const CRASH_COLOR = '#ef4444'
const CURVE_COLOR = '#22d3ee'
const GRID_COLOR = 'rgba(255,255,255,0.06)'

export function CrashChart() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const pointsRef = useRef<Array<{ t: number; m: number }>>([])
  const startRef = useRef<number>(0)

  const phase = useGameStore((s) => s.phase)
  const multiplier = useGameStore((s) => s.multiplier)
  const serverSeedHash = useGameStore((s) => s.serverSeedHash)

  useEffect(() => {
    if (phase === 'running' && pointsRef.current.length === 0) {
      startRef.current = performance.now()
    }
    if (phase === 'betting') {
      pointsRef.current = []
    }
  }, [phase])

  useEffect(() => {
    if (phase !== 'running' && phase !== 'crashed') return
    pointsRef.current.push({ t: performance.now() - startRef.current, m: multiplier })
  }, [multiplier, phase])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    let raf: number
    const draw = () => {
      const { width, height } = canvas.getBoundingClientRect()
      const dpr = window.devicePixelRatio || 1
      canvas.width = width * dpr
      canvas.height = height * dpr
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      ctx.clearRect(0, 0, width, height)

      // grid
      ctx.strokeStyle = GRID_COLOR
      ctx.lineWidth = 1
      for (let i = 1; i < 4; i++) {
        const y = (height / 4) * i
        ctx.beginPath()
        ctx.moveTo(0, y)
        ctx.lineTo(width, y)
        ctx.stroke()
      }

      const points = pointsRef.current
      if (points.length > 1) {
        const maxT = Math.max(...points.map((p) => p.t), 1)
        const maxM = Math.max(...points.map((p) => p.m), 2)

        ctx.beginPath()
        ctx.strokeStyle = phase === 'crashed' ? CRASH_COLOR : CURVE_COLOR
        ctx.lineWidth = 3
        ctx.lineJoin = 'round'

        points.forEach((p, i) => {
          const x = (p.t / maxT) * (width - 20) + 10
          const y = height - (p.m / maxM) * (height - 20) - 10
          if (i === 0) ctx.moveTo(x, y)
          else ctx.lineTo(x, y)
        })
        ctx.stroke()
      }

      raf = requestAnimationFrame(draw)
    }
    raf = requestAnimationFrame(draw)

    return () => cancelAnimationFrame(raf)
  }, [phase])

  return (
    <div className="relative flex h-64 w-full flex-col items-center justify-center overflow-hidden rounded-lg border border-border bg-card sm:h-80">
      <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" />

      <div
        className={`relative z-10 text-5xl font-bold tabular-nums transition-colors sm:text-6xl ${
          phase === 'crashed' ? 'text-danger' : 'text-foreground'
        }`}
      >
        {formatMultiplier(multiplier)}
        {phase === 'crashed' && <span className="ml-2 align-middle text-lg text-danger">CRASHED</span>}
      </div>

      {serverSeedHash && (
        <div className="absolute bottom-2 left-2 z-10 max-w-[90%] truncate rounded bg-black/40 px-2 py-1 font-mono text-[10px] text-muted-foreground">
          seed hash: {serverSeedHash}
        </div>
      )}
    </div>
  )
}
