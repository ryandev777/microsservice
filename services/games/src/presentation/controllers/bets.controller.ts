import { Body, Controller, Get, HttpException, HttpStatus, Post, Query, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { JwtAuthGuard } from "../../infrastructure/auth/jwt-auth.guard";
import { CurrentPlayer } from "../decorators/current-player.decorator";
import { CurrentUsername } from "../decorators/current-username.decorator";
import { PlaceBetRequestDto } from "../dtos/place-bet-request.dto";
import { PlaceBetResponseDto } from "../dtos/place-bet-response.dto";
import { CashoutResponseDto } from "../dtos/cashout-response.dto";
import { DuplicateBetError } from "../../domain/bet/bet.errors";
import { RoundNotInBettingPhaseError, RoundNotRunningError } from "../../domain/round/round.errors";
import { NoCurrentRoundError, PlaceBetUseCase } from "../../application/use-cases/place-bet.use-case";
import {
  NoBetForPlayerError,
  RequestCashoutUseCase,
} from "../../application/use-cases/request-cashout.use-case";
import { GetMyBetsUseCase } from "../../application/use-cases/get-my-bets.use-case";

@ApiTags("bets")
@ApiBearerAuth()
@Controller("games")
export class BetsController {
  constructor(
    private readonly placeBet: PlaceBetUseCase,
    private readonly requestCashout: RequestCashoutUseCase,
    private readonly getMyBets: GetMyBetsUseCase,
  ) {}

  @Post("bet")
  @UseGuards(JwtAuthGuard)
  async bet(
    @CurrentPlayer() playerId: string,
    @CurrentUsername() username: string,
    @Body() dto: PlaceBetRequestDto,
  ): Promise<PlaceBetResponseDto> {
    try {
      return await this.placeBet.execute({ playerId, username, amountCents: BigInt(dto.amountCents) });
    } catch (error) {
      if (error instanceof RoundNotInBettingPhaseError || error instanceof DuplicateBetError) {
        throw new HttpException(error.message, HttpStatus.CONFLICT);
      }
      if (error instanceof NoCurrentRoundError) {
        throw new HttpException(error.message, HttpStatus.SERVICE_UNAVAILABLE);
      }
      throw error;
    }
  }

  @Post("bet/cashout")
  @UseGuards(JwtAuthGuard)
  async cashout(@CurrentPlayer() playerId: string): Promise<CashoutResponseDto> {
    try {
      return await this.requestCashout.execute({ playerId });
    } catch (error) {
      if (error instanceof RoundNotRunningError || error instanceof NoBetForPlayerError) {
        throw new HttpException(error.message, HttpStatus.CONFLICT);
      }
      if (error instanceof NoCurrentRoundError) {
        throw new HttpException(error.message, HttpStatus.SERVICE_UNAVAILABLE);
      }
      throw error;
    }
  }

  @Get("bets/me")
  @UseGuards(JwtAuthGuard)
  async myBets(@CurrentPlayer() playerId: string, @Query("limit") limit?: string, @Query("cursor") cursor?: string) {
    return this.getMyBets.execute(playerId, limit ? Number(limit) : 20, cursor ?? null);
  }
}
