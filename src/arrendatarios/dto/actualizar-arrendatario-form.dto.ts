import { ApiPropertyOptional, PartialType } from "@nestjs/swagger";
import { Type } from "class-transformer";
import {
  IsArray,
  IsInt,
  IsOptional,
  ValidateNested,
} from "class-validator";
import {
  ArrendatarioJsonDto,
  ContratoArrendatarioJsonDto,
} from "./registrar-arrendatario-form.dto";
import { UpdateArchivoArrendatarioDto } from "./update-archivo-arrendatario.dto";
import { UpdateServicioArrendatarioItemDto } from "./update-servicio-arrendatario.dto";
import { UpdateSocioArrendatarioDto } from "./update-socio-arrendatario.dto";

export class UpdateArrendatarioJsonDto extends PartialType(ArrendatarioJsonDto) {}

export class UpdateContratoArrendatarioJsonDto extends PartialType(
  ContratoArrendatarioJsonDto,
) {
  @ApiPropertyOptional({
    description:
      "Si se envía, actualiza ese contrato; si se omite, crea un contrato nuevo.",
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  id?: number;
}

export class ActualizarArrendatarioFormDto {
  @ApiPropertyOptional({ type: () => UpdateArrendatarioJsonDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => UpdateArrendatarioJsonDto)
  arrendatario?: UpdateArrendatarioJsonDto;

  @ApiPropertyOptional({
    type: [UpdateContratoArrendatarioJsonDto],
    description:
      "Contratos: con id actualiza; sin id crea. También admite contratos[i].* en FormData.",
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => UpdateContratoArrendatarioJsonDto)
  contratos?: UpdateContratoArrendatarioJsonDto[];

  @ApiPropertyOptional({ type: [UpdateServicioArrendatarioItemDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => UpdateServicioArrendatarioItemDto)
  servicios?: UpdateServicioArrendatarioItemDto[];

  @ApiPropertyOptional({
    type: [UpdateArchivoArrendatarioDto],
    description:
      "Documentación: con id actualiza nombre y/o archivo; sin id crea registro nuevo.",
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => UpdateArchivoArrendatarioDto)
  archivos?: UpdateArchivoArrendatarioDto[];

  @ApiPropertyOptional({
    type: [UpdateArchivoArrendatarioDto],
    description:
      "Imágenes: con id actualiza nombre y/o archivo; sin id crea registro nuevo.",
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => UpdateArchivoArrendatarioDto)
  imagenes?: UpdateArchivoArrendatarioDto[];

  @ApiPropertyOptional({
    type: [UpdateSocioArrendatarioDto],
    description:
      "Socios: con id actualiza datos y/o documentos; sin id crea socio nuevo.",
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => UpdateSocioArrendatarioDto)
  socios?: UpdateSocioArrendatarioDto[];
}
