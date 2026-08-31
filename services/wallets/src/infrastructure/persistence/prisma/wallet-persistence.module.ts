import { Module } from "@nestjs/common";
import { WALLET_REPOSITORY } from "../../../domain/repositories/wallet.repository";
import { OUTBOX_REPOSITORY } from "../../../domain/repositories/outbox.repository";
import { WalletPrismaRepository } from "./wallet.prisma.repository";
import { OutboxPrismaRepository } from "./outbox.prisma.repository";

@Module({
  providers: [
    { provide: WALLET_REPOSITORY, useClass: WalletPrismaRepository },
    { provide: OUTBOX_REPOSITORY, useClass: OutboxPrismaRepository },
  ],
  exports: [WALLET_REPOSITORY, OUTBOX_REPOSITORY],
})
export class WalletPersistenceModule {}
