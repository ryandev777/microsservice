import { PlayerId } from "../../../src/domain/shared/player-id.vo";
import { Wallet } from "../../../src/domain/wallet/wallet.aggregate";
import { DUPLICATE_MESSAGE } from "../../../src/domain/repositories/wallet.repository";
import type {
  WalletMutationResult,
  WalletRepository,
} from "../../../src/domain/repositories/wallet.repository";

export class FakeWalletRepository implements WalletRepository {
  private wallets = new Map<string, Wallet>();
  private consumedMessageIds = new Set<string>();
  public publishedOutboxEvents: { eventType: string; payload: Record<string, unknown> }[] = [];

  seed(wallet: Wallet): void {
    this.wallets.set(wallet.playerId.toString(), wallet);
  }

  async create(wallet: Wallet): Promise<void> {
    this.wallets.set(wallet.playerId.toString(), wallet);
  }

  async findByPlayerId(playerId: PlayerId): Promise<Wallet | null> {
    return this.wallets.get(playerId.toString()) ?? null;
  }

  async withLockedWalletIdempotent<T>(
    playerId: PlayerId,
    messageId: string,
    _eventType: string,
    mutate: (wallet: Wallet) => WalletMutationResult<T>,
  ): Promise<T | typeof DUPLICATE_MESSAGE> {
    if (this.consumedMessageIds.has(messageId)) {
      return DUPLICATE_MESSAGE;
    }
    this.consumedMessageIds.add(messageId);

    const wallet = this.wallets.get(playerId.toString());
    if (!wallet) {
      throw new Error(`Wallet not found for player ${playerId.toString()}`);
    }

    const { result, outboxEvents } = mutate(wallet);
    if (outboxEvents) {
      this.publishedOutboxEvents.push(...outboxEvents);
    }
    return result;
  }
}
