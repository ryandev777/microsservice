import { randomUUID } from "crypto";
import { Inject, Injectable } from "@nestjs/common";
import { RoundNotRunningError } from "../../domain/round/round.errors";
import { RoundStatus } from "../../domain/round/round-status.vo";
import { BET_REPOSITORY } from "../../domain/repositories/bet.repository";
import type { BetRepository } from "../../domain/repositories/bet.repository";
import { ROUND_REPOSITORY } from "../../domain/repositories/round.repository";
import type { RoundRepository } from "../../domain/repositories/round.repository";
import { MULTIPLIER_CLOCK } from "../ports/multiplier-clock.port";
import type { MultiplierClock } from "../ports/multiplier-clock.port";
import { NoCurrentRoundError } from "./place-bet.use-case";

export class NoBetForPlayerError extends Error {
  constructor(playerId: string) {
    super(`Player ${playerId} has no bet to cash out in the current round`);
    this.name = "NoBetForPlayerError";
  }
}

export interface RequestCashoutInput {
  playerId: string;
}

export interface RequestCashoutOutput {
  betId: string;
  cashoutMultiplier: number;
  payoutAmountCents: string;
}

@Injectable()
export class RequestCashoutUseCase {
  constructor(
    @Inject(ROUND_REPOSITORY) private readonly roundRepository: RoundRepository,
    @Inject(BET_REPOSITORY) private readonly betRepository: BetRepository,
    @Inject(MULTIPLIER_CLOCK) private readonly multiplierClock: MultiplierClock,
  ) {}

  async execute(input: RequestCashoutInput): Promise<RequestCashoutOutput> {
    const round = await this.roundRepository.findCurrent();
    if (!round) {
      throw new NoCurrentRoundError();
    }
    if (round.status !== RoundStatus.RUNNING) {
      throw new RoundNotRunningError(round.id);
    }

    const bet = await this.betRepository.findByRoundAndPlayer(round.id, input.playerId);
    if (!bet) {
      throw new NoBetForPlayerError(input.playerId);
    }

    // Never trust a client-supplied multiplier: recompute server-side from
    // elapsed time, the single source of truth also used for the WS tick.
    const currentMultiplier = this.multiplierClock.multiplierAt(round.elapsedRunningMs());

    bet.requestCashout(currentMultiplier);
    const payoutAmountCents = bet.payoutAmount!.toCents();

    await this.betRepository.save(bet, {
      eventType: "bet.cashout.requested",
      payload: {
        messageId: randomUUID(),
        betId: bet.id,
        roundId: round.id,
        playerId: input.playerId,
        cashoutMultiplier: currentMultiplier,
        payoutAmountCents: payoutAmountCents.toString(),
      },
    });

    return {
      betId: bet.id,
      cashoutMultiplier: currentMultiplier,
      payoutAmountCents: payoutAmountCents.toString(),
    };
  }
}
