import { Injectable } from "@nestjs/common";
import { Prisma } from "../../../../generated/prisma-client";
import { Bet } from "../../../domain/bet/bet.entity";
import { BetStatus } from "../../../domain/bet/bet-status.vo";
import { DuplicateBetError } from "../../../domain/bet/bet.errors";
import { Money } from "../../../domain/shared/money.vo";
import type { BetPage, BetRepository, OutboxEventInput } from "../../../domain/repositories/bet.repository";
import { PrismaService } from "./prisma.service";

type BetRow = {
  id: string;
  roundId: string;
  playerId: string;
  username: string;
  amountCents: bigint;
  status: string;
  cashoutMultiplier: { toNumber(): number } | null;
  payoutCents: bigint | null;
  cashoutAt: Date | null;
  createdAt: Date;
};

const UNIQUE_CONSTRAINT_VIOLATION = "P2002";

@Injectable()
export class BetPrismaRepository implements BetRepository {
  constructor(private readonly prisma: PrismaService) {}

  private toDomain(row: BetRow): Bet {
    return Bet.restore({
      id: row.id,
      roundId: row.roundId,
      playerId: row.playerId,
      username: row.username,
      amount: Money.fromCents(row.amountCents),
      status: row.status as BetStatus,
      cashoutMultiplier: row.cashoutMultiplier ? row.cashoutMultiplier.toNumber() : null,
      payoutAmount: row.payoutCents !== null ? Money.fromCents(row.payoutCents) : null,
      cashoutAt: row.cashoutAt,
      createdAt: row.createdAt,
    });
  }

  async createWithOutbox(bet: Bet, outboxEvent: OutboxEventInput): Promise<void> {
    const props = bet.toPersistence();
    try {
      await this.prisma.$transaction([
        this.prisma.bet.create({
          data: {
            id: props.id,
            roundId: props.roundId,
            playerId: props.playerId,
            username: props.username,
            amountCents: props.amount.toCents(),
            status: props.status,
            createdAt: props.createdAt,
          },
        }),
        this.prisma.outboxMessage.create({
          data: { eventType: outboxEvent.eventType, payload: outboxEvent.payload as Prisma.InputJsonValue },
        }),
      ]);
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === UNIQUE_CONSTRAINT_VIOLATION) {
        throw new DuplicateBetError(props.roundId, props.playerId);
      }
      throw error;
    }
  }

  async findById(id: string): Promise<Bet | null> {
    const row = await this.prisma.bet.findUnique({ where: { id } });
    return row ? this.toDomain(row as unknown as BetRow) : null;
  }

  async findByRoundAndPlayer(roundId: string, playerId: string): Promise<Bet | null> {
    const row = await this.prisma.bet.findUnique({ where: { roundId_playerId: { roundId, playerId } } });
    return row ? this.toDomain(row as unknown as BetRow) : null;
  }

  async findPendingBetsByRound(roundId: string): Promise<Bet[]> {
    const rows = await this.prisma.bet.findMany({ where: { roundId, status: BetStatus.CONFIRMED } });
    return (rows as unknown as BetRow[]).map((row) => this.toDomain(row));
  }

  async findByPlayer(playerId: string, limit: number, cursor?: string | null): Promise<BetPage> {
    const rows = await this.prisma.bet.findMany({
      where: { playerId },
      orderBy: { createdAt: "desc" },
      take: limit + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    });
    const hasMore = rows.length > limit;
    const items = (hasMore ? rows.slice(0, limit) : rows) as unknown as BetRow[];
    return {
      items: items.map((row) => this.toDomain(row)),
      nextCursor: hasMore ? items[items.length - 1].id : null,
    };
  }

  async save(bet: Bet, outboxEvent?: OutboxEventInput): Promise<void> {
    const props = bet.toPersistence();
    const updateData = {
      status: props.status,
      cashoutMultiplier: props.cashoutMultiplier,
      payoutCents: props.payoutAmount ? props.payoutAmount.toCents() : null,
      cashoutAt: props.cashoutAt,
    };

    if (outboxEvent) {
      await this.prisma.$transaction([
        this.prisma.bet.update({ where: { id: props.id }, data: updateData }),
        this.prisma.outboxMessage.create({
          data: { eventType: outboxEvent.eventType, payload: outboxEvent.payload as Prisma.InputJsonValue },
        }),
      ]);
      return;
    }

    await this.prisma.bet.update({ where: { id: props.id }, data: updateData });
  }

  async saveMany(bets: Bet[]): Promise<void> {
    await this.prisma.$transaction(
      bets.map((bet) => {
        const props = bet.toPersistence();
        return this.prisma.bet.update({
          where: { id: props.id },
          data: {
            status: props.status,
            cashoutMultiplier: props.cashoutMultiplier,
            payoutCents: props.payoutAmount ? props.payoutAmount.toCents() : null,
            cashoutAt: props.cashoutAt,
          },
        });
      }),
    );
  }

  async tryConsumeMessage(messageId: string, eventType: string): Promise<boolean> {
    try {
      await this.prisma.inboxMessage.create({ data: { messageId, eventType } });
      return true;
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === UNIQUE_CONSTRAINT_VIOLATION) {
        return false;
      }
      throw error;
    }
  }
}
