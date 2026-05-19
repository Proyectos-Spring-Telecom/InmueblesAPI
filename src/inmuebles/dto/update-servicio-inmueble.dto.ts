import { ApiPropertyOptional, PartialType } from "@nestjs/swagger";
import { Type } from "class-transformer";
import { IsInt, IsOptional } from "class-validator";
import { CreateServicioInmuebleDto } from "./create-servicio-inmueble.dto";

export class UpdateServicioInmuebleDto extends PartialType(
  CreateServicioInmuebleDto,
) {
  @ApiPropertyOptional({
    description:
      "Id del servicio existente (ServiciosInmuebles). Si se envía, actualiza; si no, crea uno nuevo.",
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  id?: number;
}
