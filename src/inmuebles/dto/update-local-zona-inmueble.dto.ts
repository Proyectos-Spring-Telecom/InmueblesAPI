import { ApiPropertyOptional, PartialType } from "@nestjs/swagger";
import { Type } from "class-transformer";
import { IsInt, IsOptional } from "class-validator";
import { CreateLocalZonaInmuebleDto } from "./create-local-zona-inmueble.dto";

export class UpdateLocalZonaInmuebleDto extends PartialType(
  CreateLocalZonaInmuebleDto,
) {
  @ApiPropertyOptional({
    description:
      "Id del local existente (LocalesZonaInmueble). Si se envía, actualiza; si no, crea uno nuevo.",
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  id?: number;
}
