import { useEffect, useRef, useState } from 'react'
import { animate, motion } from 'motion/react'
import { LogOut, Volume2, VolumeX } from 'lucide-react'
import { useAuth } from 'react-oidc-context'
import { Button } from '@/components/ui/button'
import { centsToDisplay, centsToNumber } from '@/lib/money'
import { useWalletMe } from '@/hooks/useWallet'
import { useSoundStore } from '@/stores/soundStore'

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
  const muted = useSoundStore((s) => s.muted)
  const toggleMuted = useSoundStore((s) => s.toggleMuted)

  const username =
    (auth.user?.profile.preferred_username as string | undefined) ?? auth.user?.profile.sub

  return (
    <div className="flex items-center justify-between gap-4 rounded-lg border border-border bg-card p-4">
      <div className="flex items-center gap-3">
        <div>
          <p className="text-xs text-muted-foreground">Jogador</p>
          <p className="font-semibold">{username}</p>
        </div>
        <motion.div whileTap={{ scale: 0.94 }}>
          <Button
            variant="ghost"
            size="sm"
            className="text-muted-foreground hover:text-foreground"
            onClick={toggleMuted}
            aria-label={muted ? 'Ativar som' : 'Silenciar som'}
            title={muted ? 'Ativar som' : 'Silenciar som'}
          >
            {muted ? <VolumeX className="h-3.5 w-3.5" /> : <Volume2 className="h-3.5 w-3.5" />}
          </Button>
        </motion.div>
        <motion.div whileTap={{ scale: 0.94 }}>
          <Button
            variant="ghost"
            size="sm"
            className="gap-1.5 text-muted-foreground hover:text-danger"
            onClick={() => auth.signoutRedirect()}
          >
            <LogOut className="h-3.5 w-3.5" />
            Sair
          </Button>
        </motion.div>
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
