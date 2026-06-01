import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class BanxicoParametrosConsultaDto {
  @ApiProperty({
    example: 'sinCeros',
    description:
      'Formato de decimales enviado a Banxico. `sinCeros` omite ceros innecesarios al final del valor.',
  })
  decimales: 'sinCeros';

  @ApiProperty({
    example: ['PorcAnual', 'PorcAcumAnual'],
    description:
      'Tipos de incremento solicitados a Banxico (en consultas separadas, porque la API no admite ambos en una sola petición).',
    isArray: true,
    enum: ['PorcAnual', 'PorcAcumAnual'],
  })
  incremento: Array<'PorcAnual' | 'PorcAcumAnual'>;
}

export class BanxicoDatoPorFechaDto {
  @ApiProperty({
    example: '01/03/2024',
    description:
      'Fecha de la observación en formato Banxico (dd/MM/yyyy). En la serie SP1 corresponde al primer día del mes reportado.',
  })
  fecha: string;

  @ApiPropertyOptional({
    example: '132.45',
    nullable: true,
    description:
      '**Índice INPC (nivel):** valor del Índice Nacional de Precios al Consumidor — serie SP1, ' +
      '“IPC índice general nacional”. Es el nivel del índice en esa fecha (no es un porcentaje). ' +
      'Sirve como base para comparar inflación entre periodos o calcular factores de actualización.',
  })
  indice: string | null;

  @ApiPropertyOptional({
    example: '4.42',
    nullable: true,
    description:
      '**Variación porcentual anual (`PorcAnual`):** cambio porcentual del INPC respecto al mismo mes del año anterior. ' +
      'Indica la inflación interanual a esa fecha.',
  })
  porcAnual: string | null;

  @ApiPropertyOptional({
    example: '1.51',
    nullable: true,
    description:
      '**Variación porcentual acumulada anual (`PorcAcumAnual`):** cambio acumulado del INPC desde el inicio del año calendario ' +
      'hasta el mes de la observación. Refleja la inflación acumulada en el año en curso.',
  })
  porcAcumAnual: string | null;
}

export class BanxicoConsultaResponseDto {
  @ApiProperty({
    example: 'SP1',
    description:
      'Identificador de la serie en Banxico. **SP1** = INPC índice general nacional (IPC por objeto del gasto, índice general).',
  })
  idSerie: string;

  @ApiPropertyOptional({
    example: 'IPC ... Índice General',
    nullable: true,
    description: 'Título descriptivo de la serie tal como lo devuelve Banxico.',
  })
  titulo: string | null;

  @ApiProperty({
    example: '2024-01-01',
    description: 'Fecha inicial del rango consultado (yyyy-MM-dd).',
  })
  fechaInicial: string;

  @ApiProperty({
    example: '2024-12-31',
    description: 'Fecha final del rango consultado (yyyy-MM-dd).',
  })
  fechaFinal: string;

  @ApiProperty({ type: BanxicoParametrosConsultaDto })
  parametros: BanxicoParametrosConsultaDto;

  @ApiProperty({
    type: [BanxicoDatoPorFechaDto],
    description:
      'Observaciones mensuales del periodo. Cada elemento agrupa, para la misma fecha, el índice y los dos incrementos porcentuales.',
  })
  datos: BanxicoDatoPorFechaDto[];
}
