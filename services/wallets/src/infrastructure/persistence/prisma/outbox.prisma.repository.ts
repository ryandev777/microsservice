import { Injectable } from "@nestjs/common";
import {
  OutboxRepository,
  PendingOutboxMessage,
} from "../../../domain/repositories/outbox.repository";
import { PrismaService } from "./prisma.service";

interface OutboxRow {
  id: string;
  event_type: string;
  payload: Record<string, unknown>;
  attempts: number;
}

@Injectable()
export class OutboxPrismaRepository implements OutboxRepository {
  constructor(private readonly prisma: PrismaService) {}

  async claimPending(limit: number): Promise<PendingOutboxMessage[]> {
    const rows = await this.prisma.$queryRaw<OutboxRow[]>`
      SELECT id, event_type, payload, attempts
      FROM outbox_messages
      WHERE published_at IS NULL
      ORDER BY created_at ASC
      LIMIT ${limit}
      FOR UPDATE SKIP LOCKED
    `;
    return rows.map((row) => ({
      id: row.id,
      eventType: row.event_type,
      payload: row.payload,
      attempts: row.attempts,
    }));
  }

  async markPublished(id: string): Promise<void> {
    await this.prisma.outboxMessage.update({
      where: { id },
      data: { publishedAt: new Date() },
    });
  }

  async markFailedAttempt(id: string): Promise<void> {
    await this.prisma.outboxMessage.update({
      where: { id },
      data: { attempts: { increment: 1 } },
    });
  }
}
