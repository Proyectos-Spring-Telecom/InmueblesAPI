import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import {
  IsDateString,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
} from "class-validator";

export class CreatePagoDto {
  @ApiProperty({ example: 1 })
  @Type(() => Number)
  @IsInt()
  idInmueble: number;

  @ApiPropertyOptional({ example: 2 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  idServicioInmueble?: number;

  @ApiPropertyOptional({ example: "Renta mensual" })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  concepto?: string;

  @ApiProperty({ example: "2026-05-15T12:00:00.000Z" })
  @IsDateString()
  fechaPago: string;

  @ApiProperty({ example: 15000.5 })
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  monto: number;

  @ApiPropertyOptional({ example: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  idMetodoPago?: number;

  @ApiPropertyOptional({
    example: 1,
    description: "Pendiente = 2, Pagado = 1, Cancelado = 0. Default: 1",
  })
  @IsOptional()
  @Type(() => Number)
  @IsIn([0, 1, 2])
  estatus?: number;
}
