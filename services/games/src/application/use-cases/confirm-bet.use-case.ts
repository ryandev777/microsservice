import { Inject, Injectable } from "@nestjs/common";
import { BET_REPOSITORY } from "../../domain/repositories/bet.repository";
import type { BetRepository } from "../../domain/repositories/bet.repository";
import { ROUND_BROADCASTER } from "../ports/round-broadcaster.port";
import type { RoundBroadcaster } from "../ports/round-broadcaster.port";

export interface ConfirmBetInput {
  messageId: string;
  betId: string;
  roundId: string;
  playerId: string;
  amountCents: string;
}

@Injectable()
export class ConfirmBetUseCase {
  constructor(
    @Inject(BET_REPOSITORY) private readonly betRepository: BetRepository,
    @Inject(ROUND_BROADCASTER) private readonly broadcaster: RoundBroadcaster,
  ) {}

  async execute(input: ConfirmBetInput): Promise<void> {
    const isNew = await this.betRepository.tryConsumeMessage(input.messageId, "wallet.debit.succeeded");
    if (!isNew) {
      return;
    }

    const bet = await this.betRepository.findById(input.betId);
    if (!bet) {
      return;
    }

    bet.confirm();
    await this.betRepository.save(bet);

    this.broadcaster.broadcastToRound(input.roundId, "bet:confirmed", {
      betId: bet.id,
      playerId: input.playerId,
      username: bet.username,
      amountCents: input.amountCents,
    });
  }
}
