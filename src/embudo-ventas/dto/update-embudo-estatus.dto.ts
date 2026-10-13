import { ApiProperty } from "@nestjs/swagger";
import { Type } from "class-transformer";
import { IsInt, IsNotEmpty, Max, Min } from "class-validator";

export class UpdateEmbudoEstatusDto {
  @ApiProperty({
    example: 1,
    description: "Estatus del embudo. 1 equivale a Registrado.",
  })
  @Type(() => Number)
  @IsNotEmpty({ message: "El estatus es obligatorio" })
  @IsInt({ message: "Estatus debe ser un número entero" })
  @Min(0)
  @Max(127)
  estatus: number;
}
