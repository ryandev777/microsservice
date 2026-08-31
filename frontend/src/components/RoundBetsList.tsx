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
            {bets.map((bet) => (
              <li
                key={bet.betId}
                className="flex items-center justify-between rounded-md px-2 py-1.5 text-sm odd:bg-muted/50"
              >
                <span className="truncate">{bet.username}</span>
                <span className="tabular-nums text-muted-foreground">{centsToDisplay(bet.amountCents)}</span>
                {bet.status === 'WON' ? (
                  <span className="tabular-nums font-semibold text-success">
                    {formatMultiplier(bet.cashoutMultiplier ?? 0)}
                  </span>
                ) : bet.status === 'LOST' ? (
                  <span className="text-xs text-danger">perdeu</span>
                ) : (
                  <span className="text-xs text-muted-foreground">em jogo</span>
                )}
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}
