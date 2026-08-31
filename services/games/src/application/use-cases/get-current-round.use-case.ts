import { Inject, Injectable } from "@nestjs/common";
import { RoundStatus } from "../../domain/round/round-status.vo";
import { ROUND_REPOSITORY } from "../../domain/repositories/round.repository";
import type { RoundRepository } from "../../domain/repositories/round.repository";
import { BET_REPOSITORY } from "../../domain/repositories/bet.repository";
import type { BetRepository } from "../../domain/repositories/bet.repository";
import { MULTIPLIER_CLOCK } from "../ports/multiplier-clock.port";
import type { MultiplierClock } from "../ports/multiplier-clock.port";

export interface CurrentRoundView {
  roundId: string;
  status: RoundStatus;
  serverSeedHash: string;
  bettingEndsAt: string;
  startedAt: string | null;
  currentMultiplier: number | null;
  activeBets: Array<{ betId: string; playerId: string; username: string; amountCents: string; status: string }>;
}

@Injectable()
export class GetCurrentRoundUseCase {
  constructor(
    @Inject(ROUND_REPOSITORY) private readonly roundRepository: RoundRepository,
    @Inject(BET_REPOSITORY) private readonly betRepository: BetRepository,
    @Inject(MULTIPLIER_CLOCK) private readonly multiplierClock: MultiplierClock,
  ) {}

  async execute(): Promise<CurrentRoundView | null> {
    const round = await this.roundRepository.findCurrent();
    if (!round) {
      return null;
    }

    const activeBets = await this.betRepository.findPendingBetsByRound(round.id);

    return {
      roundId: round.id,
      status: round.status,
      serverSeedHash: round.serverSeedHash,
      bettingEndsAt: round.bettingEndsAt.toISOString(),
      startedAt: round.startedAt?.toISOString() ?? null,
      currentMultiplier:
        round.status === RoundStatus.RUNNING ? this.multiplierClock.multiplierAt(round.elapsedRunningMs()) : null,
      activeBets: activeBets.map((bet) => ({
        betId: bet.id,
        playerId: bet.playerId,
        username: bet.username,
        amountCents: bet.amount.toCents().toString(),
        status: bet.status,
      })),
    };
  }
}
