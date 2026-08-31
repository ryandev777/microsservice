import { Inject, Injectable } from "@nestjs/common";
import { RoundNotYetVerifiableError } from "../../domain/round/round.errors";
import { RoundStatus } from "../../domain/round/round-status.vo";
import { ROUND_REPOSITORY } from "../../domain/repositories/round.repository";
import type { RoundRepository } from "../../domain/repositories/round.repository";
import { RoundNotFoundError } from "./settle-round.use-case";

export interface VerifyRoundOutput {
  roundId: string;
  serverSeed: string;
  serverSeedHash: string;
  clientSeed: string;
  nonce: number;
  crashPoint: number;
  algorithmVersion: string;
}

@Injectable()
export class VerifyRoundUseCase {
  constructor(@Inject(ROUND_REPOSITORY) private readonly roundRepository: RoundRepository) {}

  async execute(roundId: string): Promise<VerifyRoundOutput> {
    const round = await this.roundRepository.findById(roundId);
    if (!round) {
      throw new RoundNotFoundError(roundId);
    }
    if (round.status !== RoundStatus.CRASHED && round.status !== RoundStatus.SETTLED) {
      throw new RoundNotYetVerifiableError(roundId);
    }

    const serverSeed = round.revealSeed();

    return {
      roundId: round.id,
      serverSeed,
      serverSeedHash: round.serverSeedHash,
      clientSeed: round.clientSeed,
      nonce: round.nonce,
      crashPoint: round.crashPoint,
      algorithmVersion: round.algorithmVersion,
    };
  }
}
