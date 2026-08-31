import { Inject, Injectable } from "@nestjs/common";
import { ROUND_REPOSITORY } from "../../domain/repositories/round.repository";
import type { RoundRepository } from "../../domain/repositories/round.repository";

export interface RoundHistoryItemView {
  roundId: string;
  crashPoint: number;
  crashedAt: string | null;
  createdAt: string;
}

export interface RoundHistoryOutput {
  items: RoundHistoryItemView[];
  nextCursor: string | null;
}

@Injectable()
export class GetRoundHistoryUseCase {
  constructor(@Inject(ROUND_REPOSITORY) private readonly roundRepository: RoundRepository) {}

  async execute(limit: number, cursor?: string | null): Promise<RoundHistoryOutput> {
    const page = await this.roundRepository.findHistory(limit, cursor);
    return {
      items: page.items.map((round) => ({
        roundId: round.id,
        crashPoint: round.crashPoint,
        crashedAt: round.crashedAt?.toISOString() ?? null,
        createdAt: round.createdAt.toISOString(),
      })),
      nextCursor: page.nextCursor,
    };
  }
}
