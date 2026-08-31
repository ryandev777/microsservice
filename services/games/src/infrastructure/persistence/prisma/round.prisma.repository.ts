import { Injectable } from "@nestjs/common";
import { Round } from "../../../domain/round/round.aggregate";
import { RoundStatus } from "../../../domain/round/round-status.vo";
import type { RoundHistoryPage, RoundRepository } from "../../../domain/repositories/round.repository";
import { PrismaService } from "./prisma.service";

type RoundRow = {
  id: string;
  status: string;
  serverSeed: string;
  serverSeedHash: string;
  clientSeed: string;
  nonce: number;
  crashPoint: { toNumber(): number };
  algorithmVersion: string;
  bettingEndsAt: Date;
  startedAt: Date | null;
  crashedAt: Date | null;
  settledAt: Date | null;
  createdAt: Date;
};

@Injectable()
export class RoundPrismaRepository implements RoundRepository {
  constructor(private readonly prisma: PrismaService) {}

  private toDomain(row: RoundRow): Round {
    return Round.restore({
      id: row.id,
      status: row.status as RoundStatus,
      serverSeed: row.serverSeed,
      serverSeedHash: row.serverSeedHash,
      clientSeed: row.clientSeed,
      nonce: row.nonce,
      crashPoint: row.crashPoint.toNumber(),
      algorithmVersion: row.algorithmVersion,
      bettingEndsAt: row.bettingEndsAt,
      startedAt: row.startedAt,
      crashedAt: row.crashedAt,
      settledAt: row.settledAt,
      createdAt: row.createdAt,
    });
  }

  async create(round: Round): Promise<void> {
    const props = round.toPersistence();
    await this.prisma.round.create({
      data: {
        id: props.id,
        status: props.status,
        serverSeed: props.serverSeed,
        serverSeedHash: props.serverSeedHash,
        clientSeed: props.clientSeed,
        nonce: props.nonce,
        crashPoint: props.crashPoint,
        algorithmVersion: props.algorithmVersion,
        bettingEndsAt: props.bettingEndsAt,
        startedAt: props.startedAt,
        crashedAt: props.crashedAt,
        settledAt: props.settledAt,
        createdAt: props.createdAt,
      },
    });
  }

  async findById(id: string): Promise<Round | null> {
    const row = await this.prisma.round.findUnique({ where: { id } });
    return row ? this.toDomain(row as unknown as RoundRow) : null;
  }

  async findCurrent(): Promise<Round | null> {
    const row = await this.prisma.round.findFirst({
      where: { status: { not: "SETTLED" } },
      orderBy: { createdAt: "desc" },
    });
    return row ? this.toDomain(row as unknown as RoundRow) : null;
  }

  async findHistory(limit: number, cursor?: string | null): Promise<RoundHistoryPage> {
    const rows = await this.prisma.round.findMany({
      where: { status: "SETTLED" },
      orderBy: { createdAt: "desc" },
      take: limit + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    });
    const hasMore = rows.length > limit;
    const items = (hasMore ? rows.slice(0, limit) : rows) as unknown as RoundRow[];
    return {
      items: items.map((row) => this.toDomain(row)),
      nextCursor: hasMore ? items[items.length - 1].id : null,
    };
  }

  async save(round: Round): Promise<void> {
    const props = round.toPersistence();
    await this.prisma.round.update({
      where: { id: props.id },
      data: {
        status: props.status,
        startedAt: props.startedAt,
        crashedAt: props.crashedAt,
        settledAt: props.settledAt,
      },
    });
  }

  async countAll(): Promise<number> {
    return this.prisma.round.count();
  }
}
