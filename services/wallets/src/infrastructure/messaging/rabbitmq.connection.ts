import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import * as amqplib from "amqplib";

const GAMES_EXCHANGE_DEFAULT = "games.events";
const WALLETS_EXCHANGE_DEFAULT = "wallets.events";

@Injectable()
export class RabbitmqConnectionService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RabbitmqConnectionService.name);
  private connection?: amqplib.ChannelModel;
  private confirmChannel?: amqplib.ConfirmChannel;
  private readyPromise?: Promise<void>;

  readonly gamesExchange: string;
  readonly walletsExchange: string;

  constructor(private readonly config: ConfigService) {
    this.gamesExchange = this.config.get<string>("RABBITMQ_EXCHANGE_GAMES") ?? GAMES_EXCHANGE_DEFAULT;
    this.walletsExchange =
      this.config.get<string>("RABBITMQ_EXCHANGE_WALLETS") ?? WALLETS_EXCHANGE_DEFAULT;
  }

  onModuleInit(): Promise<void> {
    this.readyPromise = this.connect();
    return this.readyPromise;
  }

  /**
   * Providers that depend on the channel (outbox relay, consumers) must
   * await this before touching getChannel() — Nest does not guarantee that
   * a dependency's onModuleInit has resolved before a dependent's runs.
   */
  async whenReady(): Promise<void> {
    if (!this.readyPromise) {
      throw new Error("RabbitmqConnectionService.onModuleInit has not been triggered yet");
    }
    await this.readyPromise;
  }

  private async connect(): Promise<void> {
    const url = this.config.get<string>("RABBITMQ_URL");
    this.connection = await amqplib.connect(url as string);
    this.confirmChannel = await this.connection.createConfirmChannel();
    await this.confirmChannel.prefetch(10);

    await this.confirmChannel.assertExchange(this.gamesExchange, "topic", { durable: true });
    await this.confirmChannel.assertExchange(this.walletsExchange, "topic", { durable: true });

    await this.confirmChannel.assertExchange("wallets.events.dlx", "topic", { durable: true });
    await this.confirmChannel.assertQueue("wallets.dlq", { durable: true });
    await this.confirmChannel.bindQueue("wallets.dlq", "wallets.events.dlx", "#");

    await this.confirmChannel.assertQueue("wallets.bet-processing", {
      durable: true,
      arguments: { "x-dead-letter-exchange": "wallets.events.dlx" },
    });
    await this.confirmChannel.bindQueue("wallets.bet-processing", this.gamesExchange, "bet.placed");

    await this.confirmChannel.assertQueue("wallets.cashout-processing", {
      durable: true,
      arguments: { "x-dead-letter-exchange": "wallets.events.dlx" },
    });
    await this.confirmChannel.bindQueue(
      "wallets.cashout-processing",
      this.gamesExchange,
      "bet.cashout.requested",
    );

    this.logger.log("Connected to RabbitMQ and declared wallets topology");
  }

  getChannel(): amqplib.ConfirmChannel {
    if (!this.confirmChannel) {
      throw new Error("RabbitMQ channel not initialized yet");
    }
    return this.confirmChannel;
  }

  async onModuleDestroy(): Promise<void> {
    await this.confirmChannel?.close();
    await this.connection?.close();
  }
}
