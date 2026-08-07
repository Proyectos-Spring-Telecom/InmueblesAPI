import { ApiPropertyOptional, PartialType } from "@nestjs/swagger";
import { Type } from "class-transformer";
import { IsInt, IsOptional } from "class-validator";
import { CreateServicioArrendatarioItemDto } from "./registrar-arrendatario-form.dto";

export class UpdateServicioArrendatarioItemDto extends PartialType(
  CreateServicioArrendatarioItemDto,
) {
  @ApiPropertyOptional({
    description:
      "Id del servicio existente (ServiciosArrendatarios). Si se envía, actualiza; si no, crea uno nuevo. " +
      "En creación, usa `idContrato` o el emparejamiento por índice con `contratos[i]`.",
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  id?: number;
}
