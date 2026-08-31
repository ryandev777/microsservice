import { useEffect, useRef } from 'react'
import { formatMultiplier } from '@/lib/money'
import { useGameStore } from '@/stores/gameStore'

const CRASH_COLOR = '#ef4444'
const CURVE_COLOR = '#22d3ee'
const GRID_COLOR = 'rgba(255,255,255,0.08)'
const LABEL_COLOR = 'rgba(255,255,255,0.35)'

function hexToRgba(hex: string, alpha: number): string {
  const r = Number.parseInt(hex.slice(1, 3), 16)
  const g = Number.parseInt(hex.slice(3, 5), 16)
  const b = Number.parseInt(hex.slice(5, 7), 16)
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}

export function CrashChart() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const pointsRef = useRef<Array<{ t: number; m: number }>>([])
  const startRef = useRef<number>(0)

  const phase = useGameStore((s) => s.phase)
  const multiplier = useGameStore((s) => s.multiplier)
  const serverSeedHash = useGameStore((s) => s.serverSeedHash)

  useEffect(() => {
    if (phase === 'RUNNING' && pointsRef.current.length === 0) {
      startRef.current = performance.now()
      pointsRef.current.push({ t: 0, m: 1 })
    }
    if (phase === 'BETTING') {
      pointsRef.current = []
    }
  }, [phase])

  useEffect(() => {
    if (phase !== 'RUNNING' && phase !== 'CRASHED') return
    pointsRef.current.push({ t: performance.now() - startRef.current, m: multiplier })
  }, [multiplier, phase])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    let raf: number
    const draw = (time: number) => {
      const { width, height } = canvas.getBoundingClientRect()
      const dpr = window.devicePixelRatio || 1
      canvas.width = width * dpr
      canvas.height = height * dpr
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      ctx.clearRect(0, 0, width, height)

      const plotLeft = 8
      const plotRight = width - 8
      const plotTop = 12
      const plotBottom = height - 12

      const points = pointsRef.current
      const maxM = Math.max(...points.map((p) => p.m), 2)

      // horizontal grid + multiplier labels
      ctx.strokeStyle = GRID_COLOR
      ctx.fillStyle = LABEL_COLOR
      ctx.font = '10px ui-monospace, monospace'
      ctx.lineWidth = 1
      const rows = 4
      for (let i = 0; i <= rows; i++) {
        const y = plotBottom - (i / rows) * (plotBottom - plotTop)
        ctx.beginPath()
        ctx.moveTo(plotLeft, y)
        ctx.lineTo(plotRight, y)
        ctx.stroke()
        const value = 1 + (i / rows) * (maxM - 1)
        ctx.fillText(`${value.toFixed(1)}x`, plotLeft + 4, y - 3)
      }

      if (points.length > 1) {
        const maxT = Math.max(...points.map((p) => p.t), 1)
        const toX = (t: number) => (t / maxT) * (plotRight - plotLeft) + plotLeft
        const toY = (m: number) => plotBottom - ((m - 1) / (maxM - 1 || 1)) * (plotBottom - plotTop)

        const color = phase === 'CRASHED' ? CRASH_COLOR : CURVE_COLOR

        // area fill under the curve
        const gradient = ctx.createLinearGradient(0, plotTop, 0, plotBottom)
        gradient.addColorStop(0, hexToRgba(color, 0.35))
        gradient.addColorStop(1, hexToRgba(color, 0))

        ctx.beginPath()
        ctx.moveTo(toX(points[0]!.t), plotBottom)
        points.forEach((p) => ctx.lineTo(toX(p.t), toY(p.m)))
        ctx.lineTo(toX(points[points.length - 1]!.t), plotBottom)
        ctx.closePath()
        ctx.fillStyle = gradient
        ctx.fill()

        // smooth curve line
        ctx.beginPath()
        ctx.strokeStyle = color
        ctx.lineWidth = 3
        ctx.lineJoin = 'round'
        ctx.lineCap = 'round'
        ctx.moveTo(toX(points[0]!.t), toY(points[0]!.m))
        for (let i = 1; i < points.length; i++) {
          const prev = points[i - 1]!
          const curr = points[i]!
          const midX = (toX(prev.t) + toX(curr.t)) / 2
          const midY = (toY(prev.m) + toY(curr.m)) / 2
          ctx.quadraticCurveTo(toX(prev.t), toY(prev.m), midX, midY)
        }
        const last = points[points.length - 1]!
        ctx.lineTo(toX(last.t), toY(last.m))
        ctx.stroke()

        // pulsing head dot while the round is live
        if (phase === 'RUNNING') {
          const pulse = 3 + Math.sin(time / 180) * 2
          const x = toX(last.t)
          const y = toY(last.m)
          ctx.beginPath()
          ctx.arc(x, y, 5 + pulse, 0, Math.PI * 2)
          ctx.fillStyle = hexToRgba(color, 0.25)
          ctx.fill()
          ctx.beginPath()
          ctx.arc(x, y, 4, 0, Math.PI * 2)
          ctx.fillStyle = color
          ctx.fill()
        }
      }

      raf = requestAnimationFrame(draw)
    }
    raf = requestAnimationFrame(draw)

    return () => cancelAnimationFrame(raf)
  }, [phase])

  return (
    <div className="relative flex h-64 w-full flex-col items-center justify-center overflow-hidden rounded-lg border border-border bg-card sm:h-80">
      <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" />

      {phase === 'BETTING' ? (
        <div className="relative z-10 flex flex-col items-center gap-1 text-muted-foreground">
          <span className="text-lg font-medium">Aguardando próxima rodada...</span>
          <span className="text-sm">Faça sua aposta agora</span>
        </div>
      ) : (
        <div
          className={`relative z-10 text-5xl font-bold tabular-nums transition-colors sm:text-6xl ${
            phase === 'CRASHED' ? 'text-danger' : 'text-foreground'
          }`}
        >
          {formatMultiplier(multiplier)}
          {phase === 'CRASHED' && <span className="ml-2 align-middle text-lg text-danger">CRASHED</span>}
        </div>
      )}

      {serverSeedHash && (
        <div className="absolute bottom-2 left-2 z-10 max-w-[90%] truncate rounded bg-black/40 px-2 py-1 font-mono text-[10px] text-muted-foreground">
          seed hash: {serverSeedHash}
        </div>
      )}
    </div>
  )
}
