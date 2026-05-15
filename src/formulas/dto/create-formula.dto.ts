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
}
