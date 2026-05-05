import {
  BadRequestException,
  HttpException,
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
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

export type PdfOcrProcessResponse = ApiCrudResponse & {
  processingType: ProcessingType;
  pageCount: number;
};

export type PdfOcrIneProcessResponse = PdfOcrProcessResponse & {
  data: {
    id: number;
    nombre: string;
    extractedText: string;
    confidence: { frente: number | null; reverso: number | null };
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
            frente: resFrente.confidence,
            reverso: resReverso.confidence,
          },
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
}
