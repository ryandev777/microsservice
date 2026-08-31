import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { PrismaModule } from "./infrastructure/persistence/prisma/prisma.module";
import { RabbitmqModule } from "./infrastructure/messaging/rabbitmq.module";
import { WalletModule } from "./application/wallet.module";

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    RabbitmqModule,
    WalletModule,
  ],
})
export class AppModule {}
