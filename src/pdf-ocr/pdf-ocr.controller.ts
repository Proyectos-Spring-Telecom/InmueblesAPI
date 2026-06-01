import {
  Controller,
  Post,
  UploadedFile,
  UploadedFiles,
  UseInterceptors,
  BadRequestException,
  UseGuards,
  Request,
  HttpException,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import {
  FileInterceptor,
  FileFieldsInterceptor,
} from '@nestjs/platform-express';
import * as multer from 'multer';
import { JwtAuthGuard } from 'src/guard/jwt-auth.guard';
import { BitacoraService } from 'src/bitacora/bitacora.service';
import { EstatusEnumBitcora } from 'src/common/ApiResponse';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiSecurity,
} from '@nestjs/swagger';
import { SpringReaderClientService } from './services/springreader-client.service';

const PDF_OCR_ID_MODULE = 16;
const MULTIPART_LIMIT = 25 * 1024 * 1024;

@UseGuards(JwtAuthGuard)
@ApiBearerAuth('access-token')
@Controller('pdf-ocr')
export class PdfOcrController {
  private readonly logger = new Logger(PdfOcrController.name);

  constructor(
    private readonly springReader: SpringReaderClientService,
    private readonly bitacoraLogger: BitacoraService,
  ) {}

  @Post('constancia-fiscal')
  @ApiSecurity('access-token')
  @ApiOperation({
    summary:
      'Extraer datos estructurados de una Constancia de Situación Fiscal (SAT)',
    description:
      'Proxy hacia SpringReader (rutas en .env). No se persiste en base de datos.',
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    description: 'PDF de la Constancia de Situación Fiscal (máx. 25 MB)',
    schema: {
      type: 'object',
      required: ['file'],
      properties: {
        file: {
          type: 'string',
          format: 'binary',
          description: 'PDF Constancia de Situación Fiscal',
        },
      },
    },
  })
  @UseInterceptors(
    FileInterceptor('file', {
      storage: multer.memoryStorage(),
      limits: { fileSize: MULTIPART_LIMIT },
      fileFilter: (_req, file, cb) => {
        if (file.mimetype !== 'application/pdf') {
          return cb(new Error('Solo se permiten archivos PDF'), false);
        }
        cb(null, true);
      },
    }),
  )
  async uploadConstanciaFiscal(
    @UploadedFile() file: Express.Multer.File,
    @Request() req: { user: { userId: number } },
  ) {
    const idUser = req.user.userId;

    if (!file) {
      throw new BadRequestException('Archivo PDF de constancia requerido');
    }

    try {
      this.validatePdfFile(file);

      const remote = await this.springReader.extractConstanciaFiscal(file);

      await this.bitacoraLogger.logToBitacora(
        'PdfOcr',
        `Constancia fiscal (SpringReader): ${file.originalname}`,
        'CREATE',
        {
          fileName: file.originalname,
          processingType: remote.processingType,
          pageCount: remote.pageCount,
          rfc: remote.data?.constancia?.rfc ?? null,
        },
        idUser,
        PDF_OCR_ID_MODULE,
        EstatusEnumBitcora.SUCCESS,
      );

      return {
        status: remote.status ?? 'success',
        message:
          remote.message ?? 'Constancia fiscal procesada correctamente',
        processingType: remote.processingType,
        pageCount: remote.pageCount,
        data: {
          nombre: file.originalname,
          constancia: remote.data.constancia,
        },
      };
    } catch (error: unknown) {
      await this.logError(
        error,
        `Error constancia fiscal: ${file.originalname}`,
        idUser,
        file.originalname,
      );
      if (error instanceof HttpException) throw error;
      throw new InternalServerErrorException(
        'Error procesando constancia fiscal',
      );
    }
  }

