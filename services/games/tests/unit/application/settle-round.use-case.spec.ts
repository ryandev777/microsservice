import { describe, expect, it } from "bun:test";
import { Bet } from "../../../src/domain/bet/bet.entity";
import { Money } from "../../../src/domain/shared/money.vo";
import { Round } from "../../../src/domain/round/round.aggregate";
import { SettleRoundUseCase } from "../../../src/application/use-cases/settle-round.use-case";
import { InMemoryBetRepository, InMemoryRoundRepository } from "./fakes";

describe("SettleRoundUseCase", () => {
  it("marks CONFIRMED bets without cashout as LOST and settles the round", async () => {
    const rounds = new InMemoryRoundRepository();
    const round = Round.createNew({
      nonce: 1,
      seedPair: { serverSeed: "s", serverSeedHash: "h", clientSeed: "c", nonce: 1 },
      crashPoint: 2,
      bettingWindowMs: 0,
      algorithmVersion: "HMAC_SHA256_V1",
    });
    round.transitionToRunning();
    round.crash();
    await rounds.create(round);

    const bets = new InMemoryBetRepository();
    const losingBet = Bet.place({ roundId: round.id, playerId: "p1", username: "player1", amount: Money.fromCents(100n) });
    losingBet.confirm();
    await bets.save(losingBet);

    const winningBet = Bet.place({ roundId: round.id, playerId: "p2", username: "player2", amount: Money.fromCents(100n) });
    winningBet.confirm();
    winningBet.requestCashout(1.5);
    winningBet.confirmCashout();
    await bets.save(winningBet);

    const useCase = new SettleRoundUseCase(rounds, bets);
    const result = await useCase.execute(round.id);

    expect(result.lostBetsCount).toBe(1);
    expect((await bets.findById(losingBet.id))?.status).toBe("LOST");
    expect((await bets.findById(winningBet.id))?.status).toBe("WON");
    expect((await rounds.findById(round.id))?.status).toBe("SETTLED");
  });

  it("is idempotent when called twice", async () => {
    const rounds = new InMemoryRoundRepository();
    const round = Round.createNew({
      nonce: 1,
      seedPair: { serverSeed: "s", serverSeedHash: "h", clientSeed: "c", nonce: 1 },
      crashPoint: 2,
      bettingWindowMs: 0,
      algorithmVersion: "HMAC_SHA256_V1",
    });
    round.transitionToRunning();
    round.crash();
    await rounds.create(round);
    const bets = new InMemoryBetRepository();

    const useCase = new SettleRoundUseCase(rounds, bets);
    await useCase.execute(round.id);
    const second = await useCase.execute(round.id);
    expect(second.lostBetsCount).toBe(0);
  });
});
