import {
  BadRequestException,
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
} from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';
import { AxiosError, type AxiosResponse } from 'axios';

export const BANXICO_SERIE_INPC = 'SP1';

const BANXICO_BASE_URL =
  'https://www.banxico.org.mx/SieAPIRest/service/v1/series';

export type BanxicoIncremento = 'PorcAnual' | 'PorcAcumAnual';

export interface BanxicoDatoObservacion {
  fecha: string;
  dato: string;
}

export interface BanxicoSerieBlock {
  idSerie: string;
  titulo?: string;
  datos: BanxicoDatoObservacion[];
  incrementos?: string;
}

export interface BanxicoApiResponse {
  bmx?: {
    series?: BanxicoSerieBlock[];
  };
}

export interface BanxicoDatoCombinado {
  fecha: string;
  indice: string | null;
  porcAnual: string | null;
  porcAcumAnual: string | null;
}

export interface BanxicoConsultaCombinada {
  idSerie: string;
  titulo: string | null;
  fechaInicial: string;
  fechaFinal: string;
  parametros: {
    decimales: 'sinCeros';
    incremento: BanxicoIncremento[];
  };
  datos: BanxicoDatoCombinado[];
}

@Injectable()
export class BanxicoClientService {
  private readonly logger = new Logger(BanxicoClientService.name);
  private readonly token: string;
  private readonly timeoutMs = 30_000;

  constructor(
    private readonly configService: ConfigService,
    private readonly httpService: HttpService,
  ) {
    this.token = this.configService.get<string>('BANXICO_TOKEN', '').trim();
  }

  isConfigured(): boolean {
    return this.token.length > 0;
  }

  /**
   * Consulta Banxico con decimales=sinCeros y los incrementos solicitados.
   * La API no admite dos valores de `incremento` en una sola petición; se combinan llamadas.
   */
  async consultarSerieRango(
    fechaInicial: string,
    fechaFinal: string,
  ): Promise<BanxicoConsultaCombinada> {
    this.assertRangoFechas(fechaInicial, fechaFinal);

    const [indiceRes, porcAnualRes, porcAcumRes] = await Promise.all([
      this.fetchRaw(fechaInicial, fechaFinal),
      this.fetchRaw(fechaInicial, fechaFinal, 'PorcAnual'),
      this.fetchRaw(fechaInicial, fechaFinal, 'PorcAcumAnual'),
    ]);

    const indiceSerie = this.extractSerie(indiceRes);
    const porcAnualSerie = this.extractSerie(porcAnualRes);
    const porcAcumSerie = this.extractSerie(porcAcumRes);

    const porAnualMap = new Map(
      (porcAnualSerie?.datos ?? []).map((d) => [d.fecha, d.dato]),
    );
    const porAcumMap = new Map(
      (porcAcumSerie?.datos ?? []).map((d) => [d.fecha, d.dato]),
    );

    const fechas = new Set<string>([
      ...(indiceSerie?.datos ?? []).map((d) => d.fecha),
      ...porAnualMap.keys(),
      ...porAcumMap.keys(),
    ]);

    const datos: BanxicoDatoCombinado[] = [...fechas]
      .sort((a, b) => this.parseFechaBanxico(a).getTime() - this.parseFechaBanxico(b).getTime())
      .map((fecha) => ({
        fecha,
        indice:
          indiceSerie?.datos.find((d) => d.fecha === fecha)?.dato ?? null,
        porcAnual: porAnualMap.get(fecha) ?? null,
        porcAcumAnual: porAcumMap.get(fecha) ?? null,
      }));

    return {
      idSerie: BANXICO_SERIE_INPC,
      titulo: indiceSerie?.titulo ?? porcAnualSerie?.titulo ?? null,
      fechaInicial,
      fechaFinal,
      parametros: {
        decimales: 'sinCeros',
        incremento: ['PorcAnual', 'PorcAcumAnual'],
      },
      datos,
    };
  }

  private async fetchRaw(
    fechaInicial: string,
    fechaFinal: string,
    incremento?: BanxicoIncremento,
  ): Promise<BanxicoApiResponse> {
    this.ensureConfigured();
    const url = `${BANXICO_BASE_URL}/${BANXICO_SERIE_INPC}/datos/${fechaInicial}/${fechaFinal}`;
    const params: Record<string, string> = { decimales: 'sinCeros' };
    if (incremento) {
      params.incremento = incremento;
    }

    try {
      const response = await firstValueFrom<AxiosResponse<BanxicoApiResponse>>(
        this.httpService.get<BanxicoApiResponse>(url, {
          headers: {
            Accept: 'application/json',
            'Bmx-Token': this.token,
          },
          params,
          timeout: this.timeoutMs,
        }),
      );
      return response.data ?? {};
    } catch (error: unknown) {
      this.logger.error(
        `Banxico error${incremento ? ` (${incremento})` : ''}: ${
          error instanceof Error ? error.message : error
        }`,
      );
      if (error instanceof AxiosError) {
        if (error.code === 'ECONNABORTED') {
          throw new HttpException(
            'Timeout al consultar Banxico',
            HttpStatus.GATEWAY_TIMEOUT,
          );
        }
        const status = error.response?.status;
        const detail =
          typeof error.response?.data === 'object'
            ? JSON.stringify(error.response.data)
            : String(error.response?.data ?? error.message);
        throw new HttpException(
          `Error en Banxico: ${detail}`,
          status && status >= 400 && status < 600
            ? status
            : HttpStatus.BAD_GATEWAY,
        );
      }
      throw new HttpException(
        'Error al comunicarse con Banxico',
        HttpStatus.BAD_GATEWAY,
      );
    }
  }

  private extractSerie(
    payload: BanxicoApiResponse,
  ): BanxicoSerieBlock | undefined {
    return payload.bmx?.series?.[0];
  }

  private ensureConfigured(): void {
    if (!this.isConfigured()) {
      throw new HttpException(
        'BANXICO_TOKEN debe estar configurado en .env',
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  private assertRangoFechas(fechaInicial: string, fechaFinal: string): void {
    const ini = new Date(`${fechaInicial}T00:00:00`);
    const fin = new Date(`${fechaFinal}T00:00:00`);
    if (Number.isNaN(ini.getTime()) || Number.isNaN(fin.getTime())) {
      throw new BadRequestException('Fechas inválidas');
    }
    if (ini > fin) {
      throw new BadRequestException(
        'fechaInicial no puede ser posterior a fechaFinal',
      );
    }
  }

  /** Fecha Banxico: dd/MM/yyyy (primer día del mes en SP1). */
  parseFechaBanxico(fecha: string): Date {
    const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(fecha.trim());
    if (!match) {
      throw new BadRequestException(`Formato de fecha Banxico inválido: ${fecha}`);
    }
    const [, day, month, year] = match;
    return new Date(Number(year), Number(month) - 1, Number(day));
  }

}
