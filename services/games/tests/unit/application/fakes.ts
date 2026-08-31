import { Bet } from "../../../src/domain/bet/bet.entity";
import { Round } from "../../../src/domain/round/round.aggregate";
import { BetPage, BetRepository, OutboxEventInput } from "../../../src/domain/repositories/bet.repository";
import { RoundHistoryPage, RoundRepository } from "../../../src/domain/repositories/round.repository";
import { RoundBroadcaster } from "../../../src/application/ports/round-broadcaster.port";
import { MultiplierClock } from "../../../src/application/ports/multiplier-clock.port";

export class InMemoryRoundRepository implements RoundRepository {
  rounds = new Map<string, Round>();

  async create(round: Round): Promise<void> {
    this.rounds.set(round.id, round);
  }

  async findById(id: string): Promise<Round | null> {
    return this.rounds.get(id) ?? null;
  }

  async findCurrent(): Promise<Round | null> {
    const all = [...this.rounds.values()];
    return all.find((r) => r.status !== "SETTLED") ?? null;
  }

  async findHistory(limit: number): Promise<RoundHistoryPage> {
    return { items: [...this.rounds.values()].slice(0, limit), nextCursor: null };
  }

  async save(round: Round): Promise<void> {
    this.rounds.set(round.id, round);
  }

  async countAll(): Promise<number> {
    return this.rounds.size;
  }
}

export class InMemoryBetRepository implements BetRepository {
  bets = new Map<string, Bet>();
  outboxEvents: OutboxEventInput[] = [];
  consumedMessages = new Set<string>();
  duplicateGuard = new Set<string>();

  async createWithOutbox(bet: Bet, outboxEvent: OutboxEventInput): Promise<void> {
    const key = `${bet.roundId}:${bet.playerId}`;
    if (this.duplicateGuard.has(key)) {
      const { DuplicateBetError } = await import("../../../src/domain/bet/bet.errors");
      throw new DuplicateBetError(bet.roundId, bet.playerId);
    }
    this.duplicateGuard.add(key);
    this.bets.set(bet.id, bet);
    this.outboxEvents.push(outboxEvent);
  }

  async findById(id: string): Promise<Bet | null> {
    return this.bets.get(id) ?? null;
  }

  async findByRoundAndPlayer(roundId: string, playerId: string): Promise<Bet | null> {
    return [...this.bets.values()].find((b) => b.roundId === roundId && b.playerId === playerId) ?? null;
  }

  async findPendingBetsByRound(roundId: string): Promise<Bet[]> {
    return [...this.bets.values()].filter((b) => b.roundId === roundId && b.status === "CONFIRMED");
  }

  async findByPlayer(playerId: string, limit: number): Promise<BetPage> {
    const items = [...this.bets.values()].filter((b) => b.playerId === playerId).slice(0, limit);
    return { items, nextCursor: null };
  }

  async save(bet: Bet, outboxEvent?: OutboxEventInput): Promise<void> {
    this.bets.set(bet.id, bet);
    if (outboxEvent) {
      this.outboxEvents.push(outboxEvent);
    }
  }

  async saveMany(bets: Bet[]): Promise<void> {
    for (const bet of bets) {
      this.bets.set(bet.id, bet);
    }
  }

  async tryConsumeMessage(messageId: string): Promise<boolean> {
    if (this.consumedMessages.has(messageId)) {
      return false;
    }
    this.consumedMessages.add(messageId);
    return true;
  }
}

export class FakeMultiplierClock implements MultiplierClock {
  constructor(private readonly fixedMultiplier = 2.0) {}

  multiplierAt(): number {
    return this.fixedMultiplier;
  }

  elapsedMsForMultiplier(): number {
    return 0;
  }
}

export class FakeRoundBroadcaster implements RoundBroadcaster {
  roundEvents: Array<{ roundId: string; event: string; payload: Record<string, unknown> }> = [];
  playerEvents: Array<{ playerId: string; event: string; payload: Record<string, unknown> }> = [];

  broadcastToRound(roundId: string, event: string, payload: Record<string, unknown>): void {
    this.roundEvents.push({ roundId, event, payload });
  }

  emitToPlayer(playerId: string, event: string, payload: Record<string, unknown>): void {
    this.playerEvents.push({ playerId, event, payload });
  }
}
