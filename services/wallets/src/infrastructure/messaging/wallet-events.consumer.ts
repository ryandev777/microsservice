import { Injectable, Logger, OnModuleInit } from "@nestjs/common";
import type { ConsumeMessage } from "amqplib";
import { HandleBetPlacedUseCase } from "../../application/use-cases/handle-bet-placed.use-case";
import { HandleCashoutRequestedUseCase } from "../../application/use-cases/handle-cashout-requested.use-case";
import { RabbitmqConnectionService } from "./rabbitmq.connection";

@Injectable()
export class WalletEventsConsumer implements OnModuleInit {
  private readonly logger = new Logger(WalletEventsConsumer.name);

  constructor(
    private readonly rabbitmq: RabbitmqConnectionService,
    private readonly handleBetPlaced: HandleBetPlacedUseCase,
    private readonly handleCashoutRequested: HandleCashoutRequestedUseCase,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.rabbitmq.whenReady();
    const channel = this.rabbitmq.getChannel();

    await channel.consume("wallets.bet-processing", (msg) => void this.onBetPlaced(msg));
    await channel.consume("wallets.cashout-processing", (msg) => void this.onCashoutRequested(msg));
  }

  private async onBetPlaced(msg: ConsumeMessage | null): Promise<void> {
    if (!msg) return;
    const channel = this.rabbitmq.getChannel();
    try {
      const body = JSON.parse(msg.content.toString()) as Record<string, unknown>;
      await this.handleBetPlaced.execute({
        messageId: body["messageId"] as string,
        betId: body["betId"] as string,
        roundId: body["roundId"] as string,
        playerId: body["playerId"] as string,
        amountCents: body["amountCents"] as number | string,
      });
      channel.ack(msg);
    } catch (error) {
      this.logger.error("Failed to process bet.placed message", error as Error);
      channel.nack(msg, false, false);
    }
  }

  private async onCashoutRequested(msg: ConsumeMessage | null): Promise<void> {
    if (!msg) return;
    const channel = this.rabbitmq.getChannel();
    try {
      const body = JSON.parse(msg.content.toString()) as Record<string, unknown>;
      await this.handleCashoutRequested.execute({
        messageId: body["messageId"] as string,
        betId: body["betId"] as string,
        roundId: body["roundId"] as string,
        playerId: body["playerId"] as string,
        cashoutMultiplier: body["cashoutMultiplier"] as number,
        payoutAmountCents: body["payoutAmountCents"] as number | string,
      });
      channel.ack(msg);
    } catch (error) {
      this.logger.error("Failed to process bet.cashout.requested message", error as Error);
      channel.nack(msg, false, false);
    }
  }
}
