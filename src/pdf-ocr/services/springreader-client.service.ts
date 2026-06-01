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
export type TipoContribuyente = 'PERSONA_FISICA' | 'PERSONA_MORAL';

export interface ActividadEconomica {
  orden: number;
  descripcion: string;
  porcentaje: number;
  fechaInicio: string | null;
  fechaFin: string | null;
}

export interface RegimenFiscal {
  descripcion: string;
  fechaInicio: string | null;
  fechaFin: string | null;
}

export interface ObligacionFiscal {
  descripcion: string;
  vencimiento: string | null;
  fechaInicio: string | null;
  fechaFin: string | null;
}

export interface ConstanciaFiscalData {
  tipoContribuyente: TipoContribuyente;
  rfc: string | null;
  idCIF: string | null;
  curp: string | null;
  nombre: string | null;
  apellidoPaterno: string | null;
  apellidoMaterno: string | null;
  razonSocial: string | null;
  regimenCapital: string | null;
  nombreComercial: string | null;
  fechaInicioOperaciones: string | null;
  estatusContribuyente: string | null;
  fechaUltimoCambioEstado: string | null;
  codigoPostal: string | null;
  tipoVialidad: string | null;
  nombreVialidad: string | null;
  numeroExterior: string | null;
  numeroInterior: string | null;
  colonia: string | null;
  localidad: string | null;
  municipio: string | null;
  entidadFederativa: string | null;
  entreCalle: string | null;
  yCalle: string | null;
  actividadesEconomicas: ActividadEconomica[];
  regimenesFiscales: RegimenFiscal[];
  obligaciones: ObligacionFiscal[];
}

/** Respuesta de POST /constancia-fiscal/extract (SpringReader). */
export interface SpringReaderConstanciaFiscalResponse {
  status?: string;
  message?: string;
  processingType: string;
  pageCount: number;
  data: {
    constancia: ConstanciaFiscalData;
  };
}

/** Datos INE devueltos por SpringReader POST /ine/extract. */
export interface SpringReaderIneExtractData {
  nombre?: string | null;
  apellidoPaterno?: string | null;
  apellidoMaterno?: string | null;
  curp?: string | null;
  claveElector?: string | null;
  fechaNacimiento?: string | null;
  sexo?: string | null;
  domicilio?: string | null;
  colonia?: string | null;
  codigoPostal?: string | null;
  municipio?: string | null;
  estado?: string | null;
  seccion?: string | null;
  vigencia?: string | null;
}

export interface SpringReaderIneExtractResponse {
  extraction_id: string;
  data: SpringReaderIneExtractData;
  ocr_confidence: {
    frente: number;
    reverso: number;
  };
  raw_text: string;
}

@Injectable()
export class SpringReaderClientService {
  private readonly logger = new Logger(SpringReaderClientService.name);
  private readonly baseUrl: string;
  private readonly constanciaPath: string;
  private readonly inePath: string;
  private readonly serviceKey: string;
  private readonly timeoutMs: number;

  constructor(
    private readonly configService: ConfigService,
    private readonly httpService: HttpService,
  ) {
    this.baseUrl = this.configService
      .get<string>('SPRINGREADER_URL', 'https://spcode.ddns.net/api-springreader')
      .replace(/\/$/, '');
    this.constanciaPath = this.normalizePath(
      this.configService.get<string>(
        'SPRINGREADER_CONSTANCIA_PATH',
        '/constancia-fiscal/extract',
      ),
    );
    this.inePath = this.normalizePath(
      this.configService.get<string>('SPRINGREADER_INE_PATH', '/ine/extract'),
    );
    this.serviceKey = this.configService.get<string>(
      'SPRINGREADER_SERVICE_KEY',
      '',
    );
    this.timeoutMs = Number(
      this.configService.get<string | number>('SPRINGREADER_TIMEOUT', 120000),
    );
  }

  /** Une base URL + ruta del .env (ruta debe empezar con /). */
  private buildUrl(path: string): string {
    return `${this.baseUrl}${path}`;
  }

  private normalizePath(path: string): string {
    const trimmed = path.trim();
    if (!trimmed) {
      throw new Error('La ruta de SpringReader no puede estar vacía');
    }
    return trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
  }

  isConfigured(): boolean {
    return this.baseUrl.trim().length > 0 && this.serviceKey.trim().length > 0;
  }

  getBaseUrl(): string {
    return this.baseUrl;
  }

  async extractConstanciaFiscal(
    file: Express.Multer.File,
  ): Promise<SpringReaderConstanciaFiscalResponse> {
    this.ensureConfigured();
    const url = this.buildUrl(this.constanciaPath);
    const form = new FormData();
    form.append('file', file.buffer, {
      filename: file.originalname || 'constancia.pdf',
      contentType: file.mimetype || 'application/pdf',
    });

    return this.postMultipart<SpringReaderConstanciaFiscalResponse>(url, form);
  }

  async extractIne(
    frente: Express.Multer.File,
    reverso?: Express.Multer.File,
  ): Promise<SpringReaderIneExtractResponse> {
    this.ensureConfigured();
    const url = this.buildUrl(this.inePath);
    const form = new FormData();
    form.append('frente', frente.buffer, {
      filename: frente.originalname || 'frente.jpg',
      contentType: frente.mimetype || 'image/jpeg',
    });
    if (reverso?.buffer) {
      form.append('reverso', reverso.buffer, {
        filename: reverso.originalname || 'reverso.jpg',
        contentType: reverso.mimetype || 'image/jpeg',
      });
    }

    return this.postMultipart<SpringReaderIneExtractResponse>(url, form);
  }

  private ensureConfigured(): void {
    if (!this.isConfigured()) {
      throw new HttpException(
        'SPRINGREADER_URL y SPRINGREADER_SERVICE_KEY deben estar configurados',
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  private async postMultipart<T>(url: string, form: FormData): Promise<T> {
    try {
      const response = await firstValueFrom<AxiosResponse<T>>(
        this.httpService.post<T>(url, form, {
          headers: {
            ...form.getHeaders(),
            'X-Service-Key': this.serviceKey,
            accept: 'application/json',
          },
          timeout: this.timeoutMs,
          maxBodyLength: Infinity,
          maxContentLength: Infinity,
        }),
      );
      return response.data;
    } catch (error: unknown) {
      this.logger.error(
        `SpringReader error: ${error instanceof Error ? error.message : error}`,
      );
      if (error instanceof AxiosError) {
        if (error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND') {
          throw new HttpException(
            `SpringReader no disponible en ${this.baseUrl}`,
            HttpStatus.SERVICE_UNAVAILABLE,
          );
        }
        if (error.code === 'ECONNABORTED') {
          throw new HttpException(
            'Timeout al consultar SpringReader',
            HttpStatus.GATEWAY_TIMEOUT,
          );
        }
        const status = error.response?.status;
        const detail =
          typeof error.response?.data === 'object'
            ? JSON.stringify(error.response.data)
            : String(error.response?.data ?? error.message);
        if (status === 401 || status === 403) {
          throw new HttpException(
            'SpringReader rechazó la clave X-Service-Key',
            HttpStatus.BAD_GATEWAY,
          );
        }
        throw new HttpException(
          `Error en SpringReader: ${detail}`,
          status && status >= 400 && status < 600
            ? status
            : HttpStatus.BAD_GATEWAY,
        );
      }
      throw new HttpException(
        'Error al comunicarse con SpringReader',
        HttpStatus.BAD_GATEWAY,
      );
    }
  }
}
