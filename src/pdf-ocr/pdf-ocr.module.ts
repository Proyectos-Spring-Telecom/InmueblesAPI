import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DocumentOcr } from 'src/entities/DocumentOcr';
import { BitacoraModule } from 'src/bitacora/bitacora.module';
import { PdfOcrController } from './pdf-ocr.controller';
import { PdfOcrService } from './pdf-ocr.service';
import { PdfDetectorService } from './services/pdf-detector.service';
import { PdfNativeExtractorService } from './services/pdf-native-extractor.service';
import { PdfOcrExtractorService } from './services/pdf-ocr-extractor.service';
import { ConstanciaFiscalParserService } from './services/constancia-fiscal-parser.service';
import { IneParserService } from './services/ine-parser.service';

@Module({
  imports: [TypeOrmModule.forFeature([DocumentOcr]), BitacoraModule],
  controllers: [PdfOcrController],
  providers: [
    PdfOcrService,
    PdfDetectorService,
    PdfNativeExtractorService,
    PdfOcrExtractorService,
    ConstanciaFiscalParserService,
    IneParserService,
  ],
})
export class PdfOcrModule {}
