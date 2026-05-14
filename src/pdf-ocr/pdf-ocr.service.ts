import {
  BadRequestException,
  ServiceUnavailableException,
  HttpException,
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BitacoraService } from 'src/bitacora/bitacora.service';
import {
  ApiCrudResponse,
  EstatusEnumBitcora,
} from 'src/common/ApiResponse';
import { DocumentOcr, ProcessingType } from 'src/entities/DocumentOcr';
import { PdfDetectorService } from './services/pdf-detector.service';
import { PdfNativeExtractorService } from './services/pdf-native-extractor.service';
import { PdfOcrExtractorService } from './services/pdf-ocr-extractor.service';
import { ConstanciaFiscalParserService } from './services/constancia-fiscal-parser.service';
import type { ConstanciaFiscalData } from './interfaces/constancia-fiscal.interface';
import type { IneData } from './interfaces/ine-data.interface';
import { IneParserService } from './services/ine-parser.service';
import {
  PaddleOcrClientService,
  type PaddleOcrIneResponse,
} from './services/paddleocr-client.service';

export type PdfOcrProcessResponse = ApiCrudResponse & {
  processingType: ProcessingType;
  pageCount: number;
};

export type PdfOcrIneProcessResponse = Omit<ApiCrudResponse, 'data'> & {
  processingType: ProcessingType | 'ocr_paddleocr';
  pageCount: number;
  data: {
    id: number;
    nombre: string;
    extractedText: string;
    confidence: { frente: number | null; reverso: number | null };
    ine: IneData;
    extraction_id?: string;
  };
};

export type PdfConstanciaFiscalResponse = Omit<ApiCrudResponse, 'data'> & {
  processingType: ProcessingType;
  pageCount: number;
  data: {
    id: number;
    nombre: string;
    constancia: ConstanciaFiscalData;
  };
};

@Injectable()
export class PdfOcrService {
  private readonly logger = new Logger(PdfOcrService.name);

  constructor(
    @InjectRepository(DocumentOcr)
    private readonly documentOcrRepository: Repository<DocumentOcr>,
    private readonly detector: PdfDetectorService,
    private readonly nativeExtractor: PdfNativeExtractorService,
    private readonly ocrExtractor: PdfOcrExtractorService,
    private readonly constanciaParser: ConstanciaFiscalParserService,
    private readonly ineParser: IneParserService,
    private readonly paddleOcrClient: PaddleOcrClientService,
    private readonly configService: ConfigService,
    private readonly bitacoraLogger: BitacoraService,
  ) {}


