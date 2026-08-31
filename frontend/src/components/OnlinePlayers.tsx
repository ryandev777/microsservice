import { AnimatePresence, motion } from 'motion/react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useGameStore } from '@/stores/gameStore'

export function OnlinePlayers() {
  const count = useGameStore((s) => s.onlineCount)
  const players = useGameStore((s) => s.onlinePlayers)

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between gap-2">
        <CardTitle>Jogadores online</CardTitle>
        <span className="flex items-center gap-1.5 text-xs font-semibold text-success">
          <motion.span
            animate={{ opacity: [1, 0.4, 1] }}
            transition={{ duration: 1.6, repeat: Number.POSITIVE_INFINITY }}
            className="h-2 w-2 rounded-full bg-success"
          />
          {count}
        </span>
      </CardHeader>
      <CardContent>
        {players.length === 0 ? (
          <p className="text-sm text-muted-foreground">Ninguém mais por aqui ainda.</p>
        ) : (
          <ul className="flex max-h-40 flex-col gap-1 overflow-y-auto">
            <AnimatePresence initial={false}>
              {players.map((player) => (
                <motion.li
                  key={player.playerId}
                  layout
                  initial={{ opacity: 0, x: -12 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 12 }}
                  transition={{ duration: 0.2 }}
                  className="truncate rounded-md px-2 py-1 text-sm odd:bg-muted/50"
                >
                  {player.username}
                </motion.li>
              ))}
            </AnimatePresence>
          </ul>
        )}
      </CardContent>
    </Card>
  )
}
