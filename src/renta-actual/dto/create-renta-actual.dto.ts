import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Transform, Type } from "class-transformer";
import {
  IsInt,
  IsNumber,
  IsOptional,
  Max,
  Min,
} from "class-validator";
import { optionalDecimalTransform } from "src/common/pago-mensual.utils";

export class CreateRentaActualDto {
  @ApiProperty({ example: 1 })
  @Type(() => Number)
  @IsInt()
  idArrendatario: number;

  @ApiProperty({
    example: 5,
    description: "Solo puede existir un registro activo por arrendatario y contrato.",
  })
  @Type(() => Number)
  @IsInt()
  idContrato: number;

  @ApiPropertyOptional({ example: 15000.5, description: "Total renta" })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  total?: number;

  @ApiPropertyOptional({ example: 2 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  idFormula?: number;

  @ApiPropertyOptional({ example: 15500.75, description: "Monto final renta" })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  montoFinal?: number;

  @ApiPropertyOptional({ example: 3500, description: "Total mantenimiento" })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  totalMantenimiento?: number;

  @ApiPropertyOptional({
    example: 3675,
    description: "Monto final mantenimiento",
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  montoFinalMantenimiento?: number;

  @ApiPropertyOptional({
    example: 1.05,
    description:
      "Factor aplicado (p. ej. INPC). Se acepta con más decimales y se redondea a 2.",
  })
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
}
