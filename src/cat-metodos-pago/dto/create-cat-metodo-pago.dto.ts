import { ApiProperty } from "@nestjs/swagger";
import { IsNotEmpty, IsString, MaxLength } from "class-validator";

export class CreateCatMetodoPagoDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  @ApiProperty({ example: "Transferencia bancaria" })
  nombre: string;
}
