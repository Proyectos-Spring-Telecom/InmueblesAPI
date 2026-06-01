import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { BitacoraModule } from 'src/bitacora/bitacora.module';
import { PdfOcrController } from './pdf-ocr.controller';
import { SpringReaderClientService } from './services/springreader-client.service';

@Module({
  imports: [BitacoraModule, HttpModule],
  controllers: [PdfOcrController],
  providers: [SpringReaderClientService],
})
export class PdfOcrModule {}
