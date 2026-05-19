import { ApiProperty } from "@nestjs/swagger";
import { Type } from "class-transformer";
import { IsEnum } from "class-validator";
import { LocalesEstatus } from "src/common/locales-estatus.enum";

export class UpdateLocalEstatusDto {
  @ApiProperty({
    example: LocalesEstatus.Disponible,
    enum: LocalesEstatus,
    description: "LocalesEstatus: 0 Baja, 1 Disponible, 2 Ocupado, 3 Apartado",
  })
  @Type(() => Number)
  @IsEnum(LocalesEstatus)
  estatus: LocalesEstatus;
}
