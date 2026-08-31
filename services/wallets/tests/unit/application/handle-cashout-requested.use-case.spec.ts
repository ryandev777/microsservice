import { describe, expect, it } from "bun:test";
import { HandleCashoutRequestedUseCase } from "../../../src/application/use-cases/handle-cashout-requested.use-case";
import { Wallet } from "../../../src/domain/wallet/wallet.aggregate";
import { PlayerId } from "../../../src/domain/shared/player-id.vo";
import { FakeWalletRepository } from "../fakes/fake-wallet.repository";

describe("HandleCashoutRequestedUseCase", () => {
  it("credits the wallet and emits wallet.credit.succeeded", async () => {
    const repo = new FakeWalletRepository();
    const wallet = Wallet.create(PlayerId.from("player-1"));
    repo.seed(wallet);

    const useCase = new HandleCashoutRequestedUseCase(repo);
    await useCase.execute({
      messageId: "msg-1",
      betId: "bet-1",
      roundId: "round-1",
      playerId: "player-1",
      cashoutMultiplier: 2.35,
      payoutAmountCents: 2350,
    });

    expect(wallet.balance.toCents()).toBe(2350n);
    expect(repo.publishedOutboxEvents).toHaveLength(1);
    expect(repo.publishedOutboxEvents[0].eventType).toBe("wallet.credit.succeeded");
  });

  it("is idempotent: reprocessing the same messageId does not credit twice", async () => {
    const repo = new FakeWalletRepository();
    const wallet = Wallet.create(PlayerId.from("player-1"));
    repo.seed(wallet);

    const useCase = new HandleCashoutRequestedUseCase(repo);
    const message = {
      messageId: "msg-2",
      betId: "bet-1",
      roundId: "round-1",
      playerId: "player-1",
      cashoutMultiplier: 2,
      payoutAmountCents: 1000,
    };
    await useCase.execute(message);
    await useCase.execute(message);

    expect(wallet.balance.toCents()).toBe(1000n);
    expect(repo.publishedOutboxEvents).toHaveLength(1);
  });
});
