import { describe, expect, it } from "bun:test";
import { Round } from "../../../src/domain/round/round.aggregate";
import { InvalidRoundTransitionError, SeedNotYetRevealedError } from "../../../src/domain/round/round.errors";
import { RoundStatus } from "../../../src/domain/round/round-status.vo";

function createRound(overrides: Partial<{ bettingWindowMs: number; now: Date }> = {}) {
  return Round.createNew({
    nonce: 1,
    seedPair: {
      serverSeed: "seed",
      serverSeedHash: "hash",
      clientSeed: "client",
      nonce: 1,
    },
    crashPoint: 2.5,
    bettingWindowMs: overrides.bettingWindowMs ?? 10_000,
    algorithmVersion: "HMAC_SHA256_V1",
    now: overrides.now,
  });
}

describe("Round aggregate", () => {
  it("starts in BETTING with the seed hash already public", () => {
    const round = createRound();
    expect(round.status).toBe(RoundStatus.BETTING);
    expect(round.serverSeedHash).toBe("hash");
  });

  it("hides the crash point behind revealSeed until crashed", () => {
    const round = createRound();
    expect(() => round.revealSeed()).toThrow(SeedNotYetRevealedError);
  });

  it("transitions BETTING -> RUNNING only after the betting window closes", () => {
    const now = new Date("2026-01-01T00:00:00Z");
    const round = createRound({ now, bettingWindowMs: 10_000 });

    expect(() => round.transitionToRunning(new Date(now.getTime() + 5_000))).toThrow(
      InvalidRoundTransitionError,
    );

    round.transitionToRunning(new Date(now.getTime() + 10_000));
    expect(round.status).toBe(RoundStatus.RUNNING);
    expect(round.startedAt).not.toBeNull();
  });

  it("rejects transitioning to RUNNING twice", () => {
    const now = new Date("2026-01-01T00:00:00Z");
    const round = createRound({ now, bettingWindowMs: 0 });
    round.transitionToRunning(now);
    expect(() => round.transitionToRunning(now)).toThrow(InvalidRoundTransitionError);
  });

  it("transitions RUNNING -> CRASHED and reveals the seed", () => {
    const now = new Date("2026-01-01T00:00:00Z");
    const round = createRound({ now, bettingWindowMs: 0 });
    round.transitionToRunning(now);
    round.crash(new Date(now.getTime() + 3_000));

    expect(round.status).toBe(RoundStatus.CRASHED);
    expect(round.revealSeed()).toBe("seed");
  });

  it("rejects crashing a round that is not RUNNING", () => {
    const round = createRound();
    expect(() => round.crash()).toThrow(InvalidRoundTransitionError);
  });

  it("settle() is idempotent", () => {
    const now = new Date("2026-01-01T00:00:00Z");
    const round = createRound({ now, bettingWindowMs: 0 });
    round.transitionToRunning(now);
    round.crash(now);

    round.settle(now);
    expect(round.status).toBe(RoundStatus.SETTLED);

    expect(() => round.settle(now)).not.toThrow();
    expect(round.status).toBe(RoundStatus.SETTLED);
  });

  it("rejects settling a round that has not crashed", () => {
    const round = createRound();
    expect(() => round.settle()).toThrow(InvalidRoundTransitionError);
  });

  it("isBettingOpen reflects both status and the betting window", () => {
    const now = new Date("2026-01-01T00:00:00Z");
    const round = createRound({ now, bettingWindowMs: 10_000 });
    expect(round.isBettingOpen(new Date(now.getTime() + 5_000))).toBe(true);
    expect(round.isBettingOpen(new Date(now.getTime() + 10_000))).toBe(false);
  });
});
