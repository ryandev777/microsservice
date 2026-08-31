import { randomUUID } from "crypto";
import { Money } from "../shared/money.vo";
import { WalletTransactionType } from "./wallet-transaction-type.vo";

export interface WalletTransactionProps {
  id: string;
  walletId: string;
  type: WalletTransactionType;
  amount: Money;
  referenceId: string;
  createdAt: Date;
}

/**
 * Append-only ledger entry. Never updated or deleted after creation.
 */
export class WalletTransaction {
  private constructor(private readonly props: WalletTransactionProps) {}

  static create(params: {
    walletId: string;
    type: WalletTransactionType;
    amount: Money;
    referenceId: string;
  }): WalletTransaction {
    return new WalletTransaction({
      id: randomUUID(),
      walletId: params.walletId,
      type: params.type,
      amount: params.amount,
      referenceId: params.referenceId,
      createdAt: new Date(),
    });
  }

  static restore(props: WalletTransactionProps): WalletTransaction {
    return new WalletTransaction(props);
  }

  get id(): string {
    return this.props.id;
  }

  get walletId(): string {
    return this.props.walletId;
  }

  get type(): WalletTransactionType {
    return this.props.type;
  }

  get amount(): Money {
    return this.props.amount;
  }

  get referenceId(): string {
    return this.props.referenceId;
  }

  get createdAt(): Date {
    return this.props.createdAt;
  }
}
