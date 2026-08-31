import { randomUUID } from "crypto";
import { Inject, Injectable } from "@nestjs/common";
import { Bet } from "../../domain/bet/bet.entity";
import { Money } from "../../domain/shared/money.vo";
import { RoundNotInBettingPhaseError } from "../../domain/round/round.errors";
import { BET_REPOSITORY } from "../../domain/repositories/bet.repository";
import type { BetRepository } from "../../domain/repositories/bet.repository";
import { ROUND_REPOSITORY } from "../../domain/repositories/round.repository";
import type { RoundRepository } from "../../domain/repositories/round.repository";

export class NoCurrentRoundError extends Error {
  constructor() {
    super("There is no active round to bet on");
    this.name = "NoCurrentRoundError";
  }
}

export interface PlaceBetInput {
  playerId: string;
  username: string;
  amountCents: bigint;
}

export interface PlaceBetOutput {
  betId: string;
  roundId: string;
  status: string;
}

@Injectable()
export class PlaceBetUseCase {
  constructor(
    @Inject(ROUND_REPOSITORY) private readonly roundRepository: RoundRepository,
    @Inject(BET_REPOSITORY) private readonly betRepository: BetRepository,
  ) {}

  async execute(input: PlaceBetInput): Promise<PlaceBetOutput> {
    const round = await this.roundRepository.findCurrent();
    if (!round) {
      throw new NoCurrentRoundError();
    }
    if (!round.isBettingOpen()) {
      throw new RoundNotInBettingPhaseError(round.id);
    }

    const bet = Bet.place({
      roundId: round.id,
      playerId: input.playerId,
      username: input.username,
      amount: Money.fromCents(input.amountCents),
    });

    await this.betRepository.createWithOutbox(bet, {
      eventType: "bet.placed",
      payload: {
        messageId: randomUUID(),
        betId: bet.id,
        roundId: round.id,
        playerId: input.playerId,
        amountCents: input.amountCents.toString(),
      },
    });

    return { betId: bet.id, roundId: round.id, status: bet.status };
  }
}
