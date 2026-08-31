import { AnimatePresence, motion } from 'motion/react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { centsToDisplay, formatMultiplier } from '@/lib/money'
import { useGameStore } from '@/stores/gameStore'

export function RoundBetsList() {
  const bets = useGameStore((s) => s.liveBets)

  return (
    <Card>
      <CardHeader>
        <CardTitle>Apostas da rodada</CardTitle>
      </CardHeader>
      <CardContent>
        {bets.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhuma aposta ainda.</p>
        ) : (
          <ul className="flex max-h-64 flex-col gap-1 overflow-y-auto">
            <AnimatePresence initial={false}>
              {bets.map((bet) => (
                <motion.li
                  key={bet.betId}
                  layout
                  initial={{ opacity: 0, x: -16 }}
                  animate={{
                    opacity: 1,
                    x: 0,
                    backgroundColor:
                      bet.status === 'WON'
                        ? ['rgba(34,197,94,0)', 'rgba(34,197,94,0.35)', 'rgba(34,197,94,0)']
                        : undefined,
                  }}
                  exit={{ opacity: 0, x: 16 }}
                  transition={{ duration: bet.status === 'WON' ? 1 : 0.25 }}
                  className="flex items-center justify-between rounded-md px-2 py-1.5 text-sm odd:bg-muted/50"
                >
                  <span className="truncate">{bet.username}</span>
                  <span className="tabular-nums text-muted-foreground">{centsToDisplay(bet.amountCents)}</span>
                  {bet.status === 'WON' ? (
                    <motion.span
                      initial={{ scale: 0.6 }}
                      animate={{ scale: 1 }}
                      transition={{ type: 'spring', stiffness: 500, damping: 15 }}
                      className="tabular-nums font-semibold text-success"
                    >
                      {formatMultiplier(bet.cashoutMultiplier ?? 0)}
                    </motion.span>
                  ) : bet.status === 'LOST' ? (
                    <span className="text-xs text-danger">perdeu</span>
                  ) : (
                    <span className="text-xs text-muted-foreground">em jogo</span>
                  )}
                </motion.li>
              ))}
            </AnimatePresence>
          </ul>
        )}
      </CardContent>
    </Card>
  )
}
