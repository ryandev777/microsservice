import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { PassportModule } from "@nestjs/passport";
import { GamesController } from "./presentation/controllers/games.controller";
import { BetsController } from "./presentation/controllers/bets.controller";

import { PrismaService } from "./infrastructure/persistence/prisma/prisma.service";
import { RoundPrismaRepository } from "./infrastructure/persistence/prisma/round.prisma.repository";
import { BetPrismaRepository } from "./infrastructure/persistence/prisma/bet.prisma.repository";
import { ROUND_REPOSITORY } from "./domain/repositories/round.repository";
import { BET_REPOSITORY } from "./domain/repositories/bet.repository";

import { RabbitmqConnection } from "./infrastructure/messaging/rabbitmq.connection";
import { GamesOutboxRelayWorker } from "./infrastructure/messaging/games-outbox-relay.worker";
import { WalletEventsConsumer } from "./infrastructure/messaging/wallet-events.consumer";

import { MultiplierClockService } from "./infrastructure/scheduler/multiplier-clock.service";
import { RoundLifecycleScheduler } from "./infrastructure/scheduler/round-lifecycle.scheduler";
import { MULTIPLIER_CLOCK } from "./application/ports/multiplier-clock.port";

import { GameGateway } from "./infrastructure/websocket/game.gateway";
import { ROUND_BROADCASTER } from "./application/ports/round-broadcaster.port";

import { JwtStrategy } from "./infrastructure/auth/jwt.strategy";

import { PlaceBetUseCase } from "./application/use-cases/place-bet.use-case";
import { ConfirmBetUseCase } from "./application/use-cases/confirm-bet.use-case";
import { RejectBetUseCase } from "./application/use-cases/reject-bet.use-case";
import { RequestCashoutUseCase } from "./application/use-cases/request-cashout.use-case";
import { ConfirmCashoutUseCase } from "./application/use-cases/confirm-cashout.use-case";
import { SettleRoundUseCase } from "./application/use-cases/settle-round.use-case";
import { GetCurrentRoundUseCase } from "./application/use-cases/get-current-round.use-case";
import { GetRoundHistoryUseCase } from "./application/use-cases/get-round-history.use-case";
import { VerifyRoundUseCase } from "./application/use-cases/verify-round.use-case";
import { GetMyBetsUseCase } from "./application/use-cases/get-my-bets.use-case";

@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true }), PassportModule],
  controllers: [GamesController, BetsController],
  providers: [
    PrismaService,
    { provide: ROUND_REPOSITORY, useClass: RoundPrismaRepository },
    { provide: BET_REPOSITORY, useClass: BetPrismaRepository },

    RabbitmqConnection,
    GamesOutboxRelayWorker,
    WalletEventsConsumer,

    MultiplierClockService,
    { provide: MULTIPLIER_CLOCK, useExisting: MultiplierClockService },
    RoundLifecycleScheduler,

    GameGateway,
    { provide: ROUND_BROADCASTER, useExisting: GameGateway },

    JwtStrategy,

    PlaceBetUseCase,
    ConfirmBetUseCase,
    RejectBetUseCase,
    RequestCashoutUseCase,
    ConfirmCashoutUseCase,
    SettleRoundUseCase,
    GetCurrentRoundUseCase,
    GetRoundHistoryUseCase,
    VerifyRoundUseCase,
    GetMyBetsUseCase,
  ],
})
export class AppModule {}
