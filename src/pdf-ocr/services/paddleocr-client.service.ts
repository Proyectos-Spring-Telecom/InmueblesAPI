import {
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
} from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';
import FormData from 'form-data';
import { AxiosError, type AxiosResponse } from 'axios';
import type { IneData } from '../interfaces/ine-data.interface';

export interface PaddleOcrIneResponse {
  success: boolean;
  extraction_id: string;
  data: IneData;
  ocr_confidence: { frente: number; reverso: number };
  raw_text: string;
  processing_time_ms: number;
  upload_method: string;
}

@Injectable()
export class PaddleOcrClientService {
  private readonly logger = new Logger('PaddleOcrClient');
  private readonly baseUrl: string;
  private readonly timeoutMs: number;

  constructor(
    private readonly configService: ConfigService,
    private readonly httpService: HttpService,
  ) {
    this.baseUrl = this.configService.get<string>('PADDLEOCR_SERVICE_URL', '');
    this.timeoutMs = Number(
      this.configService.get<string>('PADDLEOCR_TIMEOUT_MS', '60000'),
    );
  }

  isConfigured(): boolean {
    return this.baseUrl.trim().length > 0;
  }

  getBaseUrl(): string {
    return this.baseUrl;
  }

  async extractIne(
    frente: Buffer,
    reverso: Buffer,
    fileNames: { frente: string; reverso: string },
  ): Promise<PaddleOcrIneResponse> {
    if (!this.isConfigured()) {
      throw new HttpException(
        'PADDLEOCR_SERVICE_URL no está configurado',
        HttpStatus.BAD_REQUEST,
      );
    }

    const url = `${this.baseUrl.replace(/\/$/, '')}/ine/extract`;
    const form = new FormData();
    form.append('frente', frente, { filename: fileNames.frente });
    form.append('reverso', reverso, { filename: fileNames.reverso });

    try {
      const response = await firstValueFrom<AxiosResponse<PaddleOcrIneResponse>>(
        this.httpService.post<PaddleOcrIneResponse>(url, form, {
          headers: form.getHeaders(),
          timeout: this.timeoutMs,
          maxBodyLength: Infinity,
          maxContentLength: Infinity,
        }),
      );

      const body = response.data;
      if (!body || body.success !== true) {
        throw new HttpException(
          'Error en microservicio OCR',
          HttpStatus.BAD_GATEWAY,
        );
      }

      return body;
    } catch (error: unknown) {
      if (error instanceof HttpException) throw error;

      if (error instanceof AxiosError) {
        if (error.code === 'ECONNABORTED') {
          throw new HttpException(
            'Tiempo agotado al consultar microservicio OCR',
            HttpStatus.GATEWAY_TIMEOUT,
          );
        }
        if (error.code === 'ECONNREFUSED') {
          throw new HttpException(
            `Servicio PaddleOCR no disponible. Verifica que esté corriendo en ${this.baseUrl}`,
            HttpStatus.SERVICE_UNAVAILABLE,
          );
        }
        if (typeof error.response?.status === 'number') {
          const message =
            error.response.data &&
            typeof error.response.data === 'object' &&
            'message' in error.response.data
              ? String(error.response.data.message)
              : 'Error en microservicio OCR';
          throw new HttpException(message, HttpStatus.BAD_GATEWAY);
        }
      }

      this.logger.error(
        `extractIne falló: ${error instanceof Error ? error.message : String(error)}`,
        error instanceof Error ? error.stack : undefined,
      );
      throw new HttpException(
        'Error al consultar microservicio OCR',
        HttpStatus.BAD_GATEWAY,
      );
    }
  }
}
