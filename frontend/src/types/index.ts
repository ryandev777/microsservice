/**
 * Mirrors services/games and services/wallets response shapes exactly.
 * Money crosses the wire as a string (BigInt cents serialized to JSON,
 * since JSON.stringify can't represent BigInt) — never parse it with
 * anything other than the helpers in @/lib/money.
 */

export type RoundStatus = 'BETTING' | 'RUNNING' | 'CRASHED' | 'SETTLED'

export type BetStatus =
  | 'PLACED_PENDING'
  | 'CONFIRMED'
  | 'REJECTED'
  | 'CASHOUT_PENDING'
  | 'WON'
  | 'LOST'

export interface ActiveBetView {
  betId: string
  playerId: string
  username: string
  amountCents: string
  status: BetStatus
}

// GET /games/rounds/current
export interface CurrentRoundView {
  roundId: string
  status: RoundStatus
  serverSeedHash: string
  bettingEndsAt: string
  startedAt: string | null
  currentMultiplier: number | null
  activeBets: ActiveBetView[]
}

// GET /games/rounds/history
export interface RoundHistoryItemView {
  roundId: string
  crashPoint: number
  crashedAt: string | null
  createdAt: string
}

export interface CursorPage<T> {
  items: T[]
  nextCursor: string | null
}

// GET /games/rounds/:roundId/verify
export interface RoundVerification {
  roundId: string
  serverSeed: string
  serverSeedHash: string
  clientSeed: string
  nonce: number
  crashPoint: number
  algorithmVersion: string
}

// GET /games/bets/me
export interface MyBetItemView {
  betId: string
  roundId: string
  amountCents: string
  status: BetStatus
  cashoutMultiplier: number | null
  payoutAmountCents: string | null
  createdAt: string
}

// POST /games/bet
export interface PlaceBetResponse {
  betId: string
  roundId: string
  status: BetStatus
}

// POST /games/bet/cashout
export interface CashoutResponse {
  betId: string
  cashoutMultiplier: number
  payoutAmountCents: string
}

// GET /wallets/me
export interface WalletBalanceView {
  playerId: string
  balanceCents: string
  balance: string
}

// POST /wallets
export interface CreateWalletResponse {
  id: string
  playerId: string
  balance: string
}

// --- WebSocket server -> client event payloads ---
// See docs/websocket-contract.md — confirmed against
// services/games/src/infrastructure/scheduler/round-lifecycle.scheduler.ts
// and the confirm-bet/confirm-cashout/reject-bet use cases.

export interface RoundSnapshotEvent {
  round: CurrentRoundView
}

export interface RoundBettingOpenEvent {
  roundId: string
  serverSeedHash: string
  bettingEndsAt: string
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
  crashedAt: string
  serverSeed: string
  serverSeedHash: string
  clientSeed: string
  nonce: number
}

export interface RoundSettledEvent {
  roundId: string
  lostBetsCount: number
}

/** Broadcast to the whole round once the wallet debit succeeds. */
export interface BetConfirmedEvent {
  betId: string
  playerId: string
  username: string
  amountCents: string
}

export interface BetCashedOutEvent {
  betId: string
  playerId: string
  username: string
  multiplier: number
  payoutAmountCents: string
}

/** Emitted only to the player whose bet was rejected (insufficient balance, etc). */
export interface BetRejectedEvent {
  betId: string
  reason: string
}

export interface OnlinePlayerView {
  playerId: string
  username: string
}

/**
 * Sent once to a socket right after it connects (snapshot), then broadcast
 * to everyone whenever a player's connection count goes from/to zero.
 * Only counts sockets that authenticated on the handshake — anonymous
 * connections still receive everything else, just don't show up here.
 */
export interface PlayersOnlineEvent {
  count: number
  players: OnlinePlayerView[]
}
