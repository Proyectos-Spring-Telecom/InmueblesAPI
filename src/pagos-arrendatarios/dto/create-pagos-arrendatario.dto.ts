import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import {
  IsDateString,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
} from "class-validator";
import { PagoEstatus } from "src/common/pago-estatus.enum";

export class CreatePagosArrendatarioDto {
  @ApiProperty({ example: 1 })
  @Type(() => Number)
  @IsInt()
  idArrendatario: number;

  @ApiPropertyOptional({ example: 2 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  idServicioArrendatario?: number;

  @ApiPropertyOptional({ example: "Renta mensual" })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  concepto?: string;

  @ApiProperty({ example: "2026-05-15T12:00:00.000Z" })
  @IsDateString()
  fechaPago: string;

  @ApiPropertyOptional({
    example: "2026-06-15T12:00:00.000Z",
    description:
      "Si se envía, el pago es de periodo (EsPeriodo=1). Si es null/omitido, EsPeriodo=0.",
  })
  @IsOptional()
  @IsDateString()
  fechaPagoFinal?: string | null;

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
    example: PagoEstatus.Pagado,
    enum: PagoEstatus,
    description: "PagoEstatus: 0 Cancelado, 1 Pagado, 2 Pendiente. Default: 1",
  })
  @IsOptional()
  @Type(() => Number)
  @IsEnum(PagoEstatus)
  estatus?: PagoEstatus;
}
