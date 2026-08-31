import { cn } from '@/lib/utils'
import { formatMultiplier } from '@/lib/money'
import { useGameStore } from '@/stores/gameStore'

function colorForCrash(crashPoint: number): string {
  if (crashPoint < 1.5) return 'bg-danger/20 text-danger'
  if (crashPoint < 3) return 'bg-warning/20 text-warning'
  return 'bg-success/20 text-success'
}

export function RoundHistory() {
  const history = useGameStore((s) => s.history)

  if (history.length === 0) {
    return <p className="text-sm text-muted-foreground">Sem rodadas anteriores ainda.</p>
  }

  return (
    <div className="flex flex-wrap gap-2">
      {history.map((round) => (
        <span
          key={round.id}
          className={cn(
            'rounded-full px-3 py-1 text-xs font-semibold tabular-nums',
            colorForCrash(round.crashPoint),
          )}
        >
          {formatMultiplier(round.crashPoint)}
        </span>
      ))}
    </div>
  )
}
