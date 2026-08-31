import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion, useAnimate } from 'motion/react'
import { formatMultiplier } from '@/lib/money'
import { useGameStore } from '@/stores/gameStore'

const CRASH_COLOR = '#ef4444'
const CURVE_COLOR = '#22d3ee'
const GRID_COLOR = 'rgba(255,255,255,0.08)'
const LABEL_COLOR = 'rgba(255,255,255,0.35)'

/**
 * The backend fires round:crashed and round:settled back to back, often
 * within the same event-loop tick — a naive `phase === 'CRASHED'` check
 * would show the crash celebration for a single, barely-perceptible
 * render. This freezes the crash moment on screen for a beat regardless
 * of how fast the phase moves on underneath.
 */
const CRASH_FLASH_MS = 2200

interface Particle {
  x: number
  y: number
  vx: number
  vy: number
  life: number
  maxLife: number
  color: string
  size: number
}

function hexToRgba(hex: string, alpha: number): string {
  const r = Number.parseInt(hex.slice(1, 3), 16)
  const g = Number.parseInt(hex.slice(3, 5), 16)
  const b = Number.parseInt(hex.slice(5, 7), 16)
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}

function toHex2(n: number): string {
  return Math.round(n).toString(16).padStart(2, '0')
}

/** Interpolates cyan -> amber as the multiplier climbs, for an escalating "heat" feel. */
function curveColorFor(multiplier: number): string {
  const t = Math.min(1, Math.max(0, (multiplier - 1) / 9))
  const from = { r: 0x22, g: 0xd3, b: 0xee }
  const to = { r: 0xf5, g: 0x9e, b: 0x0b }
  const r = from.r + (to.r - from.r) * t
  const g = from.g + (to.g - from.g) * t
  const b = from.b + (to.b - from.b) * t
  return `#${toHex2(r)}${toHex2(g)}${toHex2(b)}`
}

function spawnCrashBurst(x: number, y: number, color: string): Particle[] {
  return Array.from({ length: 48 }, () => {
    const angle = Math.random() * Math.PI * 2
    const speed = 2 + Math.random() * 7
    const maxLife = 40 + Math.random() * 35
    return {
      x,
      y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      life: maxLife,
      maxLife,
      color,
      size: 1.5 + Math.random() * 2.5,
    }
  })
}