  async processPdf(
    file: Express.Multer.File,
    idUser: number,
    idModule: number,
  ): Promise<PdfOcrProcessResponse> {
    try {
      if (!file || file.mimetype !== 'application/pdf') {
        this.logger.warn(
          `Solicitud rechazada: mime=${file?.mimetype ?? '(sin file)'} archivo=${file?.originalname ?? '—'}`,
        );
        throw new BadRequestException('Se requiere un archivo PDF válido');
      }

      this.logger.log(
        `Inicio processPdf: archivo="${file.originalname}" size=${file.size}B idUser=${idUser} idModule=${idModule}`,
      );

      const rawMax = Number(process.env.UPLOAD_MAX_SIZE);
      const maxSize =
        Number.isFinite(rawMax) && rawMax > 0
          ? rawMax
          : 10 * 1024 * 1024;
      if (file.size >= maxSize) {
        this.logger.warn(
          `Tamaño excedido: ${file.size}B >= límite ${maxSize}B (UPLOAD_MAX_SIZE=${process.env.UPLOAD_MAX_SIZE ?? 'no definido'})`,
        );
        throw new BadRequestException('Archivo demasiado grande');
      }

      if (!file.buffer) {
        this.logger.warn(`Buffer vacío o ausente para "${file.originalname}"`);
        throw new BadRequestException('Contenido de archivo inválido');
      }
      const pdfBuffer = file.buffer;

      const magic = pdfBuffer.subarray(0, Math.min(5, pdfBuffer.length)).toString('latin1');
      if (!magic.startsWith('%PDF')) {
        this.logger.warn(
          `Cabecera inválida (esperado %PDF): primeros bytes (hex)=${pdfBuffer.subarray(0, 16).toString('hex')} len=${pdfBuffer.length} archivo="${file.originalname}"`,
        );
        throw new BadRequestException(
          'El PDF no se recibió bien (no empieza con %PDF). Suele pasar si con curl envías ' +
            'Content-Type: multipart/form-data sin boundary: quita esa cabecera y usa solo -F para que curl genere el multipart correcto.',
        );
      }

      const { isNative, pageCount: pagesDetected } =
        await this.detector.hasNativeText(pdfBuffer);
      this.logger.log(
        `Detección texto nativo: isNative=${isNative} páginas_totales=${pagesDetected} → estrategia=${isNative ? 'NATIVE (pdf.js)' : 'OCR (pdf2pic+sharp+tesseract)'}`,
      );

      const result = isNative
        ? await this.nativeExtractor.extract(pdfBuffer)
        : await this.ocrExtractor.extract(pdfBuffer, file.originalname);

      const row = this.documentOcrRepository.create({
        fileName: file.originalname,
        extractedText: result.text,
        processingType: result.processingType,
        pageCount: result.pageCount,
      });
      const saved = await this.documentOcrRepository.save(row);

      const fileName = saved.fileName;
      const processingType = result.processingType;
      const pageCount = result.pageCount;

      await this.bitacoraLogger.logToBitacora(
        'PdfOcr',
        `PDF procesado: ${file.originalname} (${result.processingType})`,
        'CREATE',
        { fileName, processingType, pageCount },
        idUser,
        idModule,
        EstatusEnumBitcora.SUCCESS,
      );

      const response: PdfOcrProcessResponse = {
        status: 'success',
        message: 'PDF procesado correctamente',
        data: { id: saved.id, nombre: saved.fileName },
        processingType,
        pageCount,
      };
      this.logger.log(
        `Fin OK: id=${saved.id} file="${saved.fileName}" tipo=${processingType} páginas=${pageCount} texto_len=${result.text.length}`,
      );
      return response;
    } catch (error: unknown) {
      const errMsg =
        error instanceof Error ? error.message : 'Error desconocido';
      const origenNombre = file?.originalname ?? '(sin archivo)';
      if (error instanceof HttpException) {
        this.logger.warn(
          `Fallo controlado processPdf: "${origenNombre}" → ${error.constructor.name}: ${errMsg}`,
        );
      } else {
        this.logger.error(
          `Error no HTTP processPdf: "${origenNombre}" → ${errMsg}`,
          error instanceof Error ? error.stack : undefined,
        );
      }
      await this.bitacoraLogger.logToBitacora(
        'PdfOcr',
        `Error procesando PDF: ${origenNombre}`,
        'CREATE',
        { fileName: origenNombre },
        idUser,
        idModule,
        EstatusEnumBitcora.ERROR,
        errMsg,
      );
      if (error instanceof HttpException) {
        throw error;
      }
      throw new InternalServerErrorException('Error procesando PDF');
    }
  }

