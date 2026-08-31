import { Inject, Injectable } from "@nestjs/common";
import { BET_REPOSITORY } from "../../domain/repositories/bet.repository";
import type { BetRepository } from "../../domain/repositories/bet.repository";
import { ROUND_BROADCASTER } from "../ports/round-broadcaster.port";
import type { RoundBroadcaster } from "../ports/round-broadcaster.port";

export interface RejectBetInput {
  messageId: string;
  betId: string;
  roundId: string;
  playerId: string;
  reason: string;
}

@Injectable()
export class RejectBetUseCase {
  constructor(
    @Inject(BET_REPOSITORY) private readonly betRepository: BetRepository,
    @Inject(ROUND_BROADCASTER) private readonly broadcaster: RoundBroadcaster,
  ) {}

  async execute(input: RejectBetInput): Promise<void> {
    const isNew = await this.betRepository.tryConsumeMessage(input.messageId, "wallet.debit.failed");
    if (!isNew) {
      return;
    }

    const bet = await this.betRepository.findById(input.betId);
    if (!bet) {
      return;
    }

    bet.reject();
    await this.betRepository.save(bet);

    this.broadcaster.emitToPlayer(input.playerId, "bet:rejected", {
      betId: bet.id,
      reason: input.reason,
    });
  }
}
