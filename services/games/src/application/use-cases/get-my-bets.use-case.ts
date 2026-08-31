import { Inject, Injectable } from "@nestjs/common";
import { BET_REPOSITORY } from "../../domain/repositories/bet.repository";
import type { BetRepository } from "../../domain/repositories/bet.repository";

export interface MyBetItemView {
  betId: string;
  roundId: string;
  amountCents: string;
  status: string;
  cashoutMultiplier: number | null;
  payoutAmountCents: string | null;
  createdAt: string;
}

export interface MyBetsOutput {
  items: MyBetItemView[];
  nextCursor: string | null;
}

@Injectable()
export class GetMyBetsUseCase {
  constructor(@Inject(BET_REPOSITORY) private readonly betRepository: BetRepository) {}

  async execute(playerId: string, limit: number, cursor?: string | null): Promise<MyBetsOutput> {
    const page = await this.betRepository.findByPlayer(playerId, limit, cursor);
    return {
      items: page.items.map((bet) => ({
        betId: bet.id,
        roundId: bet.roundId,
        amountCents: bet.amount.toCents().toString(),
        status: bet.status,
        cashoutMultiplier: bet.cashoutMultiplier,
        payoutAmountCents: bet.payoutAmount ? bet.payoutAmount.toCents().toString() : null,
        createdAt: bet.createdAt.toISOString(),
      })),
      nextCursor: page.nextCursor,
    };
  }
}