  /**
   * Constancia de Situación Fiscal (SAT): flujo híbrido + parseo estructurado.
   */
  async processConstanciaFiscal(
    file: Express.Multer.File,
    idUser: number,
    idModule: number,
  ): Promise<PdfConstanciaFiscalResponse> {
    try {
      if (!file || file.mimetype !== 'application/pdf') {
        this.logger.warn(
          `processConstanciaFiscal: mime inválido=${file?.mimetype ?? '(sin file)'}`,
        );
        throw new BadRequestException('Se requiere un archivo PDF válido');
      }

      this.logger.log(
        `Inicio processConstanciaFiscal: archivo="${file.originalname}" size=${file.size}B idUser=${idUser} idModule=${idModule}`,
      );

      const rawMax = Number(process.env.UPLOAD_MAX_SIZE);
      const maxSize =
        Number.isFinite(rawMax) && rawMax > 0 ? rawMax : 10 * 1024 * 1024;
      if (file.size >= maxSize) {
        throw new BadRequestException('Archivo demasiado grande');
      }

      if (!file.buffer) {
        throw new BadRequestException('Contenido de archivo inválido');
      }

      const magic = file.buffer
        .subarray(0, Math.min(5, file.buffer.length))
        .toString('latin1');
      if (!magic.startsWith('%PDF')) {
        throw new BadRequestException(
          'El PDF no se recibió bien (no empieza con %PDF)',
        );
      }

      const { isNative, pageCount } = await this.detector.hasNativeText(
        file.buffer,
      );
      this.logger.log(
        `processConstanciaFiscal: isNative=${isNative} páginas=${pageCount}`,
      );

      const result = isNative
        ? await this.nativeExtractor.extract(file.buffer)
        : await this.ocrExtractor.extract(file.buffer, file.originalname);

      const constanciaData = this.constanciaParser.parse(result.text);

      const row = this.documentOcrRepository.create({
        fileName: file.originalname,
        extractedText: result.text,
        processingType: result.processingType,
        pageCount: result.pageCount,
      });
      const saved = await this.documentOcrRepository.save(row);

      await this.bitacoraLogger.logToBitacora(
        'PdfOcr',
        `Constancia fiscal procesada: ${file.originalname} (${result.processingType})`,
        'CREATE',
        {
          fileName: file.originalname,
          processingType: result.processingType,
          pageCount: result.pageCount,
          rfc: constanciaData.rfc,
        },
        idUser,
        idModule,
        EstatusEnumBitcora.SUCCESS,
      );

      this.logger.log(
        `processConstanciaFiscal OK: id=${saved.id} rfc=${constanciaData.rfc ?? 'null'} tipo=${result.processingType}`,
      );

      this.logger.log('TEXTO_CRUDO: ' + JSON.stringify(result.text));

      return {
        status: 'success',
        message: 'Constancia fiscal procesada correctamente',
        processingType: result.processingType,
        pageCount: result.pageCount,
        data: {
          id: saved.id,
          nombre: saved.fileName,
          constancia: constanciaData,
        },
      };
    } catch (error: unknown) {
      const errMsg =
        error instanceof Error ? error.message : 'Error desconocido';
      const origenNombre = file?.originalname ?? '(sin archivo)';

      if (error instanceof HttpException) {
        this.logger.warn(
          `Fallo controlado processConstanciaFiscal: "${origenNombre}" → ${error.constructor.name}: ${errMsg}`,
        );
      } else {
        this.logger.error(
          `Error no HTTP processConstanciaFiscal: "${origenNombre}" → ${errMsg}`,
          error instanceof Error ? error.stack : undefined,
        );
      }

      await this.bitacoraLogger.logToBitacora(
        'PdfOcr',
        `Error procesando constancia fiscal: ${origenNombre}`,
        'CREATE',
        { fileName: origenNombre },
        idUser,
        idModule,
        EstatusEnumBitcora.ERROR,
        errMsg,
      );

      if (error instanceof HttpException) throw error;
      throw new InternalServerErrorException(
        'Error procesando constancia fiscal',
      );
    }
  }

