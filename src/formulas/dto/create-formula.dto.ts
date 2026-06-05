import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsNotEmpty, IsOptional, IsString, MaxLength } from "class-validator";

export class CreateFormulaDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  @ApiProperty({ example: "Renta con INPC" })
  nombre: string;

  @IsOptional()
  @IsString()
  @ApiPropertyOptional({
    example: "(renta * factor) + mantenimiento",
    description: "Expresión de la fórmula",
  })
  formula?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  @ApiPropertyOptional({
    example: "Calcula la nueva renta multiplicando por el cociente INPC",
    description: "Descripción de qué calcula la fórmula",
  })
  descripcion?: string;

  @IsOptional()
  @IsString()
  @ApiPropertyOptional({
    example: "MONTO",
    enum: ["MONTO", "PORCENTAJE"],
    description: "Tipo de resultado: MONTO ($) o PORCENTAJE (%)",
  })
  tipoResultado?: string;
}
