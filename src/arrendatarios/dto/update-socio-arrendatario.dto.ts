import { ApiPropertyOptional, PartialType } from "@nestjs/swagger";
import { Type } from "class-transformer";
import { IsInt, IsOptional } from "class-validator";
import { SocioItemDto } from "./registrar-arrendatario-form.dto";

export class UpdateSocioArrendatarioDto extends PartialType(SocioItemDto) {
  @ApiPropertyOptional({
    description:
      "Id del socio existente (SociosArrendatarios). Si se envía, actualiza; si no, crea uno nuevo.",
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  id?: number;
}
