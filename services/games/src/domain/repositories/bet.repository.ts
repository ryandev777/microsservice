import { Bet } from "../bet/bet.entity";

export const BET_REPOSITORY = Symbol("BET_REPOSITORY");

export interface OutboxEventInput {
  eventType: string;
  payload: Record<string, unknown>;
}

export interface BetPage {
  items: Bet[];
  nextCursor: string | null;
}

export interface BetRepository {
  /** Persists the bet and an outbox event atomically in the same transaction. */
  createWithOutbox(bet: Bet, outboxEvent: OutboxEventInput): Promise<void>;
  findById(id: string): Promise<Bet | null>;
  findByRoundAndPlayer(roundId: string, playerId: string): Promise<Bet | null>;
  /** Bets in CONFIRMED status (not yet cashed out or settled) for a round. */
  findPendingBetsByRound(roundId: string): Promise<Bet[]>;
  findByPlayer(playerId: string, limit: number, cursor?: string | null): Promise<BetPage>;
  save(bet: Bet, outboxEvent?: OutboxEventInput): Promise<void>;
  saveMany(bets: Bet[]): Promise<void>;
  /**
   * Inbox dedup guard: atomically reserves `messageId` for processing.
   * Returns false if it has already been consumed (caller must skip
   * mutating/persisting the aggregate in that case). Reservation happens
   * before the aggregate mutation is persisted, so a crash between
   * reservation and save is a known, accepted risk for this challenge's
   * scope (documented trade-off, not a full two-phase inbox).
   */
  tryConsumeMessage(messageId: string, eventType: string): Promise<boolean>;
}
