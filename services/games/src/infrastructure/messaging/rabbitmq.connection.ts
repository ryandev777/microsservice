import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import * as amqp from "amqplib";

export const GAMES_EXCHANGE = process.env.RABBITMQ_EXCHANGE_GAMES ?? "games.events";
export const WALLETS_EXCHANGE = process.env.RABBITMQ_EXCHANGE_WALLETS ?? "wallets.events";
export const GAMES_DLX = "games.events.dlx";
export const GAMES_WALLET_RESULTS_QUEUE = "games.wallet-results";
export const GAMES_DLQ = "games.dlq";

/**
 * Owns a single amqplib connection + confirm channel for the games
 * service, and declares the topology this service needs: the two topic
 * exchanges, this service's inbound queue (bound to wallet result events),
 * and a dead-letter exchange/queue for messages that exhaust retries.
 */
@Injectable()
export class RabbitmqConnection implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RabbitmqConnection.name);
  private connection: amqp.ChannelModel | null = null;
  private confirmChannel: amqp.ConfirmChannel | null = null;

  async onModuleInit(): Promise<void> {
    await this.connectWithRetry();
  }

  async onModuleDestroy(): Promise<void> {
    await this.confirmChannel?.close().catch(() => undefined);
    await this.connection?.close().catch(() => undefined);
  }

  getChannel(): amqp.ConfirmChannel {
    if (!this.confirmChannel) {
      throw new Error("RabbitMQ channel is not initialized yet");
    }
    return this.confirmChannel;
  }

  private async connectWithRetry(attempt = 1): Promise<void> {
    try {
      const url = process.env.RABBITMQ_URL ?? "amqp://admin:admin@localhost:5672";
      this.connection = await amqp.connect(url);
      this.confirmChannel = await this.connection.createConfirmChannel();
      await this.declareTopology(this.confirmChannel);
      this.logger.log("Connected to RabbitMQ and declared topology");

      this.connection.on("close", () => {
        this.logger.warn("RabbitMQ connection closed, reconnecting...");
        this.confirmChannel = null;
        this.connectWithRetry().catch((err) => this.logger.error(err));
      });
    } catch (error) {
      const delayMs = Math.min(1000 * attempt, 10_000);
      this.logger.warn(`Failed to connect to RabbitMQ (attempt ${attempt}), retrying in ${delayMs}ms`);
      await new Promise((resolve) => setTimeout(resolve, delayMs));
      await this.connectWithRetry(attempt + 1);
    }
  }

  private async declareTopology(channel: amqp.ConfirmChannel): Promise<void> {
    await channel.assertExchange(GAMES_EXCHANGE, "topic", { durable: true });
    await channel.assertExchange(WALLETS_EXCHANGE, "topic", { durable: true });
    await channel.assertExchange(GAMES_DLX, "topic", { durable: true });

    await channel.assertQueue(GAMES_DLQ, { durable: true });
    await channel.bindQueue(GAMES_DLQ, GAMES_DLX, "#");

    await channel.assertQueue(GAMES_WALLET_RESULTS_QUEUE, {
      durable: true,
      deadLetterExchange: GAMES_DLX,
    });
    await channel.bindQueue(GAMES_WALLET_RESULTS_QUEUE, WALLETS_EXCHANGE, "wallet.debit.succeeded");
    await channel.bindQueue(GAMES_WALLET_RESULTS_QUEUE, WALLETS_EXCHANGE, "wallet.debit.failed");
    await channel.bindQueue(GAMES_WALLET_RESULTS_QUEUE, WALLETS_EXCHANGE, "wallet.credit.succeeded");
    await channel.bindQueue(GAMES_WALLET_RESULTS_QUEUE, WALLETS_EXCHANGE, "wallet.credit.failed");
  }
}
