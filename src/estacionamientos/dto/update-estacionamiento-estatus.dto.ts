import { ApiProperty } from "@nestjs/swagger";
import { Type } from "class-transformer";
import { IsEnum } from "class-validator";
import { EstacionamientoEstatus } from "src/common/estacionamiento-estatus.enum";

export class UpdateEstacionamientoEstatusDto {
  @ApiProperty({
    example: EstacionamientoEstatus.Activo,
    enum: EstacionamientoEstatus,
    description: "0 = Baja, 1 = Activo",
  })
  @Type(() => Number)
  @IsEnum(EstacionamientoEstatus)
  estatus: EstacionamientoEstatus;
}
