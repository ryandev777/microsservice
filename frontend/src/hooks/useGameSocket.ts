import { useEffect } from 'react'
import { useAuth } from 'react-oidc-context'
import { toast } from 'sonner'
import { connectGameSocket, disconnectGameSocket } from '@/services/socket'
import { useGameStore } from '@/stores/gameStore'
import type {
  BetCashedOutEvent,
  BetConfirmedEvent,
  BetRejectedEvent,
  RoundBettingOpenEvent,
  RoundCrashedEvent,
  RoundMultiplierTickEvent,
  RoundSettledEvent,
  RoundSnapshotEvent,
} from '@/types'

export function useGameSocket() {
  const auth = useAuth()
  const token = auth.user?.access_token

  const onSnapshot = useGameStore((s) => s.onSnapshot)
  const onBettingOpen = useGameStore((s) => s.onBettingOpen)
  const onRoundStarted = useGameStore((s) => s.onRoundStarted)
  const onMultiplierTick = useGameStore((s) => s.onMultiplierTick)
  const onRoundCrashed = useGameStore((s) => s.onRoundCrashed)
  const onRoundSettled = useGameStore((s) => s.onRoundSettled)
  const onBetConfirmed = useGameStore((s) => s.onBetConfirmed)
  const onBetCashedOut = useGameStore((s) => s.onBetCashedOut)

  useEffect(() => {
    if (!token) return

    const socket = connectGameSocket(token)

    const handleSnapshot = (event: RoundSnapshotEvent) => onSnapshot(event.round)
    const handleBettingOpen = (event: RoundBettingOpenEvent) => onBettingOpen(event)
    const handleRoundStarted = () => onRoundStarted()
    const handleMultiplierTick = (event: RoundMultiplierTickEvent) =>
      onMultiplierTick(event.multiplier)
    const handleRoundCrashed = (event: RoundCrashedEvent) => onRoundCrashed(event)
    const handleRoundSettled = (event: RoundSettledEvent) => onRoundSettled(event)
    const handleBetConfirmed = (event: BetConfirmedEvent) => onBetConfirmed(event)
    const handleBetCashedOut = (event: BetCashedOutEvent) => onBetCashedOut(event)
    const handleBetRejected = (event: BetRejectedEvent) =>
      toast.error('Sua aposta foi recusada', { description: event.reason })

    socket.on('round:snapshot', handleSnapshot)
    socket.on('round:betting_open', handleBettingOpen)
    socket.on('round:started', handleRoundStarted)
    socket.on('round:multiplier_tick', handleMultiplierTick)
    socket.on('round:crashed', handleRoundCrashed)
    socket.on('round:settled', handleRoundSettled)
    socket.on('bet:confirmed', handleBetConfirmed)
    socket.on('bet:cashed_out', handleBetCashedOut)
    socket.on('bet:rejected', handleBetRejected)

    return () => {
      socket.off('round:snapshot', handleSnapshot)
      socket.off('round:betting_open', handleBettingOpen)
      socket.off('round:started', handleRoundStarted)
      socket.off('round:multiplier_tick', handleMultiplierTick)
      socket.off('round:crashed', handleRoundCrashed)
      socket.off('round:settled', handleRoundSettled)
      socket.off('bet:confirmed', handleBetConfirmed)
      socket.off('bet:cashed_out', handleBetCashedOut)
      socket.off('bet:rejected', handleBetRejected)
      disconnectGameSocket()
    }
  }, [
    token,
    onSnapshot,
    onBettingOpen,
    onRoundStarted,
    onMultiplierTick,
    onRoundCrashed,
    onRoundSettled,
    onBetConfirmed,
    onBetCashedOut,
  ])
}
