import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import {
  getDocument,
  GlobalWorkerOptions,
} from 'pdfjs-dist';
import * as path from 'path';
import { pathToFileURL } from 'url';
import type { TextContent } from 'pdfjs-dist/types/src/display/api';
import { ProcessingType } from 'src/entities/DocumentOcr';
import type { OcrResult } from '../interfaces/ocr-result.interface';

// Fix pdfjs-dist v4 en Node:
// 1) workerSrc no acepta string vacío.
// 2) En Windows, ESM exige file:// URL, no rutas C:\ o A:\
const pdfjsWorkerPath = path.join(
  path.dirname(require.resolve('pdfjs-dist/package.json')),
  'legacy',
  'build',
  'pdf.worker.mjs',
);
GlobalWorkerOptions.workerSrc = pathToFileURL(pdfjsWorkerPath).href;

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
export class PdfNativeExtractorService {
  private readonly logger = new Logger(PdfNativeExtractorService.name);

  async extract(buffer: Buffer): Promise<OcrResult> {
    const bufferLen = buffer?.length ?? 0;
    try {
      this.logger.log(
        `extract NATIVE: inicio buffer=${bufferLen}B`,
      );
      const loadingTask = getDocument({
        data: new Uint8Array(buffer),
        useWorkerFetch: false,
        verbosity: 0,
      });
      const pdf = await loadingTask.promise;
      const pageCount = pdf.numPages;
      const parts: string[] = [];
      for (let i = 1; i <= pageCount; i++) {
        const page = await pdf.getPage(i);
        const textContent = await page.getTextContent();
        const pageText = textFromContent(textContent);
        parts.push(pageText);
        this.logger.debug(
          `  página ${i}/${pageCount}: texto_len=${pageText.length}`,
        );
      }
      await pdf.cleanup();
      const text = parts.join('\n\n');
      this.logger.log(
        `extract NATIVE: fin páginas=${pageCount} texto_total_len=${text.length}`,
      );
      return {
        text,
        processingType: ProcessingType.NATIVE,
        pageCount,
      };
    } catch (err) {
      const name = err instanceof Error ? err.name : 'Error';
      const detail = err instanceof Error ? err.message : String(err);
      this.logger.error(
        `extract NATIVE falló (buffer=${bufferLen}B): [${name}] ${detail}`,
        err instanceof Error ? err.stack : undefined,
      );
      throw new BadRequestException('PDF inválido o corrupto');
    }
  }
}
