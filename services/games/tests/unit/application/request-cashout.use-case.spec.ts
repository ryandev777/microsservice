import { describe, expect, it } from "bun:test";
import { Bet } from "../../../src/domain/bet/bet.entity";
import { Money } from "../../../src/domain/shared/money.vo";
import { Round } from "../../../src/domain/round/round.aggregate";
import { RoundNotRunningError } from "../../../src/domain/round/round.errors";
import {
  NoBetForPlayerError,
  RequestCashoutUseCase,
} from "../../../src/application/use-cases/request-cashout.use-case";
import { FakeMultiplierClock, InMemoryBetRepository, InMemoryRoundRepository } from "./fakes";

async function setupRunningRoundWithBet(playerId = "p1", amountCents = 1000n) {
  const rounds = new InMemoryRoundRepository();
  const round = Round.createNew({
    nonce: 1,
    seedPair: { serverSeed: "s", serverSeedHash: "h", clientSeed: "c", nonce: 1 },
    crashPoint: 10,
    bettingWindowMs: 0,
    algorithmVersion: "HMAC_SHA256_V1",
  });
  round.transitionToRunning();
  await rounds.create(round);

  const bets = new InMemoryBetRepository();
  const bet = Bet.place({ roundId: round.id, playerId, username: "player1", amount: Money.fromCents(amountCents) });
  bet.confirm();
  await bets.save(bet);

  return { rounds, bets, round, bet };
}

describe("RequestCashoutUseCase", () => {
  it("uses the server-side MultiplierClock, never a client-supplied value", async () => {
    const { rounds, bets } = await setupRunningRoundWithBet("p1", 1000n);
    const clock = new FakeMultiplierClock(3.0);
    const useCase = new RequestCashoutUseCase(rounds, bets, clock);

    const result = await useCase.execute({ playerId: "p1" });

    expect(result.cashoutMultiplier).toBe(3.0);
    expect(result.payoutAmountCents).toBe("3000");
    expect(bets.outboxEvents[0].eventType).toBe("bet.cashout.requested");
  });

  it("throws when the round is not RUNNING", async () => {
    const rounds = new InMemoryRoundRepository();
    const round = Round.createNew({
      nonce: 1,
      seedPair: { serverSeed: "s", serverSeedHash: "h", clientSeed: "c", nonce: 1 },
      crashPoint: 10,
      bettingWindowMs: 10_000,
      algorithmVersion: "HMAC_SHA256_V1",
    });
    await rounds.create(round);
    const bets = new InMemoryBetRepository();

    const useCase = new RequestCashoutUseCase(rounds, bets, new FakeMultiplierClock());
    await expect(useCase.execute({ playerId: "p1" })).rejects.toThrow(RoundNotRunningError);
  });

  it("throws when the player has no bet in the round", async () => {
    const { rounds, bets } = await setupRunningRoundWithBet("p1", 1000n);
    const useCase = new RequestCashoutUseCase(rounds, bets, new FakeMultiplierClock());
    await expect(useCase.execute({ playerId: "someone-else" })).rejects.toThrow(NoBetForPlayerError);
  });
});
