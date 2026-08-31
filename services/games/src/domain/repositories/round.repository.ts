import { Round } from "../round/round.aggregate";

export const ROUND_REPOSITORY = Symbol("ROUND_REPOSITORY");

export interface RoundHistoryPage {
  items: Round[];
  nextCursor: string | null;
}

export interface RoundRepository {
  create(round: Round): Promise<void>;
  findById(id: string): Promise<Round | null>;
  /** Most recent round that has not been SETTLED yet (BETTING/RUNNING/CRASHED). */
  findCurrent(): Promise<Round | null>;
  findHistory(limit: number, cursor?: string | null): Promise<RoundHistoryPage>;
  save(round: Round): Promise<void>;
  countAll(): Promise<number>;
}
