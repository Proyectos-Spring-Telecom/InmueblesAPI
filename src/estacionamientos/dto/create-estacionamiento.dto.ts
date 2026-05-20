import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import {
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
} from "class-validator";

export class CreateEstacionamientoDto {
  @ApiProperty({ example: 1 })
  @Type(() => Number)
  @IsInt()
  idInmueble: number;

  @ApiPropertyOptional({ example: "Juan Pérez" })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  nombrePensionado?: string;

  @ApiPropertyOptional({ example: "TARJ-001" })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  numeroTarjeta?: string;

  @ApiPropertyOptional({ example: 12 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  idArrendatario?: number;
}