  /**
   * Procesa dos imágenes (frente y reverso de INE) con OCR.
   * Concatena los textos extraídos y los guarda como UN solo registro en DocumentOcr.
   */
  async processImagesIne(
    frente: Express.Multer.File,
    reverso: Express.Multer.File,
    idUser: number,
    idModule: number,
  ): Promise<PdfOcrIneProcessResponse> {
    const fileNameCombo = `${frente.originalname}+${reverso.originalname}`;
    this.logger.log(
      `Inicio processImagesIne: frente="${frente.originalname}" (${frente.size}B) reverso="${reverso.originalname}" (${reverso.size}B) idUser=${idUser} idModule=${idModule}`,
    );

    const allowedMimes = ['image/jpeg', 'image/jpg', 'image/png'];
    if (!allowedMimes.includes(frente.mimetype)) {
      this.logger.warn(
        `MIME inválido frente="${frente.originalname}" mime=${frente.mimetype}`,
      );
      throw new BadRequestException(
        `Frente: formato no permitido (${frente.mimetype}). Acepta: JPG, PNG.`,
      );
    }
    if (!allowedMimes.includes(reverso.mimetype)) {
      this.logger.warn(
        `MIME inválido reverso="${reverso.originalname}" mime=${reverso.mimetype}`,
      );
      throw new BadRequestException(
        `Reverso: formato no permitido (${reverso.mimetype}). Acepta: JPG, PNG.`,
      );
    }

    const rawMax = Number(process.env.UPLOAD_MAX_SIZE);
    const maxSize =
      Number.isFinite(rawMax) && rawMax > 0
        ? rawMax
        : 10 * 1024 * 1024;
    if (frente.size >= maxSize || reverso.size >= maxSize) {
      this.logger.warn(
        `Tamaño excedido frente=${frente.size}B reverso=${reverso.size}B max=${maxSize}B`,
      );
      throw new BadRequestException(
        `Una de las imágenes excede el tamaño máximo (${maxSize} bytes).`,
      );
    }

    if (!frente.buffer || !reverso.buffer) {
      this.logger.warn(
        `Buffer vacío o ausente frente=${!!frente.buffer} reverso=${!!reverso.buffer}`,
      );
      throw new BadRequestException('Contenido de imagen inválido');
    }

    try {
      const configuredEngine = this.configService.get<string>(
        'OCR_ENGINE',
        'tesseract',
      );
      let ocrEngine = configuredEngine.toLowerCase();
      this.logger.log(`[PdfOcrService] OCR_ENGINE configurado: ${ocrEngine}`);
      if (ocrEngine === 'paddleocr' && !this.paddleOcrClient.isConfigured()) {
        this.logger.warn(
          `[PdfOcrService] PADDLEOCR_SERVICE_URL no configurado. Se usará tesseract`,
        );
        ocrEngine = 'tesseract';
      }

      if (ocrEngine === 'paddleocr') {
        return await this.processImagesIneWithPaddle(
          frente,
          reverso,
          frente.buffer,
          reverso.buffer,
          idUser,
          idModule,
          fileNameCombo,
        );
      }

      const resFrente = await this.ocrExtractor.extractFromImage(
        frente.buffer,
        'frente',
      );
      const resReverso = await this.ocrExtractor.extractFromImage(
        reverso.buffer,
        'reverso',
      );

      const combinedText =
        `=== FRENTE ===\n${resFrente.text.trim()}\n\n` +
        `=== REVERSO ===\n${resReverso.text.trim()}`;

      this.logger.log(
        `processImagesIne: OCR completo longitud_total=${combinedText.length} conf_frente=${resFrente.confidence ?? 'n/a'} conf_reverso=${resReverso.confidence ?? 'n/a'}`,
      );

      const entity = this.documentOcrRepository.create({
        fileName: fileNameCombo,
        extractedText: combinedText,
        processingType: ProcessingType.OCR,
        pageCount: 2,
      });
      const saved = await this.documentOcrRepository.save(entity);

      const ineData = this.ineParser.parse(combinedText);

      this.logger.log(
        `processImagesIne: guardado id=${saved.id}, tipo=${saved.processingType}, páginas=${saved.pageCount}, longitud=${combinedText.length}`,
      );

      await this.bitacoraLogger.logToBitacora(
        'PdfOcr',
        `INE procesada: ${fileNameCombo} (frente+reverso)`,
        'CREATE',
        {
          fileName: fileNameCombo,
          processingType: ProcessingType.OCR,
          pageCount: 2,
          confidenceFrente: resFrente.confidence,
          confidenceReverso: resReverso.confidence,
        },
        idUser,
        idModule,
        EstatusEnumBitcora.SUCCESS,
      );

      const response: PdfOcrIneProcessResponse = {
        status: 'success',
        message: 'INE procesada correctamente',
        data: {
          id: saved.id,
          nombre: saved.fileName,
          extractedText: combinedText,
          confidence: {
            frente:
              resFrente.confidence !== null &&
              Number.isFinite(resFrente.confidence)
                ? Math.round(resFrente.confidence)
                : null,
            reverso:
              resReverso.confidence !== null &&
              Number.isFinite(resReverso.confidence)
                ? Math.round(resReverso.confidence)
                : null,
          },
          ine: ineData,
        },
        processingType: saved.processingType,
        pageCount: saved.pageCount,
      };
      return response;
    } catch (err: unknown) {
      const detail = err instanceof Error ? err.message : String(err);

      if (err instanceof HttpException) {
        this.logger.warn(
          `Fallo controlado processImagesIne: "${fileNameCombo}" → ${err.constructor.name}: ${detail}`,
        );
        await this.bitacoraLogger.logToBitacora(
          'PdfOcr',
          `Error procesando INE: ${fileNameCombo}`,
          'CREATE',
          { fileName: fileNameCombo },
          idUser,
          idModule,
          EstatusEnumBitcora.ERROR,
          detail,
        );
        throw err;
      }

      this.logger.error(
        `Error no HTTP processImagesIne: "${fileNameCombo}" → ${detail}`,
        err instanceof Error ? err.stack : undefined,
      );
      await this.bitacoraLogger.logToBitacora(
        'PdfOcr',
        `Error procesando INE: ${fileNameCombo}`,
        'CREATE',
        { fileName: fileNameCombo },
        idUser,
        idModule,
        EstatusEnumBitcora.ERROR,
        detail,
      );
      throw new InternalServerErrorException('Error procesando imágenes de INE');
    }
  }

