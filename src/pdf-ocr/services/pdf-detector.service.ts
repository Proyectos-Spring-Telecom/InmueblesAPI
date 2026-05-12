import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import {
  getDocument,
  GlobalWorkerOptions,
} from 'pdfjs-dist';
import type { TextContent } from 'pdfjs-dist/types/src/display/api';

// pdfjs-dist v3 legacy build es CJS puro. En Node.js no se necesita
// un worker separado. workerSrc = '' activa el fake worker interno
// que corre en el mismo hilo, sin archivos externos.
// Funciona en Windows, Linux y Docker sin cambios.
GlobalWorkerOptions.workerSrc = '';

function textFromContent(textContent: TextContent): string {
  let out = '';
  for (const item of textContent.items) {
    if ('str' in item && typeof item.str === 'string') {
      out += item.str;
    }
  }
  return out;
}

@Injectable()
export class PdfDetectorService {
  private readonly logger = new Logger(PdfDetectorService.name);

  async hasNativeText(
    buffer: Buffer,
  ): Promise<{ isNative: boolean; pageCount: number }> {
    const bufferLen = buffer?.length ?? 0;
    try {
      this.logger.debug(
        `hasNativeText: abriendo PDF buffer=${bufferLen}B (pdf.js legacy, worker desactivado)`,
      );
      const loadingTask = getDocument({
        data: new Uint8Array(buffer),
        useWorkerFetch: false,
        verbosity: 0,
      });
      const pdf = await loadingTask.promise;
      const pageCount = pdf.numPages;
      const pagesToScan = Math.min(3, pageCount);
      let totalChars = 0;
      for (let i = 1; i <= pagesToScan; i++) {
        const page = await pdf.getPage(i);
        const textContent = await page.getTextContent();
        const raw = textFromContent(textContent);
        const nonWs = raw.replace(/\s/g, '').length;
        totalChars += nonWs;
        this.logger.debug(
          `  página ${i}/${pagesToScan}: chars_sin_espacio=${nonWs} (acumulado=${totalChars})`,
        );
      }
      await pdf.cleanup();
      const isNative = totalChars > 50;
      this.logger.log(
        `hasNativeText: páginas_totales=${pageCount} escaneadas=${pagesToScan} chars_sin_ws=${totalChars} umbral=50 → isNative=${isNative}`,
      );
      return { isNative, pageCount };
    } catch (err) {
      const name = err instanceof Error ? err.name : 'Error';
      const detail = err instanceof Error ? err.message : String(err);
      this.logger.error(
        `hasNativeText falló (buffer=${bufferLen}B): [${name}] ${detail}`,
        err instanceof Error ? err.stack : undefined,
      );
      throw new BadRequestException('PDF inválido o corrupto');
    }
  }
}
