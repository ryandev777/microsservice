import { AnimatePresence, motion } from 'motion/react'
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
      <AnimatePresence initial={false}>
        {history.map((round, index) => (
          <motion.span
            key={round.roundId}
            layout
            initial={{ opacity: 0, scale: 0.4, y: -10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.6 }}
            transition={
              index === 0
                ? { type: 'spring', stiffness: 500, damping: 20 }
                : { type: 'spring', stiffness: 400, damping: 30 }
            }
            className={cn(
              'rounded-full px-3 py-1 text-xs font-semibold tabular-nums',
              colorForCrash(round.crashPoint),
            )}
          >
            {formatMultiplier(round.crashPoint)}
          </motion.span>
        ))}
      </AnimatePresence>
    </div>
  )
}
