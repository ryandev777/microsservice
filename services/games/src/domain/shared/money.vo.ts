export class InvalidMoneyAmountError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidMoneyAmountError";
  }
}

/**
 * Money is always represented as an integer number of cents (BigInt).
 * Floating point is never used for monetary values anywhere in this domain.
 */
export class Money {
  private constructor(private readonly cents: bigint) {}

  static fromCents(cents: bigint): Money {
    if (cents < 0n) {
      throw new InvalidMoneyAmountError("Money amount cannot be negative");
    }
    return new Money(cents);
  }

  static zero(): Money {
    return new Money(0n);
  }

  toCents(): bigint {
    return this.cents;
  }

  add(other: Money): Money {
    return new Money(this.cents + other.cents);
  }

  subtract(other: Money): Money {
    if (this.cents < other.cents) {
      throw new InvalidMoneyAmountError("Subtraction would result in a negative amount");
    }
    return new Money(this.cents - other.cents);
  }

  canSubtract(other: Money): boolean {
    return this.cents >= other.cents;
  }

  isGreaterThanOrEqual(other: Money): boolean {
    return this.cents >= other.cents;
  }

  isZero(): boolean {
    return this.cents === 0n;
  }

  equals(other: Money): boolean {
    return this.cents === other.cents;
  }

  toString(): string {
    const whole = this.cents / 100n;
    const fraction = (this.cents % 100n).toString().padStart(2, "0");
    return `${whole}.${fraction}`;
  }
}
