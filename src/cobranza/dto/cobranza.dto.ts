import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { plainToInstance, Transform, Type } from "class-transformer";
import {
  ArrayMinSize,
  IsArray,
  IsDateString,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Length,
  Matches,
  MaxLength,
  Min,
  ValidateNested,
} from "class-validator";

/** Acepta arreglos en JSON o como texto JSON (necesario en multipart/form-data). */
function parseJsonArray<T>(cls: new () => T) {
  return ({ value }: { value: unknown }) => {
    if (value === undefined || value === null || value === "") return undefined;
    let parsed = value;
    if (typeof value === "string") {
      try {
        parsed = JSON.parse(value);
      } catch {
        return value; // lo rechaza @IsArray
      }
    }
    return Array.isArray(parsed) ? plainToInstance(cls, parsed) : parsed;
  };
}

export class AplicacionDto {
  @ApiProperty({ example: 315, description: "Id del concepto de cargo (renta, mantenimiento o servicio)" })
  @Type(() => Number)
  @IsInt()
  idCargoConcepto: number;

  @ApiProperty({ example: 6000, description: "Monto a aplicar, mayor a 0 y hasta el saldo del concepto" })
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  monto: number;
}

export class RegistrarPagoDto {
  @ApiProperty({ example: 67 })
  @Type(() => Number)
  @IsInt()
  idArrendatario: number;

  @ApiProperty({ example: "2026-10-12", description: "Fecha real en que se recibió el dinero (puede ser anterior)" })
  @IsDateString()
  fechaPago: string;

  @ApiProperty({ example: 8000 })
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  monto: number;

  @ApiPropertyOptional({ example: 1, description: "CatMetodosPago; define la forma de pago SAT por defecto" })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  idMetodoPago?: number;

  @ApiPropertyOptional({ example: "03", description: "c_FormaPago del SAT (si se omite, la del método de pago)" })
  @IsOptional()
  @Matches(/^\d{2}$/)
  formaPagoSat?: string;

  @ApiPropertyOptional({ example: "SPEI 0045123", description: "Folio o referencia bancaria" })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  referencia?: string;

  @ApiPropertyOptional({
    type: [AplicacionDto],
    description:
      "A qué conceptos se aplica. Lo no aplicado queda como saldo a favor. " +
      "En multipart/form-data enviar como texto JSON.",
  })
  @IsOptional()
  @Transform(parseJsonArray(AplicacionDto))
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AplicacionDto)
  aplicaciones?: AplicacionDto[];
}

export class AplicarPagoDto {
  @ApiProperty({ type: [AplicacionDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => AplicacionDto)
  aplicaciones: AplicacionDto[];
}

export class CancelarDto {
  @ApiProperty({ example: "Monto capturado con error" })
  @IsString()
  @Length(3, 300)
  motivo: string;
}

export class ConceptoCargoDto {
  @ApiPropertyOptional({ example: 6, description: "CatServicios (1 Agua, 2 Internet, 5 Limpieza, 6 Luz, 7 Predial…)" })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  idTipoServicio?: number;

  @ApiPropertyOptional({ example: 73, description: "Servicio contratado del arrendatario que origina el cargo" })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  idServicioArrendatario?: number;

  @ApiPropertyOptional({ example: "Luz septiembre 2026" })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  descripcion?: string;

  @ApiProperty({ example: 1740, description: "Total con IVA" })
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  total: number;

  @ApiPropertyOptional({ example: 1500, description: "Si se envía junto con iva, debe sumar el total" })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  subtotal?: number;

  @ApiPropertyOptional({ example: 240 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  iva?: number;
}

export class CrearCargoDto {
  @ApiProperty({ example: 67 })
  @Type(() => Number)
  @IsInt()
  idArrendatario: number;

  @ApiPropertyOptional({ example: 71, description: "Contrato al que pertenece; no puede estar cancelado" })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  idContrato?: number;

  @ApiProperty({ enum: ["SERVICIO", "OTRO"], example: "SERVICIO" })
  @IsIn(["SERVICIO", "OTRO"])
  clase: "SERVICIO" | "OTRO";

  @ApiProperty({ example: "2026-09-30", description: "Fecha del cargo (no tiene que coincidir con el ciclo de renta)" })
  @IsDateString()
  fecha: string;

  @ApiPropertyOptional({ example: "2026-10-31", description: "Fin del periodo, si cubre varios meses" })
  @IsOptional()
  @IsDateString()
  fechaFin?: string;

  @ApiPropertyOptional({ example: "Recibo de luz septiembre" })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  descripcion?: string;

  @ApiProperty({ type: [ConceptoCargoDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => ConceptoCargoDto)
  conceptos: ConceptoCargoDto[];
}

export class ListarCargosQuery {
  @Type(() => Number) @IsInt() @Min(1) page: number = 1;
  @Type(() => Number) @IsInt() @Min(1) limit: number = 20;
  @IsOptional() @Type(() => Number) @IsInt() idArrendatario?: number;
  @IsOptional() @Type(() => Number) @IsInt() idContrato?: number;
  @IsOptional() @IsIn(["RENTA", "SERVICIO", "OTRO"]) clase?: string;
  @IsOptional() @IsIn(["PENDIENTE", "PARCIAL", "PAGADO", "CANCELADO", "CON_SALDO"]) estado?: string;
  @IsOptional() @IsDateString() fechaInicio?: string;
  @IsOptional() @IsDateString() fechaFin?: string;
}

export class ListarPagosQuery {
  @Type(() => Number) @IsInt() @Min(1) page: number = 1;
  @Type(() => Number) @IsInt() @Min(1) limit: number = 20;
  @IsOptional() @Type(() => Number) @IsInt() idArrendatario?: number;
  @IsOptional() @Type(() => Number) @IsIn([0, 1, 2]) estatus?: number;
  @IsOptional() @IsDateString() fechaInicio?: string;
  @IsOptional() @IsDateString() fechaFin?: string;
  /** true: sólo pagos con saldo a favor (disponible > 0). */
  @IsOptional() @Transform(({ value }) => value === true || value === "true") conDisponible?: boolean;
}

export class EstadoCuentaQuery {
  @IsOptional() @IsDateString() fechaInicio?: string;
  @IsOptional() @IsDateString() fechaFin?: string;
}
