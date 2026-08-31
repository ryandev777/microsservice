import { ApiProperty } from "@nestjs/swagger";

export class CashoutResponseDto {
  @ApiProperty() betId!: string;
  @ApiProperty() cashoutMultiplier!: number;
  @ApiProperty() payoutAmountCents!: string;
}
