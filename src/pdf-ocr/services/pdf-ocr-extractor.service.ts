/**
 * Extracción OCR vía pdfjs-dist + canvas + sharp + tesseract.js.
 *
 * Esta versión NO requiere binarios del sistema operativo (GraphicsMagick,
 * Ghostscript). Funciona en Windows, Ubuntu y Docker sin instalación adicional.
 *
 * Flujo:
 *   1. pdfjs-dist abre el PDF y rasteriza cada página a un canvas en memoria.
 *   2. canvas exporta a PNG buffer (sin tocar disco).
 *   3. sharp preprocesa la imagen (escala de grises + normalización + threshold).
 *   4. tesseract.js extrae el texto con un worker singleton.
 */
import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
  InternalServerErrorException,
} from '@nestjs/common';
import { createCanvas } from 'canvas';
import sharp from 'sharp';
import Tesseract from 'tesseract.js';
import {
  getDocument,
  GlobalWorkerOptions,
} from 'pdfjs-dist';
import { ProcessingType } from 'src/entities/DocumentOcr';
import type { OcrResult } from '../interfaces/ocr-result.interface';

// pdfjs-dist v3 legacy build es CJS puro. En Node.js no se necesita
// un worker separado. workerSrc = '' activa el fake worker interno
// que corre en el mismo hilo, sin archivos externos.
// Funciona en Windows, Linux y Docker sin cambios.
GlobalWorkerOptions.workerSrc = '';

type TesseractWorker = Awaited<ReturnType<typeof Tesseract.createWorker>>;

// Escala de renderizado: 2.5 ≈ 300 DPI para un PDF estándar.
// Más alto = mejor OCR pero más memoria/tiempo. 2.5 es buen balance.
const RENDER_SCALE = 2.5;

@Injectable()
export class PdfOcrExtractorService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PdfOcrExtractorService.name);
  private worker: TesseractWorker | null = null;

  async onModuleInit(): Promise<void> {
    this.logger.log('Inicializando worker Tesseract (spa+eng)...');
    this.worker = await Tesseract.createWorker(['spa', 'eng']);
    this.logger.log('Worker Tesseract listo');
  }

  async onModuleDestroy(): Promise<void> {
    if (this.worker) {
      this.logger.log('Terminando worker Tesseract...');
      await this.worker.terminate();
      this.worker = null;
    }
  }

  async extract(buffer: Buffer, originalName: string): Promise<OcrResult> {
    if (!this.worker) {
      this.logger.error('extract OCR: worker no disponible');
      throw new InternalServerErrorException('Worker OCR no inicializado');
    }

    this.logger.log(
      `extract OCR: inicio archivo="${originalName}" buffer=${buffer.length}B (motor=pdfjs-dist+canvas)`,
    );
    
    try {
      // 1) Cargar PDF con pdfjs-dist (en memoria, sin escribir a disco)
      const loadingTask = getDocument({
        data: new Uint8Array(buffer),
        useWorkerFetch: false,
        verbosity: 0,
      });
      const pdf = await loadingTask.promise;

      const totalPages = pdf.numPages;
      this.logger.log(`PDF abierto: ${totalPages} página(s) detectada(s)`);

      const pageTexts: string[] = [];

      // 2) Rasterizar y procesar cada página
      for (let i = 1; i <= totalPages; i++) {
        const page = await pdf.getPage(i);
        const viewport = page.getViewport({ scale: RENDER_SCALE });

        const canvas = createCanvas(viewport.width, viewport.height);
        const context = canvas.getContext('2d');

        // pdfjs espera un objeto compatible con CanvasRenderingContext2D del navegador.
        // node-canvas lo es prácticamente al 100% para nuestros fines.
        const renderTask = page.render({
          canvasContext: context as unknown as CanvasRenderingContext2D,
          viewport,
        });
        await renderTask.promise;

        const pngBuffer = canvas.toBuffer('image/png');
        this.logger.debug(
          `página ${i}/${totalPages}: rasterizada ${viewport.width}x${viewport.height} → png=${pngBuffer.length}B`,
        );

        // 3) Preprocesar imagen con sharp para mejorar OCR
        const processedBuffer = await sharp(pngBuffer)
          .grayscale()
          .normalize()
          .threshold(180)
          .toBuffer();

        // 4) OCR con Tesseract
        const { data } = await this.worker.recognize(processedBuffer);
        const textLen = data.text?.length ?? 0;
        const confidence =
          typeof data.confidence === 'number' ? data.confidence : 'n/a';
        this.logger.debug(
          `página ${i}/${totalPages}: OCR completado confianza=${confidence} longitud_texto=${textLen}`,
        );

        pageTexts.push(data.text ?? '');
      }

      await pdf.cleanup();

      const text = pageTexts.join('\n\n');
      this.logger.log(
        `extract OCR: fin archivo="${originalName}" páginas=${totalPages} longitud_total=${text.length}`,
      );

      return {
        text,
        processingType: ProcessingType.OCR,
        pageCount: totalPages,
      };
    } catch (err) {
      const detail = err instanceof Error ? err.message : String(err);
      const stack = err instanceof Error ? err.stack : 'no stack';
      this.logger.error(
        `extract OCR falló archivo="${originalName}": ${detail}`,
        stack,
      );
      throw err;
    }
  }

  /**
   * OCR sobre una imagen (JPG o PNG) ya cargada en buffer.
   * Reutiliza el worker Tesseract singleton.
   *
   * Pre-procesa la imagen con sharp:
   *  - rotate(): respeta orientación EXIF (típica de fotos de celular).
   *  - resize: si la imagen es muy chica, escala a un mínimo razonable para OCR.
   *  - grayscale + normalize (sin threshold fuerte: mejor para fotos de INE).
   */
  async extractFromImage(
    buffer: Buffer,
    label: string,
  ): Promise<{ text: string; confidence: number | null }> {
    if (!this.worker) {
      this.logger.error(`extractFromImage[${label}]: worker no disponible`);
      throw new InternalServerErrorException('Worker OCR no inicializado');
    }

    this.logger.log(
      `extractFromImage[${label}]: inicio buffer=${buffer.length}B`,
    );

    try {
      const meta = await sharp(buffer).metadata();
      this.logger.debug(
        `extractFromImage[${label}]: meta width=${meta.width} height=${meta.height} format=${meta.format} orientation=${meta.orientation ?? 'n/a'}`,
      );

      let pipeline = sharp(buffer).rotate();

      const maxSide = Math.max(meta.width ?? 0, meta.height ?? 0);
      if (maxSide > 0 && maxSide < 1000) {
        const scale = Math.ceil(1000 / maxSide);
        pipeline = pipeline.resize({
          width: (meta.width ?? 1) * scale,
          height: (meta.height ?? 1) * scale,
          fit: 'fill',
        });
        this.logger.debug(
          `extractFromImage[${label}]: imagen pequeña (${maxSide}px) → escalada x${scale}`,
        );
      }

      const processedBuffer = await pipeline
        .grayscale()
        .normalize()
        .toBuffer();

      const { data } = await this.worker.recognize(processedBuffer);
      const text = data.text ?? '';
      const confidence =
        typeof data.confidence === 'number' ? data.confidence : null;

      this.logger.log(
        `extractFromImage[${label}]: fin longitud_texto=${text.length} confianza=${confidence ?? 'n/a'}`,
      );

      return { text, confidence };
    } catch (err) {
      const detail = err instanceof Error ? err.message : String(err);
      const stack = err instanceof Error ? err.stack : 'no stack';
      this.logger.error(
        `extractFromImage[${label}] falló: ${detail}`,
        stack,
      );
      throw err;
    }
  }
}
