import { randomUUID } from "crypto";
import { SeedPair } from "../provably-fair/provably-fair.service";
import { InvalidRoundTransitionError, SeedNotYetRevealedError } from "./round.errors";
import { RoundStatus } from "./round-status.vo";

export interface RoundProps {
  id: string;
  status: RoundStatus;
  serverSeed: string;
  serverSeedHash: string;
  clientSeed: string;
  nonce: number;
  crashPoint: number;
  algorithmVersion: string;
  bettingEndsAt: Date;
  startedAt: Date | null;
  crashedAt: Date | null;
  settledAt: Date | null;
  createdAt: Date;
}

/**
 * Round aggregate root: BETTING -> RUNNING -> CRASHED -> SETTLED.
 *
 * The crash point is computed up-front (deterministically, from the seed
 * pair) but stays private until the round crashes — `revealSeed()` only
 * returns the server seed once the round is CRASHED or SETTLED, so a
 * player can never learn the crash point before it actually happens.
 *
 * One-bet-per-player and duplicate detection are enforced at the
 * repository/persistence layer via a unique (roundId, playerId)
 * constraint, not tracked in-memory here — keeps this aggregate lean.
 */
export class Round {
  private constructor(private props: RoundProps) {}

  static createNew(params: {
    nonce: number;
    seedPair: SeedPair;
    crashPoint: number;
    bettingWindowMs: number;
    algorithmVersion: string;
    now?: Date;
  }): Round {
    const now = params.now ?? new Date();
    return new Round({
      id: randomUUID(),
      status: RoundStatus.BETTING,
      serverSeed: params.seedPair.serverSeed,
      serverSeedHash: params.seedPair.serverSeedHash,
      clientSeed: params.seedPair.clientSeed,
      nonce: params.nonce,
      crashPoint: params.crashPoint,
      algorithmVersion: params.algorithmVersion,
      bettingEndsAt: new Date(now.getTime() + params.bettingWindowMs),
      startedAt: null,
      crashedAt: null,
      settledAt: null,
      createdAt: now,
    });
  }

  static restore(props: RoundProps): Round {
    return new Round(props);
  }

  get id(): string {
    return this.props.id;
  }

  get status(): RoundStatus {
    return this.props.status;
  }

  get serverSeedHash(): string {
    return this.props.serverSeedHash;
  }

  get clientSeed(): string {
    return this.props.clientSeed;
  }

  get nonce(): number {
    return this.props.nonce;
  }

  /** Crash point is intentionally exposed regardless of status: it's used
   * internally by the scheduler/use-cases (e.g. to detect crash). Public
   * API layers must not leak this before the round is CRASHED/SETTLED —
   * see `revealSeed()` for the player-facing verification gate. */
  get crashPoint(): number {
    return this.props.crashPoint;
  }

  get algorithmVersion(): string {
    return this.props.algorithmVersion;
  }

  get bettingEndsAt(): Date {
    return this.props.bettingEndsAt;
  }

  get startedAt(): Date | null {
    return this.props.startedAt;
  }

  get crashedAt(): Date | null {
    return this.props.crashedAt;
  }

  get settledAt(): Date | null {
    return this.props.settledAt;
  }

  get createdAt(): Date {
    return this.props.createdAt;
  }

  isBettingOpen(now: Date = new Date()): boolean {
    return this.props.status === RoundStatus.BETTING && now < this.props.bettingEndsAt;
  }

  transitionToRunning(now: Date = new Date()): void {
    if (this.props.status !== RoundStatus.BETTING) {
      throw new InvalidRoundTransitionError(`Cannot start round ${this.props.id} from status ${this.props.status}`);
    }
    if (now < this.props.bettingEndsAt) {
      throw new InvalidRoundTransitionError(`Round ${this.props.id} betting window has not closed yet`);
    }
    this.props.status = RoundStatus.RUNNING;
    this.props.startedAt = now;
  }

  crash(now: Date = new Date()): void {
    if (this.props.status !== RoundStatus.RUNNING) {
      throw new InvalidRoundTransitionError(`Cannot crash round ${this.props.id} from status ${this.props.status}`);
    }
    this.props.status = RoundStatus.CRASHED;
    this.props.crashedAt = now;
  }

  /** Idempotent: settling an already-settled round is a no-op. */
  settle(now: Date = new Date()): void {
    if (this.props.status === RoundStatus.SETTLED) {
      return;
    }
    if (this.props.status !== RoundStatus.CRASHED) {
      throw new InvalidRoundTransitionError(`Cannot settle round ${this.props.id} from status ${this.props.status}`);
    }
    this.props.status = RoundStatus.SETTLED;
    this.props.settledAt = now;
  }

  revealSeed(): string {
    if (this.props.status !== RoundStatus.CRASHED && this.props.status !== RoundStatus.SETTLED) {
      throw new SeedNotYetRevealedError();
    }
    return this.props.serverSeed;
  }

  elapsedRunningMs(now: Date = new Date()): number {
    if (!this.props.startedAt) {
      return 0;
    }
    return Math.max(0, now.getTime() - this.props.startedAt.getTime());
  }

  /** For repository/persistence use only — includes the server seed even
   * before it is publicly revealed, since the DB row must always store it. */
  toPersistence(): RoundProps {
    return { ...this.props };
  }
}
