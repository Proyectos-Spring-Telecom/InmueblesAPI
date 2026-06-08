import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import {
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
} from "class-validator";

export class CreateBitacoraDto {
  @ApiPropertyOptional({
    description: "Nombre del módulo que originó el evento",
    example: "Usuarios",
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  modulo?: string;

  @ApiPropertyOptional({
    description: "Descripción legible de la acción realizada",
    example: "El usuario actualizó su contraseña",
  })
  @IsOptional()
  @IsString()
  @MaxLength(250)
  descripcion?: string;

  @ApiPropertyOptional({
    description: "Acción realizada (CREATE, UPDATE, DELETE, EVALUATE, etc.)",
    example: "UPDATE",
  })
  @IsOptional()
  @IsString()
  @MaxLength(45)
  accion?: string;

  @ApiPropertyOptional({
    description: "Detalle técnico o payload asociado al evento",
    example: '{"idUsuario":1,"campo":"password"}',
  })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  query?: string;

  @ApiPropertyOptional({
    description: "Estatus del evento",
    example: "success",
    enum: ["success", "error"],
  })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  estatus?: string;

  @ApiPropertyOptional({
    description: "Mensaje de error si el evento falló",
    example: "Error al insertar: usuario no válido",
  })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  error?: string;

  @ApiProperty({
    description: "ID del usuario que generó la acción",
    example: 1,
  })
  @IsNotEmpty()
  @Type(() => Number)
  @IsNumber()
  idUsuario: number;

  @ApiProperty({
    description: "ID del módulo del catálogo Modulos",
    example: 3,
  })
  @IsNotEmpty()
  @Type(() => Number)
  @IsNumber()
  idModulo: number;
}