  @Post('upload-ine')
  @ApiSecurity('access-token')
  @ApiOperation({
    summary: 'OCR sobre frente y reverso de INE',
    description:
      'Proxy hacia SpringReader (rutas en .env). Devuelve la respuesta del microservicio.',
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    description: 'Frente y reverso (JPG/PNG). Reverso opcional en SpringReader.',
    schema: {
      type: 'object',
      required: ['frente', 'reverso'],
      properties: {
        frente: {
          type: 'string',
          format: 'binary',
          description: 'Imagen del frente de la INE (JPG o PNG)',
        },
        reverso: {
          type: 'string',
          format: 'binary',
          description: 'Imagen del reverso de la INE (JPG o PNG)',
        },
      },
    },
  })
  @UseInterceptors(
    FileFieldsInterceptor(
      [
        { name: 'frente', maxCount: 1 },
        { name: 'reverso', maxCount: 1 },
      ],
      {
        storage: multer.memoryStorage(),
        limits: { fileSize: MULTIPART_LIMIT },
        fileFilter: (_req, file, cb) => {
          const allowed = ['image/jpeg', 'image/jpg', 'image/png'];
          if (!allowed.includes(file.mimetype)) {
            return cb(
              new BadRequestException(
                `Formato no permitido (${file.mimetype}). Solo JPG/PNG.`,
              ),
              false,
            );
          }
          cb(null, true);
        },
      },
    ),
  )
  async uploadIne(
    @UploadedFiles()
    files: { frente?: Express.Multer.File[]; reverso?: Express.Multer.File[] },
    @Request() req: { user: { userId: number } },
  ) {
    const frente = files?.frente?.[0];
    const reverso = files?.reverso?.[0];
    const idUser = req.user.userId;

    if (!frente) {
      throw new BadRequestException('La imagen "frente" es requerida.');
    }
    if (!reverso) {
      throw new BadRequestException('La imagen "reverso" es requerida.');
    }

    const fileNameCombo = `${frente.originalname}+${reverso.originalname}`;

    try {
      this.validateImageFile(frente, 'frente');
      this.validateImageFile(reverso, 'reverso');

      const remote = await this.springReader.extractIne(frente, reverso);

      await this.bitacoraLogger.logToBitacora(
        'PdfOcr',
        `INE (SpringReader): ${fileNameCombo}`,
        'CREATE',
        {
          fileName: fileNameCombo,
          extractionId: remote.extraction_id,
          curp: remote.data?.curp ?? null,
        },
        idUser,
        PDF_OCR_ID_MODULE,
        EstatusEnumBitcora.SUCCESS,
      );

      return {
        status: 'success',
        message: 'INE procesada correctamente',
        processingType: 'springreader',
        pageCount: 2,
        data: {
          nombre: fileNameCombo,
          extraction_id: remote.extraction_id,
          ine: remote.data,
          ocr_confidence: remote.ocr_confidence,
          raw_text: remote.raw_text,
        },
      };
    } catch (error: unknown) {
      await this.logError(error, `Error INE: ${fileNameCombo}`, idUser, fileNameCombo);
      if (error instanceof HttpException) throw error;
      throw new InternalServerErrorException('Error procesando imágenes de INE');
    }
  }

  private validatePdfFile(file: Express.Multer.File): void {
    if (file.mimetype !== 'application/pdf') {
      throw new BadRequestException('Se requiere un archivo PDF válido');
    }
    this.validateFileSize(file);
    if (!file.buffer?.length) {
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
  }

  private validateImageFile(file: Express.Multer.File, label: string): void {
    const allowed = ['image/jpeg', 'image/jpg', 'image/png'];
    if (!allowed.includes(file.mimetype)) {
      throw new BadRequestException(
        `${label}: formato no permitido (${file.mimetype}). Solo JPG/PNG.`,
      );
    }
    this.validateFileSize(file);
    if (!file.buffer?.length) {
      throw new BadRequestException(`Contenido de imagen "${label}" inválido`);
    }
  }

  private validateFileSize(file: Express.Multer.File): void {
    const rawMax = Number(process.env.UPLOAD_MAX_SIZE);
    const maxSize =
      Number.isFinite(rawMax) && rawMax > 0 ? rawMax : 10 * 1024 * 1024;
    if (file.size >= maxSize) {
      throw new BadRequestException('Archivo demasiado grande');
    }
  }

  private async logError(
    error: unknown,
    message: string,
    idUser: number,
    fileName?: string,
  ): Promise<void> {
    const errMsg = error instanceof Error ? error.message : 'Error desconocido';
    if (error instanceof HttpException) {
      this.logger.warn(`${message} → ${errMsg}`);
    } else {
      this.logger.error(message, error instanceof Error ? error.stack : undefined);
    }
    await this.bitacoraLogger.logToBitacora(
      'PdfOcr',
      message,
      'CREATE',
      { fileName: fileName ?? null },
      idUser,
      PDF_OCR_ID_MODULE,
      EstatusEnumBitcora.ERROR,
      errMsg,
    );
  }
}
