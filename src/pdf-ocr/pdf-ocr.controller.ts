import {
  Controller,
  Post,
  UploadedFile,
  UploadedFiles,
  Body,
  UseInterceptors,
  BadRequestException,
  UseGuards,
  Request,
} from '@nestjs/common';
import {
  FileInterceptor,
  FileFieldsInterceptor,
} from '@nestjs/platform-express';
import * as multer from 'multer';
import { PdfOcrService } from './pdf-ocr.service';
import { UploadIneDto } from './dto/upload-ine.dto';
import { JwtAuthGuard } from 'src/guard/jwt-auth.guard';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiSecurity,
} from '@nestjs/swagger';

/** Id de módulo fijo para bitácora (no expuesto en Swagger). */
const PDF_OCR_ID_MODULE = 16;

@UseGuards(JwtAuthGuard)
@ApiBearerAuth('access-token')
@Controller('pdf-ocr')
export class PdfOcrController {
  constructor(private readonly pdfOcrService: PdfOcrService) {}

  @Post('upload')
  @ApiSecurity('access-token')
  @ApiOperation({
    summary: 'Subir PDF para extracción de texto (nativo u OCR)',
    description:
      'Autoriza antes en Swagger (candado **Authorize**) con el mismo JWT que el resto de la API (esquema **access-token**).',
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    description: 'Solo el archivo PDF (máx. 25 MB). El id de módulo para bitácora es fijo en servidor.',
    schema: {
      type: 'object',
      required: ['file'],
      properties: {
        file: {
          type: 'string',
          format: 'binary',
          description: 'Archivo PDF (máx. 25 MB)',
        },
      },
    },
  })
  @UseInterceptors(
    FileInterceptor('file', {
      storage: multer.memoryStorage(),
      limits: { fileSize: 25 * 1024 * 1024 },
      fileFilter: (req, file, cb) => {
        if (file.mimetype !== 'application/pdf') {
          return cb(
            new Error('Solo se permiten archivos PDF'),
            false,
          );
        }
        cb(null, true);
      },
    }),
  )
  async uploadPdf(
    @UploadedFile() file: Express.Multer.File,
    @Request() req,
  ) {
    const idUser = req.user.userId;

    if (!file) throw new BadRequestException('Archivo PDF requerido');

    return this.pdfOcrService.processPdf(file, idUser, PDF_OCR_ID_MODULE);
  }

  @Post('upload-ine')
  @ApiSecurity('access-token')
  @ApiOperation({
    summary: 'OCR sobre frente y reverso de INE',
    description:
      'Recibe 2 imágenes (JPG/PNG): frente y reverso de una INE mexicana. Devuelve el texto extraído de ambas concatenado.',
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    description:
      'Solo frente y reverso (JPG/PNG). El id de módulo para bitácora es fijo en servidor (16).',
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
        limits: { fileSize: 25 * 1024 * 1024 },
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
    @Body() body: UploadIneDto,
    @Request() req,
  ) {
    const frente = files?.frente?.[0];
    const reverso = files?.reverso?.[0];

    if (!frente) {
      throw new BadRequestException('La imagen "frente" es requerida.');
    }
    if (!reverso) {
      throw new BadRequestException('La imagen "reverso" es requerida.');
    }

    const idUser = req.user.userId;

    return this.pdfOcrService.processImagesIne(
      frente,
      reverso,
      idUser,
      Number(body.idModule ?? '16'),
    );
  }
}
