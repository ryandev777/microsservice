import { describe, expect, it } from "bun:test";
import { Money } from "../../../src/domain/shared/money.vo";
import { PlayerId } from "../../../src/domain/shared/player-id.vo";
import { Wallet } from "../../../src/domain/wallet/wallet.aggregate";
import { InsufficientFundsError } from "../../../src/domain/wallet/wallet.errors";
import { WalletTransactionType } from "../../../src/domain/wallet/wallet-transaction-type.vo";

describe("Wallet aggregate", () => {
  it("starts with a zero balance", () => {
    const wallet = Wallet.create(PlayerId.from("player-1"));
    expect(wallet.balance.toCents()).toBe(0n);
  });

  it("credits increase the balance", () => {
    const wallet = Wallet.create(PlayerId.from("player-1"));
    wallet.credit(Money.fromCents(1000n), "bet-1", WalletTransactionType.CREDIT_PAYOUT);
    expect(wallet.balance.toCents()).toBe(1000n);
  });

  it("debits decrease the balance when funds are sufficient", () => {
    const wallet = Wallet.create(PlayerId.from("player-1"));
    wallet.credit(Money.fromCents(1000n), "seed", WalletTransactionType.CREDIT_REFUND);
    const tx = wallet.debit(Money.fromCents(400n), "bet-1");
    expect(wallet.balance.toCents()).toBe(600n);
    expect(tx.type).toBe(WalletTransactionType.DEBIT_BET);
    expect(tx.amount.toCents()).toBe(400n);
  });

  it("throws InsufficientFundsError and does not mutate balance when funds are insufficient", () => {
    const wallet = Wallet.create(PlayerId.from("player-1"));
    wallet.credit(Money.fromCents(100n), "seed", WalletTransactionType.CREDIT_REFUND);

    expect(() => wallet.debit(Money.fromCents(200n), "bet-1")).toThrow(InsufficientFundsError);
    expect(wallet.balance.toCents()).toBe(100n);
  });

  it("balance never goes negative across a sequence of operations", () => {
    const wallet = Wallet.create(PlayerId.from("player-1"));
    wallet.credit(Money.fromCents(500n), "seed", WalletTransactionType.CREDIT_REFUND);
    wallet.debit(Money.fromCents(300n), "bet-1");
    expect(() => wallet.debit(Money.fromCents(300n), "bet-2")).toThrow(InsufficientFundsError);
    expect(wallet.balance.toCents()).toBe(200n);
  });

  it("keeps monetary precision as integer cents (no floating point)", () => {
    const wallet = Wallet.create(PlayerId.from("player-1"));
    wallet.credit(Money.fromCents(1000000000n), "seed", WalletTransactionType.CREDIT_REFUND);
    wallet.debit(Money.fromCents(1n), "bet-1");
    expect(wallet.balance.toCents()).toBe(999999999n);
  });
});
