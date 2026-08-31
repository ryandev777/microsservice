import { Inject, Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { PlayerId } from "../../domain/shared/player-id.vo";
import { Money } from "../../domain/shared/money.vo";
import { Wallet } from "../../domain/wallet/wallet.aggregate";
import { WalletAlreadyExistsError } from "../../domain/wallet/wallet.errors";
import { WalletTransactionType } from "../../domain/wallet/wallet-transaction-type.vo";
import { WALLET_REPOSITORY } from "../../domain/repositories/wallet.repository";
import type { WalletRepository } from "../../domain/repositories/wallet.repository";

const DEFAULT_INITIAL_BALANCE_CENTS = 100_000n; // 1,000.00 — new wallets are funded so the
// player can bet immediately (deposits aren't exposed over REST per the README, so this is
// the only way a fresh wallet gets a balance without a manual DB step).

@Injectable()
export class CreateWalletUseCase {
  constructor(
    @Inject(WALLET_REPOSITORY) private readonly walletRepository: WalletRepository,
    private readonly config: ConfigService,
  ) {}

  async execute(playerIdRaw: string): Promise<Wallet> {
    const playerId = PlayerId.from(playerIdRaw);
    const existing = await this.walletRepository.findByPlayerId(playerId);
    if (existing) {
      throw new WalletAlreadyExistsError(playerIdRaw);
    }

    const wallet = Wallet.create(playerId);
    const initialBalanceCents = BigInt(
      this.config.get<string>("INITIAL_WALLET_BALANCE_CENTS") ?? DEFAULT_INITIAL_BALANCE_CENTS.toString(),
    );
    if (initialBalanceCents > 0n) {
      wallet.credit(Money.fromCents(initialBalanceCents), "initial-seed", WalletTransactionType.CREDIT_REFUND);
    }

    await this.walletRepository.create(wallet);
    return wallet;
  }
}
