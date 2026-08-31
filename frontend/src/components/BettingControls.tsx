import { useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
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
import { useCashout, usePlaceBet } from '@/hooks/useRounds'
import { useWalletMe } from '@/hooks/useWallet'
import { useGameStore } from '@/stores/gameStore'

export function BettingControls() {
  const [amount, setAmount] = useState('10,00')
  const [pendingBetCents, setPendingBetCents] = useState<number | null>(null)

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
        onSuccess: () => setPendingBetCents(amountCents),
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
        toast.success(`Cash out em ${formatMultiplier(bet.cashoutMultiplier ?? multiplier)}`)
        setPendingBetCents(null)
      },
      onError: (error) => {
        toast.error('Não foi possível sacar', {
          description: error instanceof Error ? error.message : undefined,
        })
      },
    })
  }

  return (
    <div className="flex flex-col gap-4 rounded-lg border border-border bg-card p-4">
      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <span>{phase === 'BETTING' ? 'Fase de apostas' : phase === 'RUNNING' ? 'Rodada em andamento' : 'Rodada encerrada'}</span>
        {phase === 'BETTING' && (
          <span data-testid="betting-countdown" className="font-mono tabular-nums">
            {secondsLeft}s
          </span>
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
        {amountError && phase === 'BETTING' && (
          <span className="text-xs text-danger">{amountError}</span>
        )}
      </div>

      <div className="flex gap-2">
        <Button className="flex-1" disabled={!canBet} onClick={handleBet}>
          {placeBet.isPending ? 'Apostando...' : 'Apostar'}
        </Button>
        <Button
          className="flex-1"
          variant="success"
          disabled={!canCashout}
          onClick={handleCashout}
        >
          {cashout.isPending
            ? 'Sacando...'
            : canCashout
              ? `Cash Out (${centsToDisplay(potentialPayout)})`
              : 'Cash Out'}
        </Button>
      </div>
    </div>
  )
}
