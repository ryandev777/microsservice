import { ApiProperty } from "@nestjs/swagger";
import { IsInt, Max, Min } from "class-validator";

export class PlaceBetRequestDto {
  @ApiProperty({ description: "Bet amount in integer cents (100 = 1.00, 100000 = 1,000.00)", example: 1000 })
  @IsInt()
  @Min(100)
  @Max(100_000)
  amountCents!: number;
}
