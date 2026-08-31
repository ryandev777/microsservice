export type RoundPhase = 'betting' | 'running' | 'crashed'

export interface RoundSummary {
  id: string
  crashPoint: number
  createdAt: string
}

export interface CurrentRoundState {
  roundId: string
  phase: RoundPhase
  bettingEndsAt: string | null
  serverSeedHash: string
  multiplier: number
  crashPoint: number | null
}

export type BetStatus = 'pending' | 'cashed_out' | 'lost'

export interface LiveBet {
  betId: string
  roundId: string
  username: string
  amountCents: number
  status: BetStatus
  cashoutMultiplier: number | null
  payoutCents: number | null
}

export interface MyBet {
  betId: string
  roundId: string
  amountCents: number
  status: BetStatus
  cashoutMultiplier: number | null
  payoutCents: number | null
  createdAt: string
}

export interface Wallet {
  id: string
  balanceCents: number
}

export interface RoundVerification {
  roundId: string
  serverSeed: string
  serverSeedHash: string
  clientSeed: string
  nonce: number
  crashPoint: number
}

export interface PaginatedResponse<T> {
  items: T[]
  page: number
  pageSize: number
  total: number
}

// --- WebSocket server -> client event payloads ---
// See docs/websocket-contract.md — assumed contract, pending backend alignment.

export interface RoundBettingOpenEvent {
  roundId: string
  bettingEndsAt: string
  serverSeedHash: string
}

export interface RoundStartedEvent {
  roundId: string
  startedAt: string
}

export interface RoundMultiplierTickEvent {
  roundId: string
  multiplier: number
  elapsedMs: number
}

export interface RoundCrashedEvent {
  roundId: string
  crashPoint: number
  serverSeed: string
  clientSeed: string
  nonce: number
}

export interface BetPlacedEvent {
  roundId: string
  betId: string
  username: string
  amountCents: number
}

export interface BetCashedOutEvent {
  roundId: string
  betId: string
  username: string
  multiplier: number
  payoutCents: number
}
