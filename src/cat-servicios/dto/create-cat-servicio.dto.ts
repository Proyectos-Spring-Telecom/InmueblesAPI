import { ApiProperty } from "@nestjs/swagger";
import { IsNotEmpty, IsString } from "class-validator";

export class CreateCatServicioDto {
  @IsString()
  @IsNotEmpty()
  @ApiProperty({ example: "Mantenimiento", description: "Nombre del servicio" })
  nombre: string;
}

