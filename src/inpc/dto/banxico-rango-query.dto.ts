import { ApiProperty } from '@nestjs/swagger';
import { IsDateString, IsNotEmpty } from 'class-validator';

export class BanxicoRangoQueryDto {
  @IsDateString({}, { message: 'fechaInicial debe tener formato yyyy-MM-dd' })
  @IsNotEmpty()
  @ApiProperty({
    example: '2024-01-01',
    description: 'Fecha inicial del rango (yyyy-MM-dd)',
  })
  fechaInicial: string;

  @IsDateString({}, { message: 'fechaFinal debe tener formato yyyy-MM-dd' })
  @IsNotEmpty()
  @ApiProperty({
    example: '2024-12-31',
    description: 'Fecha final del rango (yyyy-MM-dd)',
  })
  fechaFinal: string;
}
