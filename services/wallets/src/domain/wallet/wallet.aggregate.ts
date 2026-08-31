import { randomUUID } from "crypto";
import { Money } from "../shared/money.vo";
import { PlayerId } from "../shared/player-id.vo";
import { InsufficientFundsError } from "./wallet.errors";
import { WalletTransaction } from "./wallet-transaction.entity";
import { WalletTransactionType } from "./wallet-transaction-type.vo";

export interface WalletProps {
  id: string;
  playerId: PlayerId;
  balance: Money;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Wallet aggregate root. One wallet per player. Balance is always a
 * non-negative integer number of cents (see Money) and is protected here
 * as the single point of mutation for the balance invariant.
 */
export class Wallet {
  private constructor(private props: WalletProps) {}

  static create(playerId: PlayerId): Wallet {
    const now = new Date();
    return new Wallet({
      id: randomUUID(),
      playerId,
      balance: Money.zero(),
      createdAt: now,
      updatedAt: now,
    });
  }

  static restore(props: WalletProps): Wallet {
    return new Wallet(props);
  }

  get id(): string {
    return this.props.id;
  }

  get playerId(): PlayerId {
    return this.props.playerId;
  }

  get balance(): Money {
    return this.props.balance;
  }

  get updatedAt(): Date {
    return this.props.updatedAt;
  }

  /**
   * Debits the wallet. Throws InsufficientFundsError (without mutating
   * state) when the balance is not enough to cover the amount.
   */
  debit(amount: Money, referenceId: string, type: WalletTransactionType = WalletTransactionType.DEBIT_BET): WalletTransaction {
    if (!this.props.balance.canSubtract(amount)) {
      throw new InsufficientFundsError(this.props.id);
    }
    this.props.balance = this.props.balance.subtract(amount);
    this.props.updatedAt = new Date();
    return WalletTransaction.create({
      walletId: this.props.id,
      type,
      amount,
      referenceId,
    });
  }

  credit(
    amount: Money,
    referenceId: string,
    type: WalletTransactionType = WalletTransactionType.CREDIT_PAYOUT,
  ): WalletTransaction {
    this.props.balance = this.props.balance.add(amount);
    this.props.updatedAt = new Date();
    return WalletTransaction.create({
      walletId: this.props.id,
      type,
      amount,
      referenceId,
    });
  }
}