export function CrashChart() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const pointsRef = useRef<Array<{ t: number; m: number }>>([])
  const startRef = useRef<number>(0)
  const particlesRef = useRef<Particle[]>([])
  const lastHeadRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 })
  const prevPhaseRef = useRef<string>('BETTING')

  const [scope, animateFn] = useAnimate()
  const [crashedAt, setCrashedAt] = useState<number | null>(null)

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

  // Edge-triggered: fires once per crash, independent of how briefly the
  // store actually reports phase === 'CRASHED'. Deliberately excludes
  // `multiplier` from the deps — it ticks every ~100ms, and including it
  // here would re-run this effect on every tick, which matters because...
  useEffect(() => {
    if (phase === 'CRASHED' && prevPhaseRef.current !== 'CRASHED') {
      particlesRef.current.push(...spawnCrashBurst(lastHeadRef.current.x, lastHeadRef.current.y, CRASH_COLOR))
      setCrashedAt(multiplier)
      void animateFn(scope.current, { x: [0, -10, 8, -6, 4, -2, 0] }, { duration: 0.5, ease: 'easeOut' })
    }
    prevPhaseRef.current = phase
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, animateFn, scope])

  // ...the flash-clearing timeout lives in its own effect, keyed only on
  // crashedAt itself. Combining it with the effect above meant the timeout
  // got scheduled and then immediately torn down by cleanup on the very
  // next multiplier tick (~100ms later), before it ever had a chance to
  // fire — crashedAt was staying stuck forever once a round crashed once.
  useEffect(() => {
    if (crashedAt === null) return
    const timeout = setTimeout(() => setCrashedAt(null), CRASH_FLASH_MS)
    return () => clearTimeout(timeout)
  }, [crashedAt])

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

        const color = phase === 'CRASHED' ? CRASH_COLOR : curveColorFor(points[points.length - 1]!.m)

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

        // glow pass under the stroke — gets punchier as the multiplier climbs
        ctx.save()
        ctx.shadowColor = color
        ctx.shadowBlur = 6 + Math.min(18, (points[points.length - 1]!.m - 1) * 2)

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
        ctx.restore()

        lastHeadRef.current = { x: toX(last.t), y: toY(last.m) }

        // pulsing head dot while the round is live
        if (phase === 'RUNNING') {
          const pulse = 3 + Math.sin(time / 180) * 2
          const { x, y } = lastHeadRef.current
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

      // crash particle burst
      if (particlesRef.current.length > 0) {
        const gravity = 0.12
        particlesRef.current = particlesRef.current.filter((p) => p.life > 0)
        for (const p of particlesRef.current) {
          p.x += p.vx
          p.y += p.vy
          p.vy += gravity
          p.vx *= 0.98
          p.life -= 1
          const alpha = Math.max(0, p.life / p.maxLife)
          ctx.beginPath()
          ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2)
          ctx.fillStyle = hexToRgba(p.color, alpha)
          ctx.fill()
        }
      }

      raf = requestAnimationFrame(draw)
    }
    raf = requestAnimationFrame(draw)

    return () => cancelAnimationFrame(raf)
  }, [phase])

  const showCrash = crashedAt !== null
  const showWaiting = !showCrash && phase === 'BETTING'

  const glowColor = showCrash ? CRASH_COLOR : phase === 'RUNNING' ? curveColorFor(multiplier) : CURVE_COLOR
  const glowIntensity = showCrash ? 0.9 : phase === 'RUNNING' ? Math.min(1, 0.25 + (multiplier - 1) / 10) : 0.15

  return (
    <motion.div
      ref={scope}
      animate={{ boxShadow: `0 0 ${30 + glowIntensity * 50}px ${hexToRgba(glowColor, glowIntensity * 0.5)}` }}
      transition={{ duration: 0.3 }}
      className="relative flex h-64 w-full flex-col items-center justify-center overflow-hidden rounded-lg border border-border bg-card sm:h-80"
    >
      <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" />

      <AnimatePresence mode="wait">
        {showWaiting ? (
          <motion.div
            key="waiting"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="relative z-10 flex flex-col items-center gap-1 text-muted-foreground"
          >
            <motion.span
              animate={{ opacity: [0.6, 1, 0.6] }}
              transition={{ duration: 1.6, repeat: Number.POSITIVE_INFINITY }}
              className="text-lg font-medium"
            >
              Aguardando próxima rodada...
            </motion.span>
            <span className="text-sm">Faça sua aposta agora</span>
          </motion.div>
        ) : (
          <motion.div
            key={showCrash ? 'crashed' : 'running'}
            initial={{ opacity: 0, scale: showCrash ? 1.5 : 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={showCrash ? { type: 'spring', stiffness: 260, damping: 11 } : { duration: 0.2 }}
            className={`relative z-10 text-5xl font-bold tabular-nums sm:text-6xl ${
              showCrash ? 'text-danger neon-pulse' : 'text-foreground'
            }`}
          >
            {formatMultiplier(showCrash ? (crashedAt ?? multiplier) : multiplier)}
            {showCrash && (
              <motion.span
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.15 }}
                className="ml-2 align-middle text-lg text-danger"
              >
                CRASHED
              </motion.span>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {serverSeedHash && (
        <div className="absolute bottom-2 left-2 z-10 max-w-[90%] truncate rounded bg-black/40 px-2 py-1 font-mono text-[10px] text-muted-foreground">
          seed hash: {serverSeedHash}
        </div>
      )}
    </motion.div>
  )
}
