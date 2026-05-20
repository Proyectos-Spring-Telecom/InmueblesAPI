import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import {
  IsDateString,
  IsInt,
  IsOptional,
} from "class-validator";

export class QueryEntradasSalidasPaginatedDto {
  @ApiProperty({ example: 1, description: "Filtrar por inmueble" })
  @Type(() => Number)
  @IsInt()
  idInmueble: number;

  @ApiPropertyOptional({
    example: "2026-01-01",
    description: "Fecha inicio (filtro sobre FechaEntrada, inclusive)",
  })
  @IsOptional()
  @IsDateString()
  fechaInicio?: string;

  @ApiPropertyOptional({
    example: "2026-12-31",
    description: "Fecha fin (filtro sobre FechaEntrada, inclusive)",
  })
  @IsOptional()
  @IsDateString()
  fechaFin?: string;

  @ApiProperty({ example: 1 })
  @Type(() => Number)
  @IsInt()
  page: number;

  @ApiProperty({ example: 20 })
  @Type(() => Number)
  @IsInt()
  limit: number;
}
