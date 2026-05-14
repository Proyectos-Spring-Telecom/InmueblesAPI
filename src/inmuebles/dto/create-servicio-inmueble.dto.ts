import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import {
  IsDateString,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
} from "class-validator";

/**
 * Item de `servicios[i]`. Campos enviados en FormData como:
 *   servicios[0].idTipoServicio
 *   servicios[0].numeroContrato
 *   servicios[0].fechaPago
 *   servicios[0].ultimoDiaPago
 *   servicios[0].archivo     (FILE — comprobante)
 *
 * Tras subir `archivo` a S3 (folder "Servicios Inmuebles", idModule 1)
 * la URL resultante se persistirá en `ServiciosInmuebles.UrlComprobante`.
 */
export class CreateServicioInmuebleDto {
  @ApiProperty({ example: 1, description: "FK CatServicios.Id" })
  @Type(() => Number)
  @IsInt()
  idTipoServicio: number;

  @ApiPropertyOptional({ example: "C-001" })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  numeroContrato?: string;

  @ApiPropertyOptional({ example: "2026-05-15" })
  @IsOptional()
  @IsDateString()
  fechaPago?: string;

  @ApiPropertyOptional({ example: "2026-06-15" })
  @IsOptional()
  @IsDateString()
  ultimoDiaPago?: string;

  @ApiPropertyOptional({
    description: "Comprobante del servicio (binario).",
    type: "string",
    format: "binary",
  })
  @IsOptional()
  archivo?: any;
}
