import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

export class InpcUnificadoItemDto {
  @ApiProperty({ example: false, description: "true = dato de Banxico, false = registro local" })
  isBanxico: boolean;

  @ApiPropertyOptional({ example: 2, description: "Solo registros locales" })
  id?: number;

  @ApiProperty({ example: 2025 })
  anio: number;

  @ApiProperty({ example: 5 })
  mes: number;

  @ApiPropertyOptional({ example: "125587.0000", nullable: true })
  inpc: string | null;

  @ApiPropertyOptional({ example: "3.79", nullable: true })
  porcentajeAnual: string | null;

  @ApiPropertyOptional({
    example: "0.38",
    nullable: true,
    description: "Solo disponible en registros de Banxico",
  })
  porcAcumAnual?: string | null;

  @ApiPropertyOptional({ nullable: true })
  fhRegistro?: Date | null;

  @ApiPropertyOptional({ example: 1, nullable: true })
  estatus?: number | null;
}
