import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import {
  IsDateString,
  IsInt,
  IsOptional,
  Min,
} from "class-validator";

export class BuscarBitacoraDto {
  @ApiProperty({ example: 1, description: "Número de página (desde 1)" })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page: number;

  @ApiProperty({ example: 10, description: "Registros por página" })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit: number;

  @ApiPropertyOptional({
    example: "2026-01-01",
    description:
      "Fecha inicial del rango (yyyy-MM-dd). Filtra sobre FechaCreacion, inclusive desde las 00:00:00.",
  })
  @IsOptional()
  @IsDateString({}, { message: "fechaInicio debe tener formato yyyy-MM-dd" })
  fechaInicio?: string;

  @ApiPropertyOptional({
    example: "2026-01-31",
    description:
      "Fecha final del rango (yyyy-MM-dd). Filtra sobre FechaCreacion, inclusive hasta las 23:59:59.",
  })
  @IsOptional()
  @IsDateString({}, { message: "fechaFin debe tener formato yyyy-MM-dd" })
  fechaFin?: string;
}
