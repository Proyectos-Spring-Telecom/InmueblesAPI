import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import {
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  Max,
  Min,
} from "class-validator";

export class CreateInpcDto {
  @IsInt()
  @Min(1900)
  @Max(2100)
  @Type(() => Number)
  @ApiProperty({ example: 2026 })
  anio: number;

  @IsInt()
  @Min(1)
  @Max(12)
  @Type(() => Number)
  @ApiProperty({ example: 5, description: "Mes (1-12)" })
  mes: number;

  @IsNumber({ maxDecimalPlaces: 4 })
  @IsNotEmpty()
  @Type(() => Number)
  @ApiProperty({ example: 125.4567 })
  inpc: number;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 4 })
  @Type(() => Number)
  @ApiPropertyOptional({ example: 3.79, description: "Porcentaje anual (%)" })
  porcentajeAnual?: number;
}
