import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import {
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from "class-validator";

export class CreateFactorDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  @ApiProperty({ example: "FactorA" })
  variable: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  @ApiPropertyOptional({ example: "1.25" })
  valor?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  @ApiPropertyOptional({ example: "Descripción del factor" })
  descripcion?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: "esContrato debe ser un número entero" })
  @IsIn([0, 1], { message: "esContrato solo puede ser 0 o 1" })
  @ApiPropertyOptional({
    example: 0,
    enum: [0, 1],
    description:
      "Indica si el factor aplica a contrato: 0 = no, 1 = sí. Solo se permiten 0 u 1.",
  })
  esContrato?: number = 0;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1900)
  @Max(2100)
  @ApiPropertyOptional({ example: 2025, description: "Año INPC asociado al factor" })
  anioInpc?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(12)
  @ApiPropertyOptional({ example: 5, description: "Mes INPC asociado al factor (1-12)" })
  mesInpc?: number;
}
