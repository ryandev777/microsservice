import { Module } from "@nestjs/common";
import { WalletPersistenceModule } from "../persistence/prisma/wallet-persistence.module";
import { HandleBetPlacedUseCase } from "../../application/use-cases/handle-bet-placed.use-case";
import { HandleCashoutRequestedUseCase } from "../../application/use-cases/handle-cashout-requested.use-case";
import { RabbitmqConnectionService } from "./rabbitmq.connection";
import { WalletOutboxRelayWorker } from "./wallet-outbox-relay.worker";
import { WalletEventsConsumer } from "./wallet-events.consumer";

@Module({
  imports: [WalletPersistenceModule],
  providers: [
    RabbitmqConnectionService,
    WalletOutboxRelayWorker,
    WalletEventsConsumer,
    HandleBetPlacedUseCase,
    HandleCashoutRequestedUseCase,
  ],
  exports: [RabbitmqConnectionService],
})
export class RabbitmqModule {}
