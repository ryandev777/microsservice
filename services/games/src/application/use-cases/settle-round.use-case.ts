import { Inject, Injectable } from "@nestjs/common";
import { BET_REPOSITORY } from "../../domain/repositories/bet.repository";
import type { BetRepository } from "../../domain/repositories/bet.repository";
import { ROUND_REPOSITORY } from "../../domain/repositories/round.repository";
import type { RoundRepository } from "../../domain/repositories/round.repository";

export class RoundNotFoundError extends Error {
  constructor(roundId: string) {
    super(`Round ${roundId} not found`);
    this.name = "RoundNotFoundError";
  }
}

@Injectable()
export class SettleRoundUseCase {
  constructor(
    @Inject(ROUND_REPOSITORY) private readonly roundRepository: RoundRepository,
    @Inject(BET_REPOSITORY) private readonly betRepository: BetRepository,
  ) {}

  async execute(roundId: string): Promise<{ lostBetsCount: number }> {
    const round = await this.roundRepository.findById(roundId);
    if (!round) {
      throw new RoundNotFoundError(roundId);
    }

    const pendingBets = await this.betRepository.findPendingBetsByRound(roundId);
    for (const bet of pendingBets) {
      bet.markLost();
    }
    await this.betRepository.saveMany(pendingBets);

    round.settle();
    await this.roundRepository.save(round);

    return { lostBetsCount: pendingBets.length };
  }
}
