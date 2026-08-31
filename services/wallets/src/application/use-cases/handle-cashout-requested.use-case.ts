import { Inject, Injectable, Logger } from "@nestjs/common";
import { randomUUID } from "crypto";
import { Money } from "../../domain/shared/money.vo";
import { PlayerId } from "../../domain/shared/player-id.vo";
import { WalletTransactionType } from "../../domain/wallet/wallet-transaction-type.vo";
import {
  DUPLICATE_MESSAGE,
  WALLET_REPOSITORY,
} from "../../domain/repositories/wallet.repository";
import type { WalletMutationResult, WalletRepository } from "../../domain/repositories/wallet.repository";

export interface CashoutRequestedPayload {
  messageId: string;
  betId: string;
  roundId: string;
  playerId: string;
  cashoutMultiplier: number;
  payoutAmountCents: number | string;
}

@Injectable()
export class HandleCashoutRequestedUseCase {
  private readonly logger = new Logger(HandleCashoutRequestedUseCase.name);

  constructor(@Inject(WALLET_REPOSITORY) private readonly walletRepository: WalletRepository) {}

  async execute(payload: CashoutRequestedPayload): Promise<void> {
    const playerId = PlayerId.from(payload.playerId);
    const amount = Money.fromCents(BigInt(payload.payoutAmountCents));

    const outcome = await this.walletRepository.withLockedWalletIdempotent(
      playerId,
      payload.messageId,
      "bet.cashout.requested",
      (wallet): WalletMutationResult<"succeeded"> => {
        const transaction = wallet.credit(amount, payload.betId, WalletTransactionType.CREDIT_PAYOUT);
        return {
          result: "succeeded",
          transaction,
          outboxEvents: [
            {
              eventType: "wallet.credit.succeeded",
              payload: {
                messageId: randomUUID(),
                betId: payload.betId,
                roundId: payload.roundId,
                playerId: payload.playerId,
                payoutAmountCents: payload.payoutAmountCents,
              },
            },
          ],
        };
      },
    );

    if (outcome === DUPLICATE_MESSAGE) {
      this.logger.warn(`Duplicate bet.cashout.requested message ignored: ${payload.messageId}`);
    }
  }
}
