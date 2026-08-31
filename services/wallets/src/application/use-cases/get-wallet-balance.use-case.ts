import { Inject, Injectable } from "@nestjs/common";
import { PlayerId } from "../../domain/shared/player-id.vo";
import { Wallet } from "../../domain/wallet/wallet.aggregate";
import { WalletNotFoundError } from "../../domain/wallet/wallet.errors";
import { WALLET_REPOSITORY } from "../../domain/repositories/wallet.repository";
import type { WalletRepository } from "../../domain/repositories/wallet.repository";

@Injectable()
export class GetWalletBalanceUseCase {
  constructor(@Inject(WALLET_REPOSITORY) private readonly walletRepository: WalletRepository) {}

  async execute(playerIdRaw: string): Promise<Wallet> {
    const playerId = PlayerId.from(playerIdRaw);
    const wallet = await this.walletRepository.findByPlayerId(playerId);
    if (!wallet) {
      throw new WalletNotFoundError(playerIdRaw);
    }
    return wallet;
  }
}
