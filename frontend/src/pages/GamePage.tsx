import { BettingControls } from '@/components/BettingControls'
import { CrashChart } from '@/components/CrashChart'
import { PlayerInfo } from '@/components/PlayerInfo'
import { RoundBetsList } from '@/components/RoundBetsList'
import { RoundHistory } from '@/components/RoundHistory'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { useEffect } from 'react'
import { useApiAuthSync } from '@/hooks/useApiAuthSync'
import { useGameSocket } from '@/hooks/useGameSocket'
import { useCurrentRound } from '@/hooks/useRounds'
import { useGameStore } from '@/stores/gameStore'

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
    <div className="mx-auto flex min-h-screen max-w-5xl flex-col gap-4 p-4">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-accent">Crash Game</h1>
      </header>

      <PlayerInfo />

      {isLoading ? (
        <Skeleton className="h-64 w-full sm:h-80" />
      ) : isError ? (
        <div className="rounded-lg border border-danger/40 bg-danger/10 p-4 text-sm text-danger">
          Não foi possível carregar a rodada atual. Verifique se o backend está no ar.
        </div>
      ) : (
        <CrashChart />
      )}

      <BettingControls />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <RoundBetsList />
        <Card>
          <CardHeader>
            <CardTitle>Histórico de rodadas</CardTitle>
          </CardHeader>
          <CardContent>
            <RoundHistory />
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
