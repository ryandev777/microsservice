import { Injectable, Logger, OnModuleInit } from "@nestjs/common";
import { PrismaService } from "../persistence/prisma/prisma.service";
import { GAMES_EXCHANGE, RabbitmqConnection } from "./rabbitmq.connection";

const POLL_INTERVAL_MS = 200;
const BATCH_SIZE = 50;

/**
 * Transactional outbox relay: polls OutboxMessage rows written in the same
 * DB transaction as the domain change, publishes each to `games.events`
 * with routing key = eventType, and only marks it published after the
 * broker confirms receipt (publisher confirms). If the broker is down the
 * row stays unpublished and is retried on the next tick — at-least-once
 * delivery; dedup is the consumer's (inbox) responsibility.
 */
@Injectable()
export class GamesOutboxRelayWorker implements OnModuleInit {
  private readonly logger = new Logger(GamesOutboxRelayWorker.name);
  private running = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly rabbitmq: RabbitmqConnection,
  ) {}

  onModuleInit(): void {
    setInterval(() => {
      this.tick().catch((err) => this.logger.error(err));
    }, POLL_INTERVAL_MS);
  }

  private async tick(): Promise<void> {
    if (this.running) {
      return;
    }
    this.running = true;
    try {
      const messages = await this.prisma.outboxMessage.findMany({
        where: { publishedAt: null },
        orderBy: { createdAt: "asc" },
        take: BATCH_SIZE,
      });

      for (const message of messages) {
        try {
          const channel = this.rabbitmq.getChannel();
          // The message body IS the business payload (it already carries its
          // own stable `messageId`, set once when the outbox row was
          // created) — no extra wrapper. eventType travels as the routing
          // key, which the consumer reads from the AMQP envelope rather
          // than the JSON body, so retried publishes stay idempotent: the
          // body never changes across attempts.
          await new Promise<void>((resolve, reject) => {
            channel.publish(
              GAMES_EXCHANGE,
              message.eventType,
              Buffer.from(JSON.stringify(message.payload)),
              { persistent: true },
              (err) => (err ? reject(err) : resolve()),
            );
          });

          await this.prisma.outboxMessage.update({
            where: { id: message.id },
            data: { publishedAt: new Date() },
          });
        } catch (error) {
          await this.prisma.outboxMessage.update({
            where: { id: message.id },
            data: { attempts: { increment: 1 } },
          });
          this.logger.warn(`Failed to publish outbox message ${message.id}: ${(error as Error).message}`);
        }
      }
    } finally {
      this.running = false;
    }
  }
}
