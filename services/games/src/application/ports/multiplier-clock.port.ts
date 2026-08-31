export const MULTIPLIER_CLOCK = Symbol("MULTIPLIER_CLOCK");

export interface MultiplierClock {
  multiplierAt(elapsedMs: number): number;
  elapsedMsForMultiplier(multiplier: number): number;
}
