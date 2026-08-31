import { ApiProperty } from "@nestjs/swagger";

export class WalletBalanceResponseDto {
  @ApiProperty()
  playerId!: string;

  @ApiProperty({ example: "1234", description: "Balance in integer cents" })
  balanceCents!: string;

  @ApiProperty({ example: "12.34" })
  balance!: string;
}
