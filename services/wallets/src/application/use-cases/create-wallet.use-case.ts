import { Inject, Injectable } from "@nestjs/common";
import { PlayerId } from "../../domain/shared/player-id.vo";
import { Wallet } from "../../domain/wallet/wallet.aggregate";
import { WalletAlreadyExistsError } from "../../domain/wallet/wallet.errors";
import { WALLET_REPOSITORY } from "../../domain/repositories/wallet.repository";
import type { WalletRepository } from "../../domain/repositories/wallet.repository";

@Injectable()
export class CreateWalletUseCase {
  constructor(@Inject(WALLET_REPOSITORY) private readonly walletRepository: WalletRepository) {}

  async execute(playerIdRaw: string): Promise<Wallet> {
    const playerId = PlayerId.from(playerIdRaw);
    const existing = await this.walletRepository.findByPlayerId(playerId);
    if (existing) {
      throw new WalletAlreadyExistsError(playerIdRaw);
    }

    const wallet = Wallet.create(playerId);
    await this.walletRepository.create(wallet);
    return wallet;
  }
}
