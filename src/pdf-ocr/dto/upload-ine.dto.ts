import { ApiHideProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsOptional, IsString } from 'class-validator';

export class UploadIneDto {
  /** Id de módulo para bitácora (fijo 16; no se documenta en Swagger). */
  @ApiHideProperty()
  @IsOptional()
  @IsString({ message: 'idModule debe ser un string numérico' })
  @Transform(({ value }) =>
    value != null && String(value).trim() !== '' ? String(value) : '16',
  )
  idModule: string = '16';
}
