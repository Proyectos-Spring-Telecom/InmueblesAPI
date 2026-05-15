import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import {
  IsArray,
  IsDateString,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  ValidateNested,
} from "class-validator";

/** JSON en el campo FormData `arrendatario` (sin id, fhRegistro ni estatus; incluye lat/lng). */
export class ArrendatarioJsonDto {
  @ApiPropertyOptional({ example: "Empresa Arrendataria SA" })
  @IsOptional()
  @IsString()
  @MaxLength(250)
  arrendatario?: string;

  @ApiProperty({ example: 1, description: "FK Clientes.Id (arrendador)" })
  @Type(() => Number)
  @IsInt()
  idArrendador: number;

  @ApiPropertyOptional({ example: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  tipoPersona?: number;

  @ApiPropertyOptional({ example: 12000.5 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  renta?: number;

  @ApiPropertyOptional({ example: "2026-01-01" })
  @IsOptional()
  @IsDateString()
  fechaInicio?: string;

  @ApiPropertyOptional({ example: "2027-01-01" })
  @IsOptional()
  @IsDateString()
  fechaFin?: string;

  @ApiPropertyOptional({ example: "12" })
  @IsOptional()
  @IsString()
  @MaxLength(10)
  tiempoRenta?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(250)
  representanteLegal?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(10)
  telefonoRepresentante?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(100)
  correoRepresentante?: string;

  @ApiPropertyOptional({ example: 19.4326 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  lat?: number;

  @ApiPropertyOptional({ example: -99.1332 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  lng?: number;
}

/** JSON en el campo FormData `contratoArrendatario` (sin id, idArrendatario, fhRegistro ni estatus). */
export class ContratoArrendatarioJsonDto {
  @ApiPropertyOptional({ example: 10 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  idInmueble?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  fechaInicioContrato?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  fechaTerminoContrato?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(10)
  moneda?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  metrosRentados?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  costoM2?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  porcentajeMantenimiento?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  mesesDeposito?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  montoDeposito?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  mesesAdelanto?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  montoAdelanto?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  aniosForzososArrendador?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  aniosForzososArrendatario?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  subTotalRenta?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  ivaRenta?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  rentaTotal?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  subTotalMantenimiento?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  ivaMantenimiento?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  mantenimientoTotal?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  observaciones?: string;
}

export class CreateServicioArrendatarioItemDto {
  @ApiProperty({ example: 1 })
  @Type(() => Number)
  @IsInt()
  idTipoServicio: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(100)
  numeroContrato?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  fechaPago?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  ultimoDiaPago?: string;

  @ApiPropertyOptional({ type: "string", format: "binary" })
  @IsOptional()
  archivo?: any;
}

export class ArchivoConNombreDto {
  @ApiPropertyOptional({ example: "Acta constitutiva" })
  @IsOptional()
  @IsString()
  @MaxLength(250)
  nombre?: string;

  @ApiPropertyOptional({ type: "string", format: "binary" })
  @IsOptional()
  archivo?: any;
}

export class SocioItemDto {
  @ApiProperty({ example: "Socio A" })
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  nombre: string;

  @ApiPropertyOptional({ example: "XAXX010101000" })
  @IsOptional()
  @IsString()
  @MaxLength(25)
  rfc?: string;

  @ApiPropertyOptional({ type: "string", format: "binary" })
  @IsOptional()
  constanciaFiscalArchivo?: any;

  @ApiPropertyOptional({ type: "string", format: "binary" })
  @IsOptional()
  comprobanteDomicilioArchivo?: any;

  @ApiPropertyOptional({ type: "string", format: "binary" })
  @IsOptional()
  identificacionOficialArchivo?: any;
}

export class RegistrarArrendatarioFormDto {
  @ApiProperty({
    type: () => ArrendatarioJsonDto,
    description:
      "En FormData enviar como JSON string; el servidor lo parsea antes de validar. " +
      "Todos los campos de Arrendatarios (más lat/lng); ver schema ArrendatarioJsonDto.",
    example: {
      idArrendador: 1,
      arrendatario: "Empresa ACME",
      tipoPersona: 1,
      renta: 12000.5,
      fechaInicio: "2026-01-01",
      fechaFin: "2027-01-01",
      tiempoRenta: "12",
      representanteLegal: "Juan Pérez",
      telefonoRepresentante: "5551234567",
      correoRepresentante: "contacto@empresa.com",
      lat: 19.4326,
      lng: -99.1332,
    },
  })
  @ValidateNested()
  @Type(() => ArrendatarioJsonDto)
  arrendatario: ArrendatarioJsonDto;

  @ApiPropertyOptional({
    type: () => ContratoArrendatarioJsonDto,
    description:
      "Opcional. JSON string con ContratoArrendatarios (sin id/idArrendatario/fhRegistro/estatus).",
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => ContratoArrendatarioJsonDto)
  contratoArrendatario?: ContratoArrendatarioJsonDto;

  @ApiPropertyOptional({ type: [CreateServicioArrendatarioItemDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateServicioArrendatarioItemDto)
  servicios?: CreateServicioArrendatarioItemDto[];

  @ApiPropertyOptional({ type: [ArchivoConNombreDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ArchivoConNombreDto)
  archivos?: ArchivoConNombreDto[];

  @ApiPropertyOptional({ type: [ArchivoConNombreDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ArchivoConNombreDto)
  imagenes?: ArchivoConNombreDto[];

  @ApiPropertyOptional({ type: [SocioItemDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SocioItemDto)
  socios?: SocioItemDto[];
}
