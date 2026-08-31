import { useEffect } from 'react'
import { useAuth } from 'react-oidc-context'
import { connectGameSocket, disconnectGameSocket } from '@/services/socket'
import { useGameStore } from '@/stores/gameStore'
import type {
  BetCashedOutEvent,
  BetPlacedEvent,
  RoundBettingOpenEvent,
  RoundCrashedEvent,
  RoundMultiplierTickEvent,
} from '@/types'

export function useGameSocket() {
  const auth = useAuth()
  const token = auth.user?.access_token

  const onBettingOpen = useGameStore((s) => s.onBettingOpen)
  const onRoundStarted = useGameStore((s) => s.onRoundStarted)
  const onMultiplierTick = useGameStore((s) => s.onMultiplierTick)
  const onRoundCrashed = useGameStore((s) => s.onRoundCrashed)
  const onBetPlaced = useGameStore((s) => s.onBetPlaced)
  const onBetCashedOut = useGameStore((s) => s.onBetCashedOut)

  useEffect(() => {
    if (!token) return

    const socket = connectGameSocket(token)

    const handleBettingOpen = (event: RoundBettingOpenEvent) => onBettingOpen(event)
    const handleRoundStarted = () => onRoundStarted()
    const handleMultiplierTick = (event: RoundMultiplierTickEvent) =>
      onMultiplierTick(event.multiplier)
    const handleRoundCrashed = (event: RoundCrashedEvent) => onRoundCrashed(event)
    const handleBetPlaced = (event: BetPlacedEvent) => onBetPlaced(event)
    const handleBetCashedOut = (event: BetCashedOutEvent) => onBetCashedOut(event)

    socket.on('round:betting_open', handleBettingOpen)
    socket.on('round:started', handleRoundStarted)
    socket.on('round:multiplier_tick', handleMultiplierTick)
    socket.on('round:crashed', handleRoundCrashed)
    socket.on('bet:placed', handleBetPlaced)
    socket.on('bet:cashed_out', handleBetCashedOut)

    return () => {
      socket.off('round:betting_open', handleBettingOpen)
      socket.off('round:started', handleRoundStarted)
      socket.off('round:multiplier_tick', handleMultiplierTick)
      socket.off('round:crashed', handleRoundCrashed)
      socket.off('bet:placed', handleBetPlaced)
      socket.off('bet:cashed_out', handleBetCashedOut)
      disconnectGameSocket()
    }
  }, [token, onBettingOpen, onRoundStarted, onMultiplierTick, onRoundCrashed, onBetPlaced, onBetCashedOut])
}
