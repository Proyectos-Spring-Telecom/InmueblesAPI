import { ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import {
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
} from "class-validator";
import { LocalesEstatus } from "src/common/locales-estatus.enum";

export class CreateLocalZonaInmuebleDto {
  @ApiPropertyOptional({ example: "Local A-01" })
  @IsOptional()
  @IsString()
  @MaxLength(250)
  nombre?: string;

  @ApiPropertyOptional({ example: 45.5 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  areaM2?: number;

  @ApiPropertyOptional({
    example: LocalesEstatus.Disponible,
    enum: LocalesEstatus,
    description: "LocalesEstatus: 0 Baja, 1 Disponible, 2 Ocupado, 3 Apartado",
  })
  @IsOptional()
  @Type(() => Number)
  @IsEnum(LocalesEstatus)
  estatus?: LocalesEstatus;

  @ApiPropertyOptional({ example: 8500 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  mensualidad?: number;

  @ApiPropertyOptional({ example: 1360 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  mensualidadIva?: number;

  @ApiPropertyOptional({ example: 500 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  mantenimiento?: number;

  @ApiPropertyOptional({ example: 80 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  mantenimientoIva?: number;

  @ApiPropertyOptional({ example: "Restaurante" })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  giro?: string;

  @ApiPropertyOptional({
    description:
      "Imagen de fachada del local (FILE). En FormData: zonas[i].locales[j].fachada. " +
      "Se sube a S3 (carpeta FachadasLocales) y se guarda en LocalesZonaInmueble.FachadaUrl.",
    type: "string",
    format: "binary",
  })
  @IsOptional()
  fachada?: any;
}
