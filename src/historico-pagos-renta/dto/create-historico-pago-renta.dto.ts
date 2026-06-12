import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Transform, Type } from "class-transformer";
import {
  IsDateString,
  IsInt,
  IsNumber,
  IsOptional,
  Max,
  Min,
} from "class-validator";
import { optionalDecimalTransform } from "src/common/pago-mensual.utils";

export class CreateHistoricoPagoRentaDto {
  @ApiProperty({ example: 1 })
  @Type(() => Number)
  @IsInt()
  idArrendatario: number;

  @ApiProperty({ example: 5 })
  @Type(() => Number)
  @IsInt()
  idContrato: number;

  @ApiProperty({ example: "2026-05-01T00:00:00.000Z" })
  @IsDateString()
  mes: string;

  @ApiPropertyOptional({ example: 15000.5 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  total?: number;

  @ApiPropertyOptional({ example: 2 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  idFormula?: number;

  @ApiPropertyOptional({ example: 15500.75 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  montoFinal?: number;

  @ApiPropertyOptional({ example: 3500 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  totalMantenimiento?: number;

  @ApiPropertyOptional({ example: 3675 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  montoFinalMantenimiento?: number;

  @ApiPropertyOptional({ example: 1.05 })
  @IsOptional()
  @Transform(optionalDecimalTransform)
  @IsNumber({ maxDecimalPlaces: 2 })
  factorVariable?: number;

  @ApiPropertyOptional({ example: 1, description: "1 = sí, 0 = no" })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(1)
  ocupoFormula?: number;

  @ApiPropertyOptional({ example: 1, description: "0 = pendiente, 1 = pagada" })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(1)
  pagada?: number;
}
