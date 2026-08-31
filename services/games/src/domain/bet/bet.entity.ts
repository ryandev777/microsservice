import { randomUUID } from "crypto";
import { Money } from "../shared/money.vo";
import { AlreadyCashedOutError, InvalidBetAmountError, InvalidBetTransitionError } from "./bet.errors";
import { BetStatus } from "./bet-status.vo";

export const MIN_BET_CENTS = 100n; // 1.00
export const MAX_BET_CENTS = 100_000n; // 1,000.00

export interface BetProps {
  id: string;
  roundId: string;
  playerId: string;
  username: string;
  amount: Money;
  status: BetStatus;
  cashoutMultiplier: number | null;
  payoutAmount: Money | null;
  cashoutAt: Date | null;
  createdAt: Date;
}

/**
 * Bet entity: PLACED_PENDING -> CONFIRMED -> (CASHOUT_PENDING -> WON | LOST),
 * or PLACED_PENDING -> REJECTED.
 */
export class Bet {
  private constructor(private props: BetProps) {}

  static place(params: {
    roundId: string;
    playerId: string;
    username: string;
    amount: Money;
    now?: Date;
  }): Bet {
    if (params.amount.toCents() < MIN_BET_CENTS || params.amount.toCents() > MAX_BET_CENTS) {
      throw new InvalidBetAmountError(
        `Bet amount must be between ${MIN_BET_CENTS} and ${MAX_BET_CENTS} cents`,
      );
    }
    return new Bet({
      id: randomUUID(),
      roundId: params.roundId,
      playerId: params.playerId,
      username: params.username,
      amount: params.amount,
      status: BetStatus.PLACED_PENDING,
      cashoutMultiplier: null,
      payoutAmount: null,
      cashoutAt: null,
      createdAt: params.now ?? new Date(),
    });
  }

  static restore(props: BetProps): Bet {
    return new Bet(props);
  }

  get id(): string {
    return this.props.id;
  }

  get roundId(): string {
    return this.props.roundId;
  }

  get playerId(): string {
    return this.props.playerId;
  }

  get username(): string {
    return this.props.username;
  }

  get amount(): Money {
    return this.props.amount;
  }

  get status(): BetStatus {
    return this.props.status;
  }

  get cashoutMultiplier(): number | null {
    return this.props.cashoutMultiplier;
  }

  get payoutAmount(): Money | null {
    return this.props.payoutAmount;
  }

  get cashoutAt(): Date | null {
    return this.props.cashoutAt;
  }

  get createdAt(): Date {
    return this.props.createdAt;
  }

  confirm(): void {
    if (this.props.status !== BetStatus.PLACED_PENDING) {
      throw new InvalidBetTransitionError(`Cannot confirm bet ${this.props.id} from status ${this.props.status}`);
    }
    this.props.status = BetStatus.CONFIRMED;
  }

  reject(): void {
    if (this.props.status !== BetStatus.PLACED_PENDING) {
      throw new InvalidBetTransitionError(`Cannot reject bet ${this.props.id} from status ${this.props.status}`);
    }
    this.props.status = BetStatus.REJECTED;
  }

  /**
   * Fixes the cashout multiplier and payout amount at request time (server
   * is authoritative for the multiplier — see MultiplierClock). The payout
   * is always rounded down to the nearest cent, never in the player's
   * favor. This quote is what gets sent to the Wallet service to credit;
   * `confirmCashout()` later just finalizes the same numbers so the
   * credited amount and the recorded payout can never drift apart.
   */
  requestCashout(multiplier: number): void {
    if (this.props.status !== BetStatus.CONFIRMED) {
      throw new AlreadyCashedOutError(this.props.id);
    }
    const multiplierBasisPoints = BigInt(Math.floor(multiplier * 10_000));
    const payoutCents = (this.props.amount.toCents() * multiplierBasisPoints) / 10_000n;

    this.props.status = BetStatus.CASHOUT_PENDING;
    this.props.cashoutMultiplier = multiplier;
    this.props.payoutAmount = Money.fromCents(payoutCents);
  }

  confirmCashout(now: Date = new Date()): void {
    if (this.props.status !== BetStatus.CASHOUT_PENDING) {
      throw new InvalidBetTransitionError(
        `Cannot confirm cashout for bet ${this.props.id} from status ${this.props.status}`,
      );
    }
    this.props.status = BetStatus.WON;
    this.props.cashoutAt = now;
  }

  /** Idempotent: marking an already-terminal bet as lost is a no-op. */
  markLost(): void {
    if (this.props.status === BetStatus.WON || this.props.status === BetStatus.LOST) {
      return;
    }
    if (this.props.status !== BetStatus.CONFIRMED) {
      throw new InvalidBetTransitionError(`Cannot mark bet ${this.props.id} as lost from status ${this.props.status}`);
    }
    this.props.status = BetStatus.LOST;
  }

  /** For repository/persistence use only. */
  toPersistence(): BetProps {
    return { ...this.props };
  }
}
