import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsNotEmpty, IsOptional, IsString, MaxLength } from "class-validator";

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
}
