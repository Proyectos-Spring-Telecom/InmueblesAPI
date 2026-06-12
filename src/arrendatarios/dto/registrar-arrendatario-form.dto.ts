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
  Max,
  MaxLength,
  Min,
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

  @ApiPropertyOptional({ example: "XAXX010101000" })
  @IsOptional()
  @IsString()
  @MaxLength(13)
  rfc?: string;

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

/** JSON en el arreglo FormData `contratos` (sin id, idArrendatario, fhRegistro ni estatus). */
export class ContratoArrendatarioJsonDto {
  @ApiPropertyOptional({ example: 10 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  idInmueble?: number;

  @ApiPropertyOptional({
    type: [Number],
    example: [1, 2],
    description: "Ids de LocalesZonaInmueble asociados al contrato (ContratoLocales).",
  })
  @IsOptional()
  @IsArray()
  @IsInt({ each: true })
  @Type(() => Number)
  idLocales?: number[];

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

  @ApiPropertyOptional({
    example: 0,
    description: "0 = no incluye mantenimiento, 1 = incluye mantenimiento",
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(1)
  incluyeMantenimiento?: number;
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

/** En PUT del arrendatario usar `socios[i].id` para actualizar un socio existente. */
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
      rfc: "XAXX010101000",
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
    type: [ContratoArrendatarioJsonDto],
    description:
      "Opcional. JSON string con arreglo de ContratoArrendatarios (sin id/idArrendatario/fhRegistro/estatus; incluye idLocales). " +
      "También admite contratos[i].* en FormData.",
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ContratoArrendatarioJsonDto)
  contratos?: ContratoArrendatarioJsonDto[];

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
