import { describe, expect, it } from "bun:test";
import { Round } from "../../../src/domain/round/round.aggregate";
import { RoundNotInBettingPhaseError } from "../../../src/domain/round/round.errors";
import { DuplicateBetError } from "../../../src/domain/bet/bet.errors";
import { NoCurrentRoundError, PlaceBetUseCase } from "../../../src/application/use-cases/place-bet.use-case";
import { InMemoryBetRepository, InMemoryRoundRepository } from "./fakes";

function makeRound(overrides: Partial<{ bettingWindowMs: number }> = {}) {
  return Round.createNew({
    nonce: 1,
    seedPair: { serverSeed: "s", serverSeedHash: "h", clientSeed: "c", nonce: 1 },
    crashPoint: 2,
    bettingWindowMs: overrides.bettingWindowMs ?? 10_000,
    algorithmVersion: "HMAC_SHA256_V1",
  });
}

describe("PlaceBetUseCase", () => {
  it("throws when there is no current round", async () => {
    const useCase = new PlaceBetUseCase(new InMemoryRoundRepository(), new InMemoryBetRepository());
    await expect(useCase.execute({ playerId: "p1", username: "player1", amountCents: 100n })).rejects.toThrow(NoCurrentRoundError);
  });

  it("throws when the round is not in the betting phase", async () => {
    const rounds = new InMemoryRoundRepository();
    const round = makeRound({ bettingWindowMs: 0 });
    round.transitionToRunning();
    await rounds.create(round);

    const useCase = new PlaceBetUseCase(rounds, new InMemoryBetRepository());
    await expect(useCase.execute({ playerId: "p1", username: "player1", amountCents: 100n })).rejects.toThrow(
      RoundNotInBettingPhaseError,
    );
  });

  it("places a bet and enqueues a bet.placed outbox event", async () => {
    const rounds = new InMemoryRoundRepository();
    const round = makeRound();
    await rounds.create(round);
    const bets = new InMemoryBetRepository();

    const useCase = new PlaceBetUseCase(rounds, bets);
    const result = await useCase.execute({ playerId: "p1", username: "player1", amountCents: 500n });

    expect(result.status).toBe("PLACED_PENDING");
    expect(bets.outboxEvents).toHaveLength(1);
    expect(bets.outboxEvents[0].eventType).toBe("bet.placed");
    expect(bets.outboxEvents[0].payload.amountCents).toBe("500");
  });

  it("rejects a second bet from the same player in the same round", async () => {
    const rounds = new InMemoryRoundRepository();
    const round = makeRound();
    await rounds.create(round);
    const bets = new InMemoryBetRepository();

    const useCase = new PlaceBetUseCase(rounds, bets);
    await useCase.execute({ playerId: "p1", username: "player1", amountCents: 500n });

    await expect(useCase.execute({ playerId: "p1", username: "player1", amountCents: 500n })).rejects.toThrow(DuplicateBetError);
  });
});
