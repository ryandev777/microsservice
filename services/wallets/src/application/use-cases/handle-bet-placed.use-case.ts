import { Inject, Injectable, Logger } from "@nestjs/common";
import { randomUUID } from "crypto";
import { Money } from "../../domain/shared/money.vo";
import { PlayerId } from "../../domain/shared/player-id.vo";
import { InsufficientFundsError } from "../../domain/wallet/wallet.errors";
import { WalletTransactionType } from "../../domain/wallet/wallet-transaction-type.vo";
import {
  DUPLICATE_MESSAGE,
  WALLET_REPOSITORY,
} from "../../domain/repositories/wallet.repository";
import type { WalletMutationResult, WalletRepository } from "../../domain/repositories/wallet.repository";

export interface BetPlacedPayload {
  messageId: string;
  betId: string;
  roundId: string;
  playerId: string;
  amountCents: number | string;
}

@Injectable()
export class HandleBetPlacedUseCase {
  private readonly logger = new Logger(HandleBetPlacedUseCase.name);

  constructor(@Inject(WALLET_REPOSITORY) private readonly walletRepository: WalletRepository) {}

  async execute(payload: BetPlacedPayload): Promise<void> {
    const playerId = PlayerId.from(payload.playerId);
    const amount = Money.fromCents(BigInt(payload.amountCents));

    const outcome = await this.walletRepository.withLockedWalletIdempotent(
      playerId,
      payload.messageId,
      "bet.placed",
      (wallet): WalletMutationResult<"succeeded" | "failed"> => {
        try {
          const transaction = wallet.debit(amount, payload.betId, WalletTransactionType.DEBIT_BET);
          return {
            result: "succeeded",
            transaction,
            outboxEvents: [
              {
                eventType: "wallet.debit.succeeded",
                payload: {
                  messageId: randomUUID(),
                  betId: payload.betId,
                  roundId: payload.roundId,
                  playerId: payload.playerId,
                  amountCents: payload.amountCents,
                },
              },
            ],
          };
        } catch (error) {
          if (error instanceof InsufficientFundsError) {
            return {
              result: "failed",
              outboxEvents: [
                {
                  eventType: "wallet.debit.failed",
                  payload: {
                    messageId: randomUUID(),
                    betId: payload.betId,
                    roundId: payload.roundId,
                    playerId: payload.playerId,
                    reason: "INSUFFICIENT_FUNDS",
                  },
                },
              ],
            };
          }
          throw error;
        }
      },
    );

    if (outcome === DUPLICATE_MESSAGE) {
      this.logger.warn(`Duplicate bet.placed message ignored: ${payload.messageId}`);
    }
  }
}
