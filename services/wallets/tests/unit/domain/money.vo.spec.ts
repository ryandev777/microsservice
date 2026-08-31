import { describe, expect, it } from "bun:test";
import { InvalidMoneyAmountError, Money } from "../../../src/domain/shared/money.vo";

describe("Money", () => {
  it("creates a zero amount", () => {
    expect(Money.zero().toCents()).toBe(0n);
  });

  it("rejects negative amounts", () => {
    expect(() => Money.fromCents(-1n)).toThrow(InvalidMoneyAmountError);
  });

  it("adds amounts without floating point", () => {
    const a = Money.fromCents(150n);
    const b = Money.fromCents(250n);
    expect(a.add(b).toCents()).toBe(400n);
  });

  it("subtracts amounts", () => {
    const a = Money.fromCents(500n);
    const b = Money.fromCents(200n);
    expect(a.subtract(b).toCents()).toBe(300n);
  });

  it("throws when subtracting more than available", () => {
    const a = Money.fromCents(100n);
    const b = Money.fromCents(200n);
    expect(() => a.subtract(b)).toThrow(InvalidMoneyAmountError);
  });

  it("canSubtract reports whether a subtraction is safe", () => {
    const a = Money.fromCents(100n);
    expect(a.canSubtract(Money.fromCents(100n))).toBe(true);
    expect(a.canSubtract(Money.fromCents(101n))).toBe(false);
  });

  it("formats cents as a decimal string", () => {
    expect(Money.fromCents(123456n).toString()).toBe("1234.56");
    expect(Money.fromCents(5n).toString()).toBe("0.05");
  });

  it("never loses precision across many operations (no float drift)", () => {
    let money = Money.zero();
    for (let i = 0; i < 1000; i++) {
      money = money.add(Money.fromCents(1n));
    }
    expect(money.toCents()).toBe(1000n);
  });
});
