import { ApiPropertyOptional, PartialType } from "@nestjs/swagger";
import { Type } from "class-transformer";
import { IsInt, IsOptional } from "class-validator";
import { SocioArrendadorItemDto } from "./socio-arrendador-item.dto";

export class UpdateSocioArrendadorDto extends PartialType(
  SocioArrendadorItemDto,
) {
  @ApiPropertyOptional({
    description:
      "Id del socio existente (SociosArrendadores). Si se envía, actualiza; si no, crea uno nuevo.",
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  id?: number;
}
