import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import {
  IsArray,
  IsDateString,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  ValidateNested,
} from "class-validator";
import { CreateServicioInmuebleDto } from "./create-servicio-inmueble.dto";
import { CreateZonaInmuebleDto } from "./create-zona-inmueble.dto";
import { CreateArchivoInmuebleDto } from "./create-archivo-inmueble.dto";

/**
 * DTO de registro de inmueble vía multipart/form-data con notación anidada.
 *
 * Campos planos del inmueble:
 *   inmueble, idArrendador, direccionFiscal, estatusInmueble, vigenciaAnios,
 *   fechaInicio, fechaFin, nombreRepresentante, telefonoRepresentante,
 *   correoRepresentante, lat, lng
 *
 * Arreglos (notación bracket por índice):
 *   servicios[i].idTipoServicio   servicios[i].numeroContrato
 *   servicios[i].fechaPago        servicios[i].ultimoDiaPago
 *   servicios[i].archivo (FILE)
 *
 *   zonas[i].zonaPrincipal        zonas[i].superficieZonaM2
 *   zonas[i].superficieDisponibleM2  zonas[i].numeroZona
 *   zonas[i].locales[j].nombre    zonas[i].locales[j].areaM2
 *   zonas[i].locales[j].estatus   zonas[i].locales[j].mensualidad
 *   zonas[i].locales[j].giro
 *
 *   archivos[i].nombre   archivos[i].archivo (FILE)
 *   imagenes[i].nombre   imagenes[i].archivo (FILE)
 */
export class CreateInmuebleDto {
  @ApiProperty({ example: "Plaza Real" })
  @IsString()
  @IsNotEmpty()
  @MaxLength(400)
  inmueble: string;

  @ApiProperty({ example: 1, description: "ID del cliente (arrendador)" })
  @Type(() => Number)
  @IsInt()
  idArrendador: number;

  @ApiPropertyOptional({ example: "Av. Reforma 123, CDMX" })
  @IsOptional()
  @IsString()
  direccionFiscal?: string;

  @ApiPropertyOptional({ example: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  estatusInmueble?: number;

  @ApiPropertyOptional({ example: "5" })
  @IsOptional()
  @IsString()
  @MaxLength(45)
  vigenciaAnios?: string;

  @ApiPropertyOptional({ example: "2026-05-12" })
  @IsOptional()
  @IsDateString()
  fechaInicio?: string;

  @ApiPropertyOptional({ example: "2031-05-12" })
  @IsOptional()
  @IsDateString()
  fechaFin?: string;

  @ApiPropertyOptional({ example: "Juan Pérez" })
  @IsOptional()
  @IsString()
  @MaxLength(250)
  nombreRepresentante?: string;

  @ApiPropertyOptional({ example: "5555555555" })
  @IsOptional()
  @IsString()
  @MaxLength(10)
  telefonoRepresentante?: string;

  @ApiPropertyOptional({ example: "rep@empresa.com" })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  correoRepresentante?: string;

  @ApiPropertyOptional({ example: 19.4326 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  lat?: number;

  @ApiPropertyOptional({ example: -99.1332 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  lng?: number;

  @ApiPropertyOptional({
    description:
      "Servicios. Enviar en FormData como servicios[i].* (incl. servicios[i].archivo).",
    type: [CreateServicioInmuebleDto],
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateServicioInmuebleDto)
  servicios?: CreateServicioInmuebleDto[];

  @ApiPropertyOptional({
    description:
      "Zonas. Enviar en FormData como zonas[i].* y locales anidados zonas[i].locales[j].*",
    type: [CreateZonaInmuebleDto],
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateZonaInmuebleDto)
  zonas?: CreateZonaInmuebleDto[];

  @ApiPropertyOptional({
    description:
      "Documentación del inmueble. Enviar en FormData como archivos[i].nombre y archivos[i].archivo (FILE).",
    type: [CreateArchivoInmuebleDto],
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateArchivoInmuebleDto)
  archivos?: CreateArchivoInmuebleDto[];

  @ApiPropertyOptional({
    description:
      "Imágenes del inmueble. Enviar en FormData como imagenes[i].nombre y imagenes[i].archivo (FILE).",
    type: [CreateArchivoInmuebleDto],
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateArchivoInmuebleDto)
  imagenes?: CreateArchivoInmuebleDto[];
}
