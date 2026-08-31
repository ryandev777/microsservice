import { PlayerId } from "../shared/player-id.vo";
import { Wallet } from "../wallet/wallet.aggregate";
import { WalletTransaction } from "../wallet/wallet-transaction.entity";

export interface OutboxEventInput {
  eventType: string;
  payload: Record<string, unknown>;
}

export interface WalletMutationResult<T> {
  result: T;
  transaction?: WalletTransaction;
  outboxEvents?: OutboxEventInput[];
}

export const DUPLICATE_MESSAGE = "DUPLICATE" as const;

export interface WalletRepository {
  create(wallet: Wallet): Promise<void>;
  findByPlayerId(playerId: PlayerId): Promise<Wallet | null>;

  /**
   * Loads the wallet for the given player under a row lock, guards against
   * reprocessing the same inbound message twice (inbox pattern), applies
   * `mutate` to the in-memory aggregate, and persists the resulting balance,
   * ledger entry and outbox events atomically in a single transaction.
   *
   * Returns "DUPLICATE" without invoking `mutate` if `messageId` was already
   * consumed.
   */
  withLockedWalletIdempotent<T>(
    playerId: PlayerId,
    messageId: string,
    eventType: string,
    mutate: (wallet: Wallet) => WalletMutationResult<T>,
  ): Promise<T | typeof DUPLICATE_MESSAGE>;
}

export const WALLET_REPOSITORY = Symbol("WALLET_REPOSITORY");
