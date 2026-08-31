import { create } from 'zustand'
import type {
  BetCashedOutEvent,
  BetConfirmedEvent,
  BetStatus,
  CurrentRoundView,
  OnlinePlayerView,
  PlayersOnlineEvent,
  RoundBettingOpenEvent,
  RoundCrashedEvent,
  RoundHistoryItemView,
  RoundSettledEvent,
  RoundStatus,
} from '@/types'

export interface LiveBet {
  betId: string
  username: string
  amountCents: string
  status: BetStatus
  cashoutMultiplier: number | null
  payoutAmountCents: string | null
}

interface GameState {
  phase: RoundStatus
  roundId: string | null
  bettingEndsAt: string | null
  serverSeedHash: string | null
  multiplier: number
  crashPoint: number | null
  liveBets: LiveBet[]
  history: RoundHistoryItemView[]
  onlineCount: number
  onlinePlayers: OnlinePlayerView[]

  onSnapshot: (snapshot: CurrentRoundView) => void
  onBettingOpen: (event: RoundBettingOpenEvent) => void
  onRoundStarted: () => void
  onMultiplierTick: (multiplier: number) => void
  onRoundCrashed: (event: RoundCrashedEvent) => void
  onRoundSettled: (event: RoundSettledEvent) => void
  onBetConfirmed: (event: BetConfirmedEvent) => void
  onBetCashedOut: (event: BetCashedOutEvent) => void
  onPlayersOnline: (event: PlayersOnlineEvent) => void
}

export const useGameStore = create<GameState>((set) => ({
  phase: 'BETTING',
  roundId: null,
  bettingEndsAt: null,
  serverSeedHash: null,
  multiplier: 1,
  crashPoint: null,
  liveBets: [],
  history: [],
  onlineCount: 0,
  onlinePlayers: [],

  onSnapshot: (snapshot) =>
    set({
      phase: snapshot.status,
      roundId: snapshot.roundId,
      bettingEndsAt: snapshot.bettingEndsAt,
      serverSeedHash: snapshot.serverSeedHash,
      multiplier: snapshot.currentMultiplier ?? 1,
      crashPoint: null,
      liveBets: snapshot.activeBets.map((bet) => ({
        betId: bet.betId,
        username: bet.username,
        amountCents: bet.amountCents,
        status: bet.status,
        cashoutMultiplier: null,
        payoutAmountCents: null,
      })),
    }),

  onBettingOpen: (event) =>
    set({
      phase: 'BETTING',
      roundId: event.roundId,
      bettingEndsAt: event.bettingEndsAt,
      serverSeedHash: event.serverSeedHash,
      multiplier: 1,
      crashPoint: null,
      liveBets: [],
    }),

  onRoundStarted: () => set({ phase: 'RUNNING' }),

  onMultiplierTick: (multiplier) => set({ multiplier }),

  onRoundCrashed: (event) =>
    set((state) => ({
      phase: 'CRASHED',
      crashPoint: event.crashPoint,
      multiplier: event.crashPoint,
      history: [
        { roundId: event.roundId, crashPoint: event.crashPoint, crashedAt: event.crashedAt, createdAt: event.crashedAt },
        ...state.history,
      ].slice(0, 20),
    })),

  onRoundSettled: () => set({ phase: 'SETTLED' }),

  onBetConfirmed: (event) =>
    set((state) => ({
      liveBets: [
        ...state.liveBets,
        {
          betId: event.betId,
          username: event.username,
          amountCents: event.amountCents,
          status: 'CONFIRMED',
          cashoutMultiplier: null,
          payoutAmountCents: null,
        },
      ],
    })),

  onBetCashedOut: (event) =>
    set((state) => ({
      liveBets: state.liveBets.map((bet) =>
        bet.betId === event.betId
          ? {
              ...bet,
              status: 'WON',
              cashoutMultiplier: event.multiplier,
              payoutAmountCents: event.payoutAmountCents,
            }
          : bet,
      ),
    })),

  onPlayersOnline: (event) => set({ onlineCount: event.count, onlinePlayers: event.players }),
}))

/** Only hydrate from a REST/snapshot source before any WS round event has set a round — WS always wins after that. */
export function hasHydratedRound(): boolean {
  return useGameStore.getState().roundId !== null
}
