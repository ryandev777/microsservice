import { describe, expect, it } from "bun:test";
import { Bet, MAX_BET_CENTS, MIN_BET_CENTS } from "../../../src/domain/bet/bet.entity";
import { AlreadyCashedOutError, InvalidBetAmountError, InvalidBetTransitionError } from "../../../src/domain/bet/bet.errors";
import { BetStatus } from "../../../src/domain/bet/bet-status.vo";
import { Money } from "../../../src/domain/shared/money.vo";

function placeBet(amountCents = 1000n) {
  return Bet.place({ roundId: "round-1", playerId: "player-1", username: "player-1", amount: Money.fromCents(amountCents) });
}

describe("Bet entity", () => {
  it("starts as PLACED_PENDING", () => {
    const bet = placeBet();
    expect(bet.status).toBe(BetStatus.PLACED_PENDING);
  });

  it("rejects amounts below the minimum", () => {
    expect(() => placeBet(MIN_BET_CENTS - 1n)).toThrow(InvalidBetAmountError);
  });

  it("rejects amounts above the maximum", () => {
    expect(() => placeBet(MAX_BET_CENTS + 1n)).toThrow(InvalidBetAmountError);
  });

  it("accepts boundary amounts", () => {
    expect(() => placeBet(MIN_BET_CENTS)).not.toThrow();
    expect(() => placeBet(MAX_BET_CENTS)).not.toThrow();
  });

  it("confirm() transitions PLACED_PENDING -> CONFIRMED", () => {
    const bet = placeBet();
    bet.confirm();
    expect(bet.status).toBe(BetStatus.CONFIRMED);
  });

  it("reject() transitions PLACED_PENDING -> REJECTED", () => {
    const bet = placeBet();
    bet.reject();
    expect(bet.status).toBe(BetStatus.REJECTED);
  });

  it("cannot confirm twice", () => {
    const bet = placeBet();
    bet.confirm();
    expect(() => bet.confirm()).toThrow(InvalidBetTransitionError);
  });

  it("requestCashout only works from CONFIRMED", () => {
    const bet = placeBet();
    expect(() => bet.requestCashout(1.5)).toThrow(AlreadyCashedOutError);
    bet.confirm();
    expect(() => bet.requestCashout(1.5)).not.toThrow();
    expect(bet.status).toBe(BetStatus.CASHOUT_PENDING);
  });

  it("requestCashout computes payout truncated down, never in the player's favor", () => {
    const bet = placeBet(1000n); // 10.00
    bet.confirm();
    bet.requestCashout(2.357); // 10.00 * 2.357 = 23.57 exactly at 4-decimal basis points precision
    expect(bet.payoutAmount?.toCents()).toBe(2357n);
    bet.confirmCashout();
    expect(bet.status).toBe(BetStatus.WON);
  });

  it("requestCashout truncates fractional cents down", () => {
    const bet = placeBet(333n); // 3.33
    bet.confirm();
    bet.requestCashout(1.999); // 333 * 1.999 = 665.667 -> floor to 665
    expect(bet.payoutAmount?.toCents()).toBe(665n);
  });

  it("cannot cash out twice", () => {
    const bet = placeBet();
    bet.confirm();
    bet.requestCashout(1.5);
    bet.confirmCashout();
    expect(() => bet.requestCashout(1.5)).toThrow(AlreadyCashedOutError);
  });

  it("markLost transitions CONFIRMED -> LOST and is idempotent", () => {
    const bet = placeBet();
    bet.confirm();
    bet.markLost();
    expect(bet.status).toBe(BetStatus.LOST);
    expect(() => bet.markLost()).not.toThrow();
  });

  it("markLost does not touch a WON bet", () => {
    const bet = placeBet();
    bet.confirm();
    bet.requestCashout(2);
    bet.confirmCashout();
    bet.markLost();
    expect(bet.status).toBe(BetStatus.WON);
  });
});
