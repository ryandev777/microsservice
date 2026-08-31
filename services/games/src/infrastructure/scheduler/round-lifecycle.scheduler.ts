import { Inject, Injectable, Logger, OnModuleInit } from "@nestjs/common";
import { ProvablyFairService } from "../../domain/provably-fair/provably-fair.service";
import { Round } from "../../domain/round/round.aggregate";
import { ROUND_REPOSITORY } from "../../domain/repositories/round.repository";
import type { RoundRepository } from "../../domain/repositories/round.repository";
import { ROUND_BROADCASTER } from "../../application/ports/round-broadcaster.port";
import type { RoundBroadcaster } from "../../application/ports/round-broadcaster.port";
import { SettleRoundUseCase } from "../../application/use-cases/settle-round.use-case";
import { MultiplierClockService } from "./multiplier-clock.service";

const BETTING_WINDOW_MS = Number(process.env.BETTING_WINDOW_MS ?? 10_000);
const TICK_INTERVAL_MS = Number(process.env.TICK_INTERVAL_MS ?? 100);
const HOUSE_EDGE = Number(process.env.HOUSE_EDGE ?? 0.01);
const ROUND_COOLDOWN_MS = Number(process.env.ROUND_COOLDOWN_MS ?? 3000);

/**
 * Drives the continuous round loop: BETTING -> RUNNING -> CRASHED ->
 * SETTLED -> (cooldown) -> new round. This is the single authoritative
 * source for round state and the multiplier tick — every client sees the
 * same sequence of events because it all originates here.
 */
@Injectable()
export class RoundLifecycleScheduler implements OnModuleInit {
  private readonly logger = new Logger(RoundLifecycleScheduler.name);
  private readonly provablyFair = new ProvablyFairService();
  private currentRound: Round | null = null;
  private nonceCounter = 0;
  private tickHandle: ReturnType<typeof setInterval> | null = null;

  constructor(
    @Inject(ROUND_REPOSITORY) private readonly roundRepository: RoundRepository,
    @Inject(ROUND_BROADCASTER) private readonly broadcaster: RoundBroadcaster,
    private readonly multiplierClock: MultiplierClockService,
    private readonly settleRound: SettleRoundUseCase,
  ) {}

  async onModuleInit(): Promise<void> {
    this.nonceCounter = await this.roundRepository.countAll();
    await this.startNewRound();
  }

  private async startNewRound(): Promise<void> {
    this.nonceCounter += 1;
    const seedPair = this.provablyFair.generateSeedPair(this.nonceCounter);
    const crashPoint = this.provablyFair.calculateCrashPoint(
      seedPair.serverSeed,
      seedPair.clientSeed,
      seedPair.nonce,
      HOUSE_EDGE,
    );

    const round = Round.createNew({
      nonce: this.nonceCounter,
      seedPair,
      crashPoint,
      bettingWindowMs: BETTING_WINDOW_MS,
      algorithmVersion: ProvablyFairService.ALGORITHM_VERSION,
    });

    await this.roundRepository.create(round);
    this.currentRound = round;

    this.broadcaster.broadcastToRound(round.id, "round:betting_open", {
      roundId: round.id,
      serverSeedHash: round.serverSeedHash,
      bettingEndsAt: round.bettingEndsAt.toISOString(),
    });

    this.logger.log(`Round ${round.id} (nonce ${round.nonce}) opened for betting`);

    setTimeout(() => {
      this.startRunningPhase().catch((err) => this.logger.error(err));
    }, BETTING_WINDOW_MS);
  }

  private async startRunningPhase(): Promise<void> {
    const round = this.currentRound;
    if (!round) {
      return;
    }
    round.transitionToRunning();
    await this.roundRepository.save(round);

    this.broadcaster.broadcastToRound(round.id, "round:started", {
      roundId: round.id,
      startedAt: round.startedAt?.toISOString(),
    });

    this.tickHandle = setInterval(() => {
      this.tick(round).catch((err) => this.logger.error(err));
    }, TICK_INTERVAL_MS);
  }

  private async tick(round: Round): Promise<void> {
    const elapsed = round.elapsedRunningMs();
    const multiplier = this.multiplierClock.multiplierAt(elapsed);

    if (multiplier >= round.crashPoint) {
      if (this.tickHandle) {
        clearInterval(this.tickHandle);
        this.tickHandle = null;
      }
      await this.crashRound(round);
      return;
    }

    this.broadcaster.broadcastToRound(round.id, "round:multiplier_tick", {
      roundId: round.id,
      multiplier,
      elapsedMs: elapsed,
    });
  }

  private async crashRound(round: Round): Promise<void> {
    round.crash();
    await this.roundRepository.save(round);

    this.broadcaster.broadcastToRound(round.id, "round:crashed", {
      roundId: round.id,
      crashPoint: round.crashPoint,
      crashedAt: round.crashedAt?.toISOString(),
      serverSeed: round.revealSeed(),
      serverSeedHash: round.serverSeedHash,
      clientSeed: round.clientSeed,
      nonce: round.nonce,
    });

    this.logger.log(`Round ${round.id} crashed at ${round.crashPoint}x`);

    const { lostBetsCount } = await this.settleRound.execute(round.id);
    this.broadcaster.broadcastToRound(round.id, "round:settled", { roundId: round.id, lostBetsCount });

    setTimeout(() => {
      this.startNewRound().catch((err) => this.logger.error(err));
    }, ROUND_COOLDOWN_MS);
  }
}
