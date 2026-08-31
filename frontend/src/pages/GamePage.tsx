import { useEffect } from 'react'
import { motion } from 'motion/react'
import { BettingControls } from '@/components/BettingControls'
import { CrashChart } from '@/components/CrashChart'
import { PlayerInfo } from '@/components/PlayerInfo'
import { RoundBetsList } from '@/components/RoundBetsList'
import { RoundHistory } from '@/components/RoundHistory'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { useApiAuthSync } from '@/hooks/useApiAuthSync'
import { useGameSocket } from '@/hooks/useGameSocket'
import { useCurrentRound } from '@/hooks/useRounds'
import { useGameStore } from '@/stores/gameStore'

const fadeUp = {
  hidden: { opacity: 0, y: 16 },
  show: { opacity: 1, y: 0 },
}

export function GamePage() {
  useApiAuthSync()
  useGameSocket()

  const { data: currentRound, isLoading, isError } = useCurrentRound()
  const onSnapshot = useGameStore((s) => s.onSnapshot)

  useEffect(() => {
    // Initial paint only — once the WebSocket connects it emits its own
    // round:snapshot and every following event supersedes this REST value.
    if (currentRound) onSnapshot(currentRound)
  }, [currentRound, onSnapshot])

  return (
    <div className="relative z-10 mx-auto flex min-h-screen max-w-5xl flex-col gap-4 p-4">
      <motion.header
        initial={{ opacity: 0, y: -12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="flex items-center justify-between"
      >
        <h1 className="shimmer-text text-3xl font-extrabold tracking-tight">Crash Game</h1>
      </motion.header>

      <motion.div initial="hidden" animate="show" variants={fadeUp} transition={{ duration: 0.4 }}>
        <PlayerInfo />
      </motion.div>

      {isLoading ? (
        <Skeleton className="h-64 w-full sm:h-80" />
      ) : isError ? (
        <div className="rounded-lg border border-danger/40 bg-danger/10 p-4 text-sm text-danger">
          Não foi possível carregar a rodada atual. Verifique se o backend está no ar.
        </div>
      ) : (
        <motion.div initial="hidden" animate="show" variants={fadeUp} transition={{ duration: 0.4, delay: 0.05 }}>
          <CrashChart />
        </motion.div>
      )}

      <motion.div initial="hidden" animate="show" variants={fadeUp} transition={{ duration: 0.4, delay: 0.1 }}>
        <BettingControls />
      </motion.div>

      <motion.div
        initial="hidden"
        animate="show"
        variants={fadeUp}
        transition={{ duration: 0.4, delay: 0.15 }}
        className="grid grid-cols-1 gap-4 sm:grid-cols-2"
      >
        <RoundBetsList />
        <Card>
          <CardHeader>
            <CardTitle>Histórico de rodadas</CardTitle>
          </CardHeader>
          <CardContent>
            <RoundHistory />
          </CardContent>
        </Card>
      </motion.div>
    </div>
  )
}
