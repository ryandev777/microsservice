import { ApiProperty } from "@nestjs/swagger";

export class PlaceBetResponseDto {
  @ApiProperty() betId!: string;
  @ApiProperty() roundId!: string;
  @ApiProperty() status!: string;
}
