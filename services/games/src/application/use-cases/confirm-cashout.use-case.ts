import { Inject, Injectable } from "@nestjs/common";
import { BET_REPOSITORY } from "../../domain/repositories/bet.repository";
import type { BetRepository } from "../../domain/repositories/bet.repository";
import { ROUND_BROADCASTER } from "../ports/round-broadcaster.port";
import type { RoundBroadcaster } from "../ports/round-broadcaster.port";

export interface ConfirmCashoutInput {
  messageId: string;
  betId: string;
  roundId: string;
  playerId: string;
  payoutAmountCents: string;
}

@Injectable()
export class ConfirmCashoutUseCase {
  constructor(
    @Inject(BET_REPOSITORY) private readonly betRepository: BetRepository,
    @Inject(ROUND_BROADCASTER) private readonly broadcaster: RoundBroadcaster,
  ) {}

  async execute(input: ConfirmCashoutInput): Promise<void> {
    const isNew = await this.betRepository.tryConsumeMessage(input.messageId, "wallet.credit.succeeded");
    if (!isNew) {
      return;
    }

    const bet = await this.betRepository.findById(input.betId);
    if (!bet) {
      return;
    }

    // The multiplier and payout were already fixed at request-cashout time
    // (see Bet.requestCashout) — this just finalizes the same numbers, so
    // the amount actually credited by Wallet and the amount recorded here
    // can never drift apart.
    bet.confirmCashout();
    await this.betRepository.save(bet);

    this.broadcaster.broadcastToRound(input.roundId, "bet:cashed_out", {
      betId: bet.id,
      playerId: input.playerId,
      username: bet.username,
      multiplier: bet.cashoutMultiplier,
      payoutAmountCents: input.payoutAmountCents,
    });
  }
}