  private async processImagesIneWithPaddle(
    frente: Express.Multer.File,
    reverso: Express.Multer.File,
    frenteBuffer: Buffer,
    reversoBuffer: Buffer,
    idUser: number,
    idModule: number,
    fileNameCombo: string,
  ): Promise<PdfOcrIneProcessResponse> {
    this.logger.log('[PdfOcrService] Llamando a microservicio PaddleOCR...');
    const startedAt = Date.now();
    let result: PaddleOcrIneResponse;
    try {
      result = await this.paddleOcrClient.extractIne(frenteBuffer, reversoBuffer, {
        frente: frente.originalname,
        reverso: reverso.originalname,
      });
    } catch (error: unknown) {
      if (error instanceof HttpException) throw error;
      throw new ServiceUnavailableException(
        `Servicio PaddleOCR no disponible. Verifica que esté corriendo en ${this.paddleOcrClient.getBaseUrl()}`,
      );
    }

    const elapsed = Date.now() - startedAt;
    this.logger.log(
      `[PdfOcrService] PaddleOCR respondió en ${elapsed}ms confianza_frente=${result.ocr_confidence?.frente ?? 'n/a'} confianza_reverso=${result.ocr_confidence?.reverso ?? 'n/a'}`,
    );

    const entity = this.documentOcrRepository.create({
      fileName: fileNameCombo,
      extractedText: result.raw_text ?? '',
      processingType: ProcessingType.OCR,
      pageCount: 2,
    });
    const saved = await this.documentOcrRepository.save(entity);

    await this.bitacoraLogger.logToBitacora(
      'PdfOcr',
      `INE procesada: ${fileNameCombo} (engine=paddleocr)`,
      'CREATE',
      {
        fileName: fileNameCombo,
        processingType: 'ocr_paddleocr',
        pageCount: 2,
        confidenceFrente: result.ocr_confidence?.frente ?? null,
        confidenceReverso: result.ocr_confidence?.reverso ?? null,
        extractionId: result.extraction_id,
        engine: 'paddleocr',
      },
      idUser,
      idModule,
      EstatusEnumBitcora.SUCCESS,
    );

    return {
      status: 'success',
      message: 'INE procesada correctamente',
      processingType: 'ocr_paddleocr',
      pageCount: 2,
      data: {
        id: saved.id,
        nombre: saved.fileName,
        extractedText: result.raw_text ?? '',
        confidence: {
          frente:
            typeof result.ocr_confidence?.frente === 'number'
              ? Math.round(result.ocr_confidence.frente)
              : null,
          reverso:
            typeof result.ocr_confidence?.reverso === 'number'
              ? Math.round(result.ocr_confidence.reverso)
              : null,
        },
        ine: result.data,
        extraction_id: result.extraction_id,
      },
    };
  }
}
