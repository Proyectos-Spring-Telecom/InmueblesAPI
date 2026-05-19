import { ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import { IsInt, IsOptional } from "class-validator";
import { ArchivoConNombreDto } from "./registrar-arrendatario-form.dto";

export class UpdateArchivoArrendatarioDto extends ArchivoConNombreDto {
  @ApiPropertyOptional({
    description:
      "Id del archivo existente (ArchivosArrendatarios). Si se envía, actualiza; si no, crea uno nuevo.",
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  id?: number;
}
