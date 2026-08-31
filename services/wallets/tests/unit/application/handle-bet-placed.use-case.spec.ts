import { describe, expect, it } from "bun:test";
import { HandleBetPlacedUseCase } from "../../../src/application/use-cases/handle-bet-placed.use-case";
import { Wallet } from "../../../src/domain/wallet/wallet.aggregate";
import { PlayerId } from "../../../src/domain/shared/player-id.vo";
import { Money } from "../../../src/domain/shared/money.vo";
import { WalletTransactionType } from "../../../src/domain/wallet/wallet-transaction-type.vo";
import { FakeWalletRepository } from "../fakes/fake-wallet.repository";

describe("HandleBetPlacedUseCase", () => {
  it("debits the wallet and emits wallet.debit.succeeded when funds are sufficient", async () => {
    const repo = new FakeWalletRepository();
    const wallet = Wallet.create(PlayerId.from("player-1"));
    wallet.credit(Money.fromCents(1000n), "seed", WalletTransactionType.CREDIT_REFUND);
    repo.seed(wallet);

    const useCase = new HandleBetPlacedUseCase(repo);
    await useCase.execute({
      messageId: "msg-1",
      betId: "bet-1",
      roundId: "round-1",
      playerId: "player-1",
      amountCents: 400,
    });

    expect(wallet.balance.toCents()).toBe(600n);
    expect(repo.publishedOutboxEvents).toHaveLength(1);
    expect(repo.publishedOutboxEvents[0].eventType).toBe("wallet.debit.succeeded");
  });

  it("emits wallet.debit.failed without changing balance when funds are insufficient", async () => {
    const repo = new FakeWalletRepository();
    const wallet = Wallet.create(PlayerId.from("player-1"));
    wallet.credit(Money.fromCents(100n), "seed", WalletTransactionType.CREDIT_REFUND);
    repo.seed(wallet);

    const useCase = new HandleBetPlacedUseCase(repo);
    await useCase.execute({
      messageId: "msg-2",
      betId: "bet-2",
      roundId: "round-1",
      playerId: "player-1",
      amountCents: 500,
    });

    expect(wallet.balance.toCents()).toBe(100n);
    expect(repo.publishedOutboxEvents).toHaveLength(1);
    expect(repo.publishedOutboxEvents[0].eventType).toBe("wallet.debit.failed");
    expect(repo.publishedOutboxEvents[0].payload.reason).toBe("INSUFFICIENT_FUNDS");
  });

  it("is idempotent: reprocessing the same messageId does not debit twice", async () => {
    const repo = new FakeWalletRepository();
    const wallet = Wallet.create(PlayerId.from("player-1"));
    wallet.credit(Money.fromCents(1000n), "seed", WalletTransactionType.CREDIT_REFUND);
    repo.seed(wallet);

    const useCase = new HandleBetPlacedUseCase(repo);
    const message = {
      messageId: "msg-3",
      betId: "bet-3",
      roundId: "round-1",
      playerId: "player-1",
      amountCents: 200,
    };
    await useCase.execute(message);
    await useCase.execute(message);

    expect(wallet.balance.toCents()).toBe(800n);
    expect(repo.publishedOutboxEvents).toHaveLength(1);
  });
});
