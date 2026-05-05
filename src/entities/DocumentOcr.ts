import { applySchema } from 'src/utils/schema';
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
} from 'typeorm';

export enum ProcessingType {
  NATIVE = 'native',
  OCR = 'ocr',
}

@Entity('DocumentOcr')
@applySchema
export class DocumentOcr {
  @PrimaryGeneratedColumn({ type: 'bigint', name: 'Id', comment: 'Primary Key' })
  id: number;

  @Column({
    name: 'FileName',
    type: 'varchar',
    length: 255,
    nullable: false,
    comment: 'Nombre original del archivo PDF',
  })
  fileName: string;

  @Column({
    name: 'ExtractedText',
    type: 'longtext',
    nullable: true,
    comment: 'Texto extraído del PDF',
  })
  extractedText: string | null;

  @Column({
    name: 'ProcessingType',
    type: 'enum',
    enum: ProcessingType,
    nullable: false,
    comment: 'Tipo de procesamiento usado: native | ocr',
  })
  processingType: ProcessingType;

  @Column({
    name: 'PageCount',
    type: 'int',
    nullable: false,
    default: 0,
    comment: 'Cantidad de páginas procesadas',
  })
  pageCount: number;

  @CreateDateColumn({
    name: 'FechaCreacion',
    type: 'datetime',
    default: () => 'CURRENT_TIMESTAMP',
    comment: 'Fecha de creación',
  })
  fechaCreacion: Date;
}
