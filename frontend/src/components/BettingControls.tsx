import { useEffect, useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { toast } from 'sonner'
import { CoinBurst } from '@/components/CoinBurst'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  centsToDisplay,
  centsToNumber,
  formatMultiplier,
  MAX_BET_CENTS,
  MIN_BET_CENTS,
  potentialPayoutCents,
  reaisInputToCents,
} from '@/lib/money'
import { sounds } from '@/lib/sound'
import { useCashout, usePlaceBet } from '@/hooks/useRounds'
import { useWalletMe } from '@/hooks/useWallet'
import { useGameStore } from '@/stores/gameStore'

const cashoutGlow = {
  pulsing: {
    boxShadow: [
      '0 0 0px rgba(34,197,94,0.55)',
      '0 0 26px rgba(34,197,94,0.55)',
      '0 0 0px rgba(34,197,94,0.55)',
    ],
    transition: { duration: 1.3, repeat: Number.POSITIVE_INFINITY },
  },
  idle: {
    boxShadow: '0 0 0px rgba(34,197,94,0)',
    transition: { duration: 0.3 },
  },
}

export function BettingControls() {
  const [amount, setAmount] = useState('10,00')
  const [pendingBetCents, setPendingBetCents] = useState<number | null>(null)
  const [coinTrigger, setCoinTrigger] = useState(0)

  const phase = useGameStore((s) => s.phase)
  const multiplier = useGameStore((s) => s.multiplier)
  const bettingEndsAt = useGameStore((s) => s.bettingEndsAt)

  const { data: wallet } = useWalletMe()
  const placeBet = usePlaceBet()
  const cashout = useCashout()

  const [secondsLeft, setSecondsLeft] = useState(0)

  useEffect(() => {
    if (phase !== 'BETTING' || !bettingEndsAt) {
      setSecondsLeft(0)
      return
    }
    const tick = () => {
      const diff = Math.max(0, Math.round((new Date(bettingEndsAt).getTime() - Date.now()) / 1000))
      setSecondsLeft(diff)
    }
    tick()
    const interval = setInterval(tick, 250)
    return () => clearInterval(interval)
  }, [phase, bettingEndsAt])

  useEffect(() => {
    if (phase === 'BETTING') setPendingBetCents(null)
  }, [phase])

  const amountCents = useMemo(() => reaisInputToCents(amount), [amount])

  const amountError = useMemo(() => {
    if (amountCents === null) return 'Valor inválido'
    if (amountCents < MIN_BET_CENTS) return `Aposta mínima de ${centsToDisplay(MIN_BET_CENTS)}`
    if (amountCents > MAX_BET_CENTS) return `Aposta máxima de ${centsToDisplay(MAX_BET_CENTS)}`
    if (wallet && amountCents > centsToNumber(wallet.balanceCents)) return 'Saldo insuficiente'
    return null
  }, [amountCents, wallet])

  const canBet = phase === 'BETTING' && !amountError && !placeBet.isPending && pendingBetCents === null
  const canCashout = phase === 'RUNNING' && pendingBetCents !== null && !cashout.isPending

  const potentialPayout = pendingBetCents !== null ? potentialPayoutCents(pendingBetCents, multiplier) : 0

  function handleBet() {
    if (amountCents === null) return
    placeBet.mutate(
      { amountCents },
      {
        onSuccess: () => {
          setPendingBetCents(amountCents)
          sounds.bet()
        },
        onError: (error) => {
          toast.error('Não foi possível apostar', {
            description: error instanceof Error ? error.message : undefined,
          })
        },
      },
    )
  }

  function handleCashout() {
    cashout.mutate(undefined, {
      onSuccess: (bet) => {
        toast.success(`Cash out em ${formatMultiplier(bet.cashoutMultiplier ?? multiplier)}`, {
          description: 'Ganhos creditados na sua carteira.',
        })
        setPendingBetCents(null)
        sounds.win()
        setCoinTrigger((n) => n + 1)
      },
      onError: (error) => {
        toast.error('Não foi possível sacar', {
          description: error instanceof Error ? error.message : undefined,
        })
      },
    })
  }

  const urgent = phase === 'BETTING' && secondsLeft <= 3

  return (
    <div className="relative flex flex-col gap-4 rounded-lg border border-border bg-card p-4">
      <CoinBurst trigger={coinTrigger} />
      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <span>{phase === 'BETTING' ? 'Fase de apostas' : phase === 'RUNNING' ? 'Rodada em andamento' : 'Rodada encerrada'}</span>
        {phase === 'BETTING' && (
          <motion.span
            data-testid="betting-countdown"
            animate={urgent ? { scale: [1, 1.25, 1], color: ['#ef4444', '#f59e0b', '#ef4444'] } : { scale: 1, color: '#9ca3af' }}
            transition={urgent ? { duration: 0.6, repeat: Number.POSITIVE_INFINITY } : { duration: 0.2 }}
            className="font-mono tabular-nums"
          >
            {secondsLeft}s
          </motion.span>
        )}
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="bet-amount" className="text-xs text-muted-foreground">
          Valor da aposta
        </label>
        <Input
          id="bet-amount"
          inputMode="decimal"
          value={amount}
          disabled={phase !== 'BETTING' || pendingBetCents !== null}
          onChange={(e) => setAmount(e.target.value)}
          aria-invalid={Boolean(amountError)}
        />
        <AnimatePresence>
          {amountError && phase === 'BETTING' && (
            <motion.span
              initial={{ opacity: 0, y: -4, height: 0 }}
              animate={{ opacity: 1, y: 0, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.15 }}
              className="text-xs text-danger"
            >
              {amountError}
            </motion.span>
          )}
        </AnimatePresence>
      </div>

      <div className="flex gap-2">
        <motion.div className="flex-1" whileTap={canBet ? { scale: 0.96 } : undefined}>
          <Button className="w-full" disabled={!canBet} onClick={handleBet}>
            {placeBet.isPending ? 'Apostando...' : 'Apostar'}
          </Button>
        </motion.div>

        <motion.div
          className="flex-1 rounded-md"
          whileTap={canCashout ? { scale: 0.96 } : undefined}
          animate={canCashout ? cashoutGlow.pulsing : cashoutGlow.idle}
        >
          <Button className="w-full" variant="success" disabled={!canCashout} onClick={handleCashout}>
            <AnimatePresence mode="wait">
              <motion.span
                key={cashout.isPending ? 'pending' : canCashout ? `payout-${potentialPayout}` : 'idle'}
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={{ duration: 0.15 }}
              >
                {cashout.isPending
                  ? 'Sacando...'
                  : canCashout
                    ? `Cash Out (${centsToDisplay(potentialPayout)})`
                    : 'Cash Out'}
              </motion.span>
            </AnimatePresence>
          </Button>
        </motion.div>
      </div>
    </div>
  )
}
