import { ApiPropertyOptional, OmitType, PartialType } from "@nestjs/swagger";
import { Type } from "class-transformer";
import {
  IsArray,
  IsOptional,
  ValidateNested,
} from "class-validator";
import { CreateInmuebleDto } from "./create-inmueble.dto";
import { UpdateArchivoInmuebleDto } from "./update-archivo-inmueble.dto";
import { UpdateServicioInmuebleDto } from "./update-servicio-inmueble.dto";
import { UpdateZonaInmuebleDto } from "./update-zona-inmueble.dto";

export class UpdateInmuebleDto extends PartialType(
  OmitType(CreateInmuebleDto, [
    "servicios",
    "zonas",
    "archivos",
    "imagenes",
  ] as const),
) {
  @ApiPropertyOptional({
    type: [UpdateServicioInmuebleDto],
    description:
      "Servicios: con id actualiza el registro; sin id crea uno nuevo.",
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => UpdateServicioInmuebleDto)
  servicios?: UpdateServicioInmuebleDto[];

  @ApiPropertyOptional({
    type: [UpdateZonaInmuebleDto],
    description:
      "Zonas: con id actualiza la zona (y locales con id); sin id crea zona nueva.",
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => UpdateZonaInmuebleDto)
  zonas?: UpdateZonaInmuebleDto[];

  @ApiPropertyOptional({
    type: [UpdateArchivoInmuebleDto],
    description:
      "Documentación: con id actualiza nombre y/o archivo; sin id crea registro nuevo.",
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => UpdateArchivoInmuebleDto)
  archivos?: UpdateArchivoInmuebleDto[];

  @ApiPropertyOptional({
    type: [UpdateArchivoInmuebleDto],
    description:
      "Imágenes: con id actualiza nombre y/o archivo; sin id crea registro nuevo.",
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => UpdateArchivoInmuebleDto)
  imagenes?: UpdateArchivoInmuebleDto[];
}
