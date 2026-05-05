import { ProcessingType } from 'src/entities/DocumentOcr';

export interface OcrResult {
  text: string;
  processingType: ProcessingType;
  pageCount: number;
}
