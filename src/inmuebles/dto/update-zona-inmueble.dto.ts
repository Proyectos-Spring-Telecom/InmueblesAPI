import { ApiPropertyOptional, PartialType } from "@nestjs/swagger";
import { Type } from "class-transformer";
import {
  IsArray,
  IsInt,
  IsOptional,
  ValidateNested,
} from "class-validator";
import { CreateZonaInmuebleDto } from "./create-zona-inmueble.dto";
import { UpdateLocalZonaInmuebleDto } from "./update-local-zona-inmueble.dto";

export class UpdateZonaInmuebleDto extends PartialType(CreateZonaInmuebleDto) {
  @ApiPropertyOptional({
    description:
      "Id de la zona existente (ZonasInmuebles). Si se envía, actualiza; si no, crea una nueva.",
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  id?: number;

  @ApiPropertyOptional({
    type: [UpdateLocalZonaInmuebleDto],
    description:
      "Locales de la zona. Con id actualiza; sin id crea. FormData: zonas[i].locales[j].id, etc.",
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => UpdateLocalZonaInmuebleDto)
  declare locales?: UpdateLocalZonaInmuebleDto[];
}
