import { Injectable } from "@nestjs/common";
import type { MultiplierClock } from "../../application/ports/multiplier-clock.port";

/**
 * Deterministic, monotonic multiplier growth: multiplier = growthRate ^ (elapsedMs / 1000).
 * Single source of truth reused by the WebSocket tick, the round snapshot
 * on reconnection, and RequestCashoutUseCase — a client-supplied
 * multiplier is never trusted.
 */
@Injectable()
export class MultiplierClockService implements MultiplierClock {
  private readonly growthRate: number;

  constructor() {
    this.growthRate = Number(process.env.MULTIPLIER_GROWTH_RATE ?? "1.06");
  }

  multiplierAt(elapsedMs: number): number {
    const multiplier = Math.pow(this.growthRate, elapsedMs / 1000);
    return Math.round(multiplier * 100) / 100;
  }

  elapsedMsForMultiplier(multiplier: number): number {
    if (multiplier <= 1) {
      return 0;
    }
    return (Math.log(multiplier) / Math.log(this.growthRate)) * 1000;
  }
}
