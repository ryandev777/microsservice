import { create } from 'zustand'
import type {
  BetCashedOutEvent,
  BetPlacedEvent,
  CurrentRoundState,
  LiveBet,
  RoundBettingOpenEvent,
  RoundCrashedEvent,
  RoundPhase,
  RoundSummary,
} from '@/types'

interface GameState {
  phase: RoundPhase
  roundId: string | null
  bettingEndsAt: string | null
  serverSeedHash: string | null
  multiplier: number
  crashPoint: number | null
  liveBets: LiveBet[]
  history: RoundSummary[]

  onBettingOpen: (event: RoundBettingOpenEvent) => void
  onRoundStarted: () => void
  onMultiplierTick: (multiplier: number) => void
  onRoundCrashed: (event: RoundCrashedEvent) => void
  onBetPlaced: (event: BetPlacedEvent) => void
  onBetCashedOut: (event: BetCashedOutEvent) => void
  setHistory: (history: RoundSummary[]) => void
  /** Seeds state from the REST snapshot on initial page load, before any WS event arrives. */
  hydrateFromSnapshot: (snapshot: CurrentRoundState) => void
}

export const useGameStore = create<GameState>((set, get) => ({
  phase: 'betting',
  roundId: null,
  bettingEndsAt: null,
  serverSeedHash: null,
  multiplier: 1,
  crashPoint: null,
  liveBets: [],
  history: [],

  onBettingOpen: (event) =>
    set({
      phase: 'betting',
      roundId: event.roundId,
      bettingEndsAt: event.bettingEndsAt,
      serverSeedHash: event.serverSeedHash,
      multiplier: 1,
      crashPoint: null,
      liveBets: [],
    }),

  onRoundStarted: () => set({ phase: 'running' }),

  onMultiplierTick: (multiplier) => set({ multiplier }),

  onRoundCrashed: (event) =>
    set((state) => ({
      phase: 'crashed',
      crashPoint: event.crashPoint,
      multiplier: event.crashPoint,
      history: [
        { id: event.roundId, crashPoint: event.crashPoint, createdAt: new Date().toISOString() },
        ...state.history,
      ].slice(0, 20),
    })),

  onBetPlaced: (event) =>
    set((state) => ({
      liveBets: [
        ...state.liveBets,
        {
          betId: event.betId,
          roundId: event.roundId,
          username: event.username,
          amountCents: event.amountCents,
          status: 'pending',
          cashoutMultiplier: null,
          payoutCents: null,
        },
      ],
    })),

  onBetCashedOut: (event) =>
    set((state) => ({
      liveBets: state.liveBets.map((bet) =>
        bet.betId === event.betId
          ? {
              ...bet,
              status: 'cashed_out',
              cashoutMultiplier: event.multiplier,
              payoutCents: event.payoutCents,
            }
          : bet,
      ),
    })),

  setHistory: (history) => set({ history }),

  hydrateFromSnapshot: (snapshot) => {
    // Only hydrate before any WS event has set a round — WS state always wins after that.
    if (get().roundId !== null) return
    set({
      phase: snapshot.phase,
      roundId: snapshot.roundId,
      bettingEndsAt: snapshot.bettingEndsAt,
      serverSeedHash: snapshot.serverSeedHash,
      multiplier: snapshot.multiplier,
      crashPoint: snapshot.crashPoint,
    })
  },
}))
