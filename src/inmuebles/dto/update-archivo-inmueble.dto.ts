import { ApiPropertyOptional, PartialType } from "@nestjs/swagger";
import { Type } from "class-transformer";
import { IsInt, IsOptional } from "class-validator";
import { CreateArchivoInmuebleDto } from "./create-archivo-inmueble.dto";

export class UpdateArchivoInmuebleDto extends PartialType(
  CreateArchivoInmuebleDto,
) {
  @ApiPropertyOptional({
    description:
      "Id del archivo existente (ArchivosInmuebles). Si se envía, actualiza; si no, crea uno nuevo.",
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  id?: number;
}
