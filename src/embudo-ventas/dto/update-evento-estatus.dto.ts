import { ApiProperty } from "@nestjs/swagger";
import { Type } from "class-transformer";
import { IsIn, IsInt, IsNotEmpty } from "class-validator";

export class UpdateEventoEstatusDto {
  @ApiProperty({
    example: 1,
    enum: [0, 1],
    description: "Estatus del evento: 0 pendiente, 1 realizada.",
  })
  @Type(() => Number)
  @IsNotEmpty({ message: "El estatus es obligatorio" })
  @IsInt({ message: "Estatus debe ser un número entero" })
  @IsIn([0, 1], {
    message: "Estatus del evento debe ser 0 (pendiente) o 1 (realizada)",
  })
  estatus: number;
}
