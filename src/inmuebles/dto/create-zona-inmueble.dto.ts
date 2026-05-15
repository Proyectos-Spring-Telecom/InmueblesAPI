import { ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import {
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
} from "class-validator";

export class CreateZonaInmuebleDto {
  @ApiPropertyOptional({ example: "Local 1" })
  @IsOptional()
  @IsString()
  @MaxLength(150)
  zonaPrincipal?: string;

  @ApiPropertyOptional({ example: 100.5 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  superficieZonaM2?: number;

  @ApiPropertyOptional({ example: 50.25 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  superficieDisponibleM2?: number;

  @ApiPropertyOptional({ example: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  numeroZona?: number;
}
