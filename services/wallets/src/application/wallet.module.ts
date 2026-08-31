import { Module } from "@nestjs/common";
import { WalletPersistenceModule } from "../infrastructure/persistence/prisma/wallet-persistence.module";
import { AuthModule } from "../infrastructure/auth/auth.module";
import { WalletsController } from "../presentation/controllers/wallets.controller";
import { CreateWalletUseCase } from "./use-cases/create-wallet.use-case";
import { GetWalletBalanceUseCase } from "./use-cases/get-wallet-balance.use-case";

@Module({
  imports: [WalletPersistenceModule, AuthModule],
  controllers: [WalletsController],
  providers: [CreateWalletUseCase, GetWalletBalanceUseCase],
})
export class WalletModule {}
