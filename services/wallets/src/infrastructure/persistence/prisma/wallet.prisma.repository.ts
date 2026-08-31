import { ConflictException, Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PlayerId } from "../../../domain/shared/player-id.vo";
import { Money } from "../../../domain/shared/money.vo";
import { Wallet } from "../../../domain/wallet/wallet.aggregate";
import { WalletAlreadyExistsError } from "../../../domain/wallet/wallet.errors";
import { DUPLICATE_MESSAGE } from "../../../domain/repositories/wallet.repository";
import type {
  WalletMutationResult,
  WalletRepository,
} from "../../../domain/repositories/wallet.repository";
import { PrismaService } from "./prisma.service";

interface WalletRow {
  id: string;
  player_id: string;
  balance_cents: bigint;
  created_at: Date;
  updated_at: Date;
}

function toWallet(row: WalletRow): Wallet {
  return Wallet.restore({
    id: row.id,
    playerId: PlayerId.from(row.player_id),
    balance: Money.fromCents(row.balance_cents),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  });
}

@Injectable()
export class WalletPrismaRepository implements WalletRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(wallet: Wallet): Promise<void> {
    try {
      await this.prisma.wallet.create({
        data: {
          id: wallet.id,
          playerId: wallet.playerId.toString(),
          balanceCents: wallet.balance.toCents(),
        },
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        throw new WalletAlreadyExistsError(wallet.playerId.toString());
      }
      throw error;
    }
  }

  async findByPlayerId(playerId: PlayerId): Promise<Wallet | null> {
    const row = await this.prisma.wallet.findUnique({
      where: { playerId: playerId.toString() },
    });
    if (!row) return null;
    return toWallet({
      id: row.id,
      player_id: row.playerId,
      balance_cents: row.balanceCents,
      created_at: row.createdAt,
      updated_at: row.updatedAt,
    });
  }

  async withLockedWalletIdempotent<T>(
    playerId: PlayerId,
    messageId: string,
    eventType: string,
    mutate: (wallet: Wallet) => WalletMutationResult<T>,
  ): Promise<T | typeof DUPLICATE_MESSAGE> {
    return this.prisma.$transaction(async (tx) => {
      const inserted = await tx.$executeRaw`
        INSERT INTO inbox_messages (message_id, event_type)
        VALUES (${messageId}, ${eventType})
        ON CONFLICT (message_id) DO NOTHING
      `;
      if (inserted === 0) {
        return DUPLICATE_MESSAGE;
      }

      const rows = await tx.$queryRaw<WalletRow[]>`
        SELECT id, player_id, balance_cents, created_at, updated_at
        FROM wallets
        WHERE player_id = ${playerId.toString()}
        FOR UPDATE
      `;
      if (rows.length === 0) {
        throw new ConflictException(`Wallet not found for player ${playerId.toString()}`);
      }

      const wallet = toWallet(rows[0]);
      const { result, transaction, outboxEvents } = mutate(wallet);

      await tx.wallet.update({
        where: { id: wallet.id },
        data: { balanceCents: wallet.balance.toCents(), updatedAt: new Date() },
      });

      if (transaction) {
        await tx.walletTransaction.create({
          data: {
            id: transaction.id,
            walletId: transaction.walletId,
            type: transaction.type,
            amountCents: transaction.amount.toCents(),
            referenceId: transaction.referenceId,
          },
        });
      }

      if (outboxEvents && outboxEvents.length > 0) {
        await tx.outboxMessage.createMany({
          data: outboxEvents.map((event) => ({
            eventType: event.eventType,
            payload: serializeBigInts(event.payload) as Prisma.InputJsonValue,
          })),
        });
      }

      return result;
    });
  }
}

function serializeBigInts(value: unknown): unknown {
  if (typeof value === "bigint") return value.toString();
  if (Array.isArray(value)) return value.map(serializeBigInts);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([k, v]) => [k, serializeBigInts(v)]),
    );
  }
  return value;
}
