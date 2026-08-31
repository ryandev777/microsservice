import { Injectable, Logger, OnModuleInit } from "@nestjs/common";
import type { ConsumeMessage } from "amqplib";
import { ConfirmBetUseCase } from "../../application/use-cases/confirm-bet.use-case";
import { RejectBetUseCase } from "../../application/use-cases/reject-bet.use-case";
import { ConfirmCashoutUseCase } from "../../application/use-cases/confirm-cashout.use-case";
import { GAMES_WALLET_RESULTS_QUEUE, RabbitmqConnection } from "./rabbitmq.connection";

@Injectable()
export class WalletEventsConsumer implements OnModuleInit {
  private readonly logger = new Logger(WalletEventsConsumer.name);

  constructor(
    private readonly rabbitmq: RabbitmqConnection,
    private readonly confirmBet: ConfirmBetUseCase,
    private readonly rejectBet: RejectBetUseCase,
    private readonly confirmCashout: ConfirmCashoutUseCase,
  ) {}

  onModuleInit(): void {
    // Channel might not be ready yet on the very first tick; retry briefly.
    this.subscribeWhenReady();
  }

  private subscribeWhenReady(attempt = 1): void {
    try {
      const channel = this.rabbitmq.getChannel();
      channel
        .consume(GAMES_WALLET_RESULTS_QUEUE, (msg) => this.handleMessage(msg))
        .catch((err) => this.logger.error(err));
    } catch {
      if (attempt > 20) {
        this.logger.error("Giving up subscribing to wallet events queue");
        return;
      }
      setTimeout(() => this.subscribeWhenReady(attempt + 1), 500);
    }
  }

  private async handleMessage(msg: ConsumeMessage | null): Promise<void> {
    if (!msg) {
      return;
    }
    const channel = this.rabbitmq.getChannel();

    try {
      // The body is the flat business payload published by the wallets
      // outbox relay (see wallet-outbox-relay.worker.ts); eventType travels
      // as the AMQP routing key, not inside the JSON body, so retried
      // publishes never change shape.
      const payload = JSON.parse(msg.content.toString()) as Record<string, unknown>;
      const eventType = msg.fields.routingKey;
      const messageId = String(payload.messageId);

      switch (eventType) {
        case "wallet.debit.succeeded":
          await this.confirmBet.execute({
            messageId,
            betId: String(payload.betId),
            roundId: String(payload.roundId),
            playerId: String(payload.playerId),
            amountCents: String(payload.amountCents),
          });
          break;
        case "wallet.debit.failed":
          await this.rejectBet.execute({
            messageId,
            betId: String(payload.betId),
            roundId: String(payload.roundId),
            playerId: String(payload.playerId),
            reason: String(payload.reason ?? "UNKNOWN"),
          });
          break;
        case "wallet.credit.succeeded":
          await this.confirmCashout.execute({
            messageId,
            betId: String(payload.betId),
            roundId: String(payload.roundId),
            playerId: String(payload.playerId),
            payoutAmountCents: String(payload.payoutAmountCents),
          });
          break;
        default:
          this.logger.warn(`Unknown event type: ${eventType}`);
      }

      channel.ack(msg);
    } catch (error) {
      this.logger.error(`Failed to process wallet event: ${(error as Error).message}`);
      // Route straight to the DLQ (see rabbitmq.connection.ts topology).
      // A full N-retry-then-DLQ policy would need republishing with an
      // incremented header; out of scope for this challenge.
      channel.nack(msg, false, false);
    }
  }
}
