import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

export class BitacoraRegistroDto {
  @ApiProperty({ example: 1, description: "ID del registro de bitácora" })
  id: number;

  @ApiPropertyOptional({
    example: "Formulas",
    description: "Nombre del módulo que generó el evento",
  })
  modulo: string | null;

  @ApiPropertyOptional({
    example: "Fórmula evaluada: Actualización de Renta por INPC. Resultado: 10447.76.",
    description: "Descripción legible de la acción",
  })
  descripcion: string | null;

  @ApiPropertyOptional({
    example: "EVALUATE",
    description: "Tipo de acción (CREATE, UPDATE, EVALUATE, etc.)",
  })
  accion: string | null;

  @ApiPropertyOptional({
    description: "Payload o detalle técnico guardado (JSON)",
    example: { dto: { idFormula: 1 }, resultado: 10447.76 },
  })
  query: object | string | null;

  @ApiPropertyOptional({
    example: "2026-05-19 14:30:00",
    description: "Fecha y hora del registro",
  })
  fechaCreacion: Date | string | null;

  @ApiPropertyOptional({
    example: "success",
    description: "Estatus del evento (success, error, etc.)",
  })
  estatus: string | null;

  @ApiPropertyOptional({
    example: null,
    description: "Mensaje de error si el evento falló",
    nullable: true,
  })
  error: string | null;

  @ApiProperty({ example: 2, description: "ID del usuario que realizó la acción" })
  idUsuario: number;

  @ApiPropertyOptional({ example: "Osmar" })
  nombreUsuario: string | null;

  @ApiPropertyOptional({ example: "Martinez" })
  apellidoPaternoUsuario: string | null;

  @ApiPropertyOptional({ example: "Lopez" })
  apellidoMaternoUsuario: string | null;

  @ApiPropertyOptional({ example: "osmar.martinez" })
  UserNameUsuario: string | null;

  @ApiPropertyOptional({ example: 1, description: "Estatus del usuario (0 o 1)" })
  estatusUsuario: number | null;

  @ApiProperty({ example: 5, description: "ID del módulo del catálogo Modulos" })
  idModulo: number;

  @ApiPropertyOptional({ example: "Fórmulas" })
  nombreModulo: string | null;

  @ApiPropertyOptional({ example: "Gestión de fórmulas de cálculo" })
  descripcionModulo: string | null;
}

export class BitacoraPaginacionDto {
  @ApiProperty({ example: 120 })
  total: number;

  @ApiProperty({ example: 1 })
  page: number;

  @ApiProperty({ example: 12 })
  lastPage: number;
}

export class BitacoraListResponseDto {
  @ApiProperty({ type: [BitacoraRegistroDto] })
  data: BitacoraRegistroDto[];
}

export class BitacoraPaginatedResponseDto {
  @ApiProperty({ type: [BitacoraRegistroDto] })
  data: BitacoraRegistroDto[];

  @ApiProperty({ type: BitacoraPaginacionDto })
  paginated: BitacoraPaginacionDto;
}

export class BitacoraOneResponseDto {
  @ApiProperty({ type: [BitacoraRegistroDto] })
  data: BitacoraRegistroDto[];
}
