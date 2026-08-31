import { beforeEach, describe, expect, it } from "bun:test";
import { MultiplierClockService } from "../../../src/infrastructure/scheduler/multiplier-clock.service";

describe("MultiplierClockService", () => {
  beforeEach(() => {
    process.env.MULTIPLIER_GROWTH_RATE = "1.06";
  });

  it("starts at exactly 1.00 when elapsed is 0", () => {
    const clock = new MultiplierClockService();
    expect(clock.multiplierAt(0)).toBe(1.0);
  });

  it("is monotonically increasing with elapsed time", () => {
    const clock = new MultiplierClockService();
    let previous = clock.multiplierAt(0);
    for (let ms = 100; ms <= 10_000; ms += 100) {
      const current = clock.multiplierAt(ms);
      expect(current).toBeGreaterThanOrEqual(previous);
      previous = current;
    }
  });

  it("is deterministic for the same elapsed time", () => {
    const clock = new MultiplierClockService();
    expect(clock.multiplierAt(2500)).toBe(clock.multiplierAt(2500));
  });

  it("elapsedMsForMultiplier is the inverse of multiplierAt (within rounding)", () => {
    const clock = new MultiplierClockService();
    const elapsed = clock.elapsedMsForMultiplier(2.0);
    const recomputed = clock.multiplierAt(elapsed);
    expect(Math.abs(recomputed - 2.0)).toBeLessThan(0.01);
  });
});
