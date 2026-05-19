import { ApiPropertyOptional, PartialType } from "@nestjs/swagger";
import { Type } from "class-transformer";
import {
  IsArray,
  IsInt,
  IsOptional,
  ValidateNested,
} from "class-validator";
import {
  ArchivoConNombreDto,
  ArrendatarioJsonDto,
  ContratoArrendatarioJsonDto,
  CreateServicioArrendatarioItemDto,
  SocioItemDto,
} from "./registrar-arrendatario-form.dto";

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

  @ApiPropertyOptional({ type: () => UpdateContratoArrendatarioJsonDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => UpdateContratoArrendatarioJsonDto)
  contratoArrendatario?: UpdateContratoArrendatarioJsonDto;

  @ApiPropertyOptional({ type: [CreateServicioArrendatarioItemDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateServicioArrendatarioItemDto)
  servicios?: CreateServicioArrendatarioItemDto[];

  @ApiPropertyOptional({ type: [ArchivoConNombreDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ArchivoConNombreDto)
  archivos?: ArchivoConNombreDto[];

  @ApiPropertyOptional({ type: [ArchivoConNombreDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ArchivoConNombreDto)
  imagenes?: ArchivoConNombreDto[];

  @ApiPropertyOptional({ type: [SocioItemDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SocioItemDto)
  socios?: SocioItemDto[];
}
