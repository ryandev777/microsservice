export interface PendingOutboxMessage {
  id: string;
  eventType: string;
  payload: Record<string, unknown>;
  attempts: number;
}

export interface OutboxRepository {
  /**
   * Claims up to `limit` unpublished messages for delivery (FOR UPDATE SKIP
   * LOCKED), so concurrent relay instances never publish the same row twice.
   */
  claimPending(limit: number): Promise<PendingOutboxMessage[]>;
  markPublished(id: string): Promise<void>;
  markFailedAttempt(id: string): Promise<void>;
}

export const OUTBOX_REPOSITORY = Symbol("OUTBOX_REPOSITORY");
