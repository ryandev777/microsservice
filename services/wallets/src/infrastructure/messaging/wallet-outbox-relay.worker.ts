import { Inject, Injectable, Logger, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { OUTBOX_REPOSITORY } from "../../domain/repositories/outbox.repository";
import type { OutboxRepository } from "../../domain/repositories/outbox.repository";
import { RabbitmqConnectionService } from "./rabbitmq.connection";

const POLL_INTERVAL_MS = 200;
const BATCH_SIZE = 50;

@Injectable()
export class WalletOutboxRelayWorker implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(WalletOutboxRelayWorker.name);
  private timer?: ReturnType<typeof setInterval>;
  private ticking = false;

  constructor(
    @Inject(OUTBOX_REPOSITORY) private readonly outboxRepository: OutboxRepository,
    private readonly rabbitmq: RabbitmqConnectionService,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.rabbitmq.whenReady();
    this.timer = setInterval(() => void this.tick(), POLL_INTERVAL_MS);
  }

  onModuleDestroy(): void {
    if (this.timer) clearInterval(this.timer);
  }

  private async tick(): Promise<void> {
    if (this.ticking) return;
    this.ticking = true;
    try {
      const pending = await this.outboxRepository.claimPending(BATCH_SIZE);
      for (const message of pending) {
        try {
          const channel = this.rabbitmq.getChannel();
          const content = Buffer.from(JSON.stringify(message.payload));
          await new Promise<void>((resolve, reject) => {
            channel.publish(
              this.rabbitmq.walletsExchange,
              message.eventType,
              content,
              { persistent: true },
              (err) => (err ? reject(err) : resolve()),
            );
          });
          await this.outboxRepository.markPublished(message.id);
        } catch (error) {
          this.logger.error(`Failed to publish outbox message ${message.id}`, error as Error);
          await this.outboxRepository.markFailedAttempt(message.id);
        }
      }
    } catch (error) {
      this.logger.error("Outbox relay tick failed", error as Error);
    } finally {
      this.ticking = false;
    }
  }
}
