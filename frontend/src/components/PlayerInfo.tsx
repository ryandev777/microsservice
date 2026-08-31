import { useEffect, useRef, useState } from 'react'
import { animate, motion } from 'motion/react'
import { useAuth } from 'react-oidc-context'
import { centsToDisplay, centsToNumber } from '@/lib/money'
import { useWalletMe } from '@/hooks/useWallet'

function AnimatedBalance({ cents }: { cents: number }) {
  const [display, setDisplay] = useState(cents)
  const [flash, setFlash] = useState<'up' | 'down' | null>(null)
  const prevRef = useRef(cents)

  useEffect(() => {
    const prev = prevRef.current
    if (prev === cents) return

    prevRef.current = cents
    setFlash(cents > prev ? 'up' : 'down')
    const controls = animate(prev, cents, {
      duration: 0.7,
      ease: 'easeOut',
      onUpdate: (value) => setDisplay(value),
    })
    const flashTimeout = setTimeout(() => setFlash(null), 800)

    return () => {
      controls.stop()
      clearTimeout(flashTimeout)
    }
  }, [cents])

  return (
    <motion.span
      animate={
        flash === 'up'
          ? { color: ['#22d3ee', '#22c55e', '#22d3ee'], scale: [1, 1.12, 1] }
          : flash === 'down'
            ? { color: ['#22d3ee', '#ef4444', '#22d3ee'], scale: [1, 1.12, 1] }
            : { color: '#22d3ee' }
      }
      transition={{ duration: 0.8 }}
      className="inline-block"
    >
      {centsToDisplay(display)}
    </motion.span>
  )
}

export function PlayerInfo() {
  const auth = useAuth()
  const { data: wallet, isLoading } = useWalletMe()

  const username =
    (auth.user?.profile.preferred_username as string | undefined) ?? auth.user?.profile.sub

  return (
    <div className="flex items-center justify-between gap-4 rounded-lg border border-border bg-card p-4">
      <div>
        <p className="text-xs text-muted-foreground">Jogador</p>
        <p className="font-semibold">{username}</p>
      </div>
      <div className="text-right">
        <p className="text-xs text-muted-foreground">Saldo</p>
        <p className="text-lg font-bold tabular-nums">
          {isLoading ? '...' : wallet ? <AnimatedBalance cents={centsToNumber(wallet.balanceCents)} /> : '—'}
        </p>
      </div>
    </div>
  )
}
