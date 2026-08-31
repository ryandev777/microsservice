import { ApiProperty } from "@nestjs/swagger";

export class CreateWalletResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  playerId!: string;

  @ApiProperty({ example: "0.00" })
  balance!: string;
}
