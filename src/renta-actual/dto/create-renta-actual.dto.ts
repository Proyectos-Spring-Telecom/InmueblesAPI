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

  @ApiProperty({
    example: "2026-08-01T00:00:00.000Z",
    description: "Fecha de inicio del periodo/mes de la renta (se guarda en Mes). Lo envía el front.",
  })
  @IsDateString()
  fechaInicio: string;

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
    example: "2026-09-30T00:00:00.000Z",
    description:
      "Si se envía, el registro es de periodo (EsPeriodo=1). Si es null/omitido, EsPeriodo=0.",
  })
  @IsOptional()
  @IsDateString()
  fechaFin?: string | null;

  @ApiPropertyOptional({
    example: 1,
    description: "Indica si usa fórmula (1 = sí, 0 = no). Lo envía el front.",
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(1)
  usaFormula?: number;

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
