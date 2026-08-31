import { Controller, Get, HttpCode, HttpStatus, Post, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { HealthCheckResponseDto } from "../dtos/health-check-response.dto";
import { CreateWalletResponseDto } from "../dtos/create-wallet-response.dto";
import { WalletBalanceResponseDto } from "../dtos/wallet-balance-response.dto";
import { CurrentPlayer } from "../decorators/current-player.decorator";
import { JwtAuthGuard } from "../../infrastructure/auth/jwt-auth.guard";
import { CreateWalletUseCase } from "../../application/use-cases/create-wallet.use-case";
import { GetWalletBalanceUseCase } from "../../application/use-cases/get-wallet-balance.use-case";

@ApiTags("wallets")
@Controller()
export class WalletsController {
  constructor(
    private readonly createWalletUseCase: CreateWalletUseCase,
    private readonly getWalletBalanceUseCase: GetWalletBalanceUseCase,
  ) {}

  @Get("health")
  check(): HealthCheckResponseDto {
    return { status: "ok", service: "wallets" };
  }

  @Post("wallets")
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.CREATED)
  async createWallet(@CurrentPlayer() playerId: string): Promise<CreateWalletResponseDto> {
    const wallet = await this.createWalletUseCase.execute(playerId);
    return {
      id: wallet.id,
      playerId: wallet.playerId.toString(),
      balance: wallet.balance.toString(),
    };
  }

  @Get("wallets/me")
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  async getMyWallet(@CurrentPlayer() playerId: string): Promise<WalletBalanceResponseDto> {
    const wallet = await this.getWalletBalanceUseCase.execute(playerId);
    return {
      playerId: wallet.playerId.toString(),
      balanceCents: wallet.balance.toCents().toString(),
      balance: wallet.balance.toString(),
    };
  }
}
