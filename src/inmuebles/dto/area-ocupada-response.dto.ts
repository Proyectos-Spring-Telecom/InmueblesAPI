import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

export class AreaOcupadaLocalDto {
  @ApiProperty({ example: 12 })
  id: number;

  @ApiPropertyOptional({ example: "Local 101" })
  nombre: string | null;

  @ApiPropertyOptional({ example: "85.50" })
  areaM2: string | null;

  @ApiPropertyOptional({ example: 3 })
  idZona: number | null;

  @ApiPropertyOptional({ example: "Planta baja" })
  zonaPrincipal: string | null;

  @ApiPropertyOptional({ example: 1 })
  numeroZona: number | null;

  @ApiPropertyOptional({ example: 5 })
  idContrato: number | null;

  @ApiPropertyOptional({ example: 2 })
  idArrendatario: number | null;

  @ApiPropertyOptional({
    example: "Tienda ABC SA de CV",
    description: "Nombre del arrendatario del local (columna Arrendatario), vía contrato activo.",
  })
  nombreArrendador: string | null;
}

export class AreaOcupadaResponseDto {
  @ApiPropertyOptional({ example: "2500.00" })
  totalM2: string | null;

  @ApiProperty({ type: [AreaOcupadaLocalDto] })
  localesRentados: AreaOcupadaLocalDto[];
}
