import {
  Injectable,
  Logger,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';
import { AxiosError } from 'axios';
import { BitacoraService } from 'src/bitacora/bitacora.service';
import { EstatusEnumBitcora } from 'src/common/ApiResponse';

/** Cuerpo JSON esperado de SpringAgent POST /chat (campos opcionales por tolerancia). */
interface SpringAgentChatBody {
  response?: string;
  conversation_id?: string;
  tools_used?: unknown;
  processing_time_ms?: number;
}

/** Cuerpo JSON esperado de SpringAgent GET /health. */
interface SpringAgentHealthBody {
  ollama?: string;
  paddleocr?: string;
  service?: string;
  version?: string;
}

@Injectable()
export class ChatService {
  private readonly logger = new Logger(ChatService.name);
  private readonly springAgentUrl: string;
  private readonly timeoutMs: number;
  private readonly serviceKey: string;

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
    private readonly bitacoraLogger: BitacoraService,
  ) {
    this.springAgentUrl = this.configService.get<string>(
      'SPRINGAGENT_URL',
      'http://localhost:8001',
    );
    const rawTimeout = this.configService.get<string | number>(
      'SPRINGAGENT_TIMEOUT',
      120000,
    );
    this.timeoutMs = Number(rawTimeout);
    this.serviceKey = this.configService.get<string>(
      'SPRINGAGENT_SERVICE_KEY',
      '',
    );
  }

  async checkHealth() {
    const url = `${this.springAgentUrl.replace(/\/$/, '')}/health`;

    this.logger.log(`Health check a SpringAgent: ${url}`);

    try {
      const response = await firstValueFrom(
        this.httpService.get<SpringAgentHealthBody>(url, {
          timeout: 10000,
          headers: {
            'X-Service-Key': this.serviceKey,
          },
        }),
      );

      const data = response.data ?? {};

      this.logger.log(
        `SpringAgent health: ollama=${data.ollama}, paddleocr=${data.paddleocr || 'N/A'}`,
      );

      return {
        status: 'success',
        message: 'SpringAgent disponible',
        data: {
          springAgent: 'connected',
          springAgentUrl: this.springAgentUrl,
          ollama: data.ollama || 'unknown',
          paddleocr: data.paddleocr || 'unknown',
          serviceName: data.service || 'SpringAgent',
          version: data.version || 'unknown',
        },
      };
    } catch (error: unknown) {
      const errMsg =
        error instanceof Error ? error.message : 'Error desconocido';

      this.logger.error(`SpringAgent health check falló: ${errMsg}`);

      if (error instanceof AxiosError) {
        if (error.code === 'ECONNREFUSED') {
          throw new HttpException(
            {
              status: 'error',
              message:
                'SpringAgent no disponible. El servicio no está corriendo.',
              data: {
                springAgent: 'disconnected',
                springAgentUrl: this.springAgentUrl,
                error: 'ECONNREFUSED',
              },
            },
            HttpStatus.SERVICE_UNAVAILABLE,
          );
        }

        if (error.response?.status === 401) {
          throw new HttpException(
            {
              status: 'error',
              message:
                'SpringAgent rechazó la conexión. X-Service-Key inválida.',
              data: {
                springAgent: 'unauthorized',
                springAgentUrl: this.springAgentUrl,
                error: 'UNAUTHORIZED',
              },
            },
            HttpStatus.SERVICE_UNAVAILABLE,
          );
        }
      }

      throw new HttpException(
        {
          status: 'error',
          message: `Error verificando SpringAgent: ${errMsg}`,
          data: {
            springAgent: 'error',
            springAgentUrl: this.springAgentUrl,
          },
        },
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }
  }

  async sendMessage(
    message: string,
    conversationId: string | undefined,
    userId: number,
    clienteId: number | null,
    rol: number,
  ): Promise<{
    status: string;
    message: string;
    data: {
      response: string | null;
      conversationId: string | null;
      toolsUsed: unknown;
      processingTimeMs: number | null;
    };
  }> {
    const url = `${this.springAgentUrl.replace(/\/$/, '')}/chat`;
    console.log('url', url);
    const preview =
      message.length > 100 ? `${message.substring(0, 100)}...` : message;

    this.logger.log(
      `Chat request: userId=${userId} clienteId=${clienteId ?? 'null'} rol=${rol} message="${preview}"`,
    );

    try {
      const response = await firstValueFrom(
        this.httpService.post<SpringAgentChatBody>(
          url,
          {
            message,
            conversation_id: conversationId ?? undefined,
            user_id: userId,
            client_id: clienteId,
          },
          {
            timeout: this.timeoutMs,
            headers: {
              'Content-Type': 'application/json',
              'X-Service-Key': this.serviceKey,
            },
          },
        ),
      );

      const data: SpringAgentChatBody = response.data ?? {};

      /* await this.bitacoraLogger.logToBitacora(
        'Chat',
        `Consulta IA: "${preview}"`,
        'READ',
        {
          conversationId: data.conversation_id ?? null,
          toolsUsed: data.tools_used ?? null,
          processingTimeMs: data.processing_time_ms ?? null,
          rol,
        },
        userId,
        17,
        EstatusEnumBitcora.SUCCESS,
      ); */

      this.logger.log(
        `Chat response: userId=${userId} tools=${JSON.stringify(data.tools_used ?? [])} time=${data.processing_time_ms ?? 'n/a'}ms`,
      );

      return {
        status: 'success',
        message: 'Respuesta del agente',
        data: {
          response: data.response ?? null,
          conversationId: data.conversation_id ?? null,
          toolsUsed: data.tools_used ?? null,
          processingTimeMs:
            typeof data.processing_time_ms === 'number'
              ? data.processing_time_ms
              : null,
        },
      };
    } catch (error: unknown) {
      const errMsg =
        error instanceof Error ? error.message : 'Error desconocido';

      /* await this.bitacoraLogger.logToBitacora(
        'Chat',
        `Error consulta IA: "${preview}"`,
        'READ',
        { error: errMsg, rol },
        userId,
        0,
        EstatusEnumBitcora.ERROR,
        errMsg,
      ); */

      if (error instanceof AxiosError) {
        if (error.code === 'ECONNREFUSED') {
          this.logger.error(
            `SpringAgent no disponible en ${this.springAgentUrl}`,
          );
          throw new HttpException(
            'El servicio de IA no está disponible en este momento. Intenta más tarde.',
            HttpStatus.SERVICE_UNAVAILABLE,
          );
        }
        if (error.code === 'ECONNABORTED') {
          this.logger.error('Timeout al consultar SpringAgent');
          throw new HttpException(
            'La consulta tardó demasiado. Intenta con una pregunta más específica.',
            HttpStatus.GATEWAY_TIMEOUT,
          );
        }
      }

      this.logger.error(`Error en chat: ${errMsg}`);
      throw new HttpException(
        'Error procesando la consulta de IA',
        HttpStatus.BAD_GATEWAY,
      );
    }
  }
}
