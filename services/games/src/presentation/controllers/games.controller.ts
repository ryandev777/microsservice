import { Controller, Get, HttpException, HttpStatus, Param, Query } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { HealthCheckResponseDto } from "../dtos/health-check-response.dto";
import { GetCurrentRoundUseCase } from "../../application/use-cases/get-current-round.use-case";
import { GetRoundHistoryUseCase } from "../../application/use-cases/get-round-history.use-case";
import { VerifyRoundUseCase } from "../../application/use-cases/verify-round.use-case";
import { RoundNotFoundError } from "../../application/use-cases/settle-round.use-case";
import { RoundNotYetVerifiableError } from "../../domain/round/round.errors";

@ApiTags("games")
@Controller()
export class GamesController {
  constructor(
    private readonly getCurrentRound: GetCurrentRoundUseCase,
    private readonly getRoundHistory: GetRoundHistoryUseCase,
    private readonly verifyRound: VerifyRoundUseCase,
  ) {}

  @Get("health")
  check(): HealthCheckResponseDto {
    return { status: "ok", service: "games" };
  }

  @Get("games/rounds/current")
  async current() {
    return this.getCurrentRound.execute();
  }

  @Get("games/rounds/history")
  async history(@Query("limit") limit?: string, @Query("cursor") cursor?: string) {
    return this.getRoundHistory.execute(limit ? Number(limit) : 20, cursor ?? null);
  }

  @Get("games/rounds/:roundId/verify")
  async verify(@Param("roundId") roundId: string) {
    try {
      return await this.verifyRound.execute(roundId);
    } catch (error) {
      if (error instanceof RoundNotFoundError) {
        throw new HttpException(error.message, HttpStatus.NOT_FOUND);
      }
      if (error instanceof RoundNotYetVerifiableError) {
        throw new HttpException(error.message, HttpStatus.CONFLICT);
      }
      throw error;
    }
  }
}
