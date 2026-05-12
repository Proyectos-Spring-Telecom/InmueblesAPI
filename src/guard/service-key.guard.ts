import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class ServiceKeyGuard implements CanActivate {
  constructor(private readonly configService: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<{ headers: Record<string, string | string[] | undefined> }>();
    const raw = request.headers['x-service-key'];
    const serviceKey = Array.isArray(raw) ? raw[0] : raw;
    const expectedKey = this.configService.get<string>('AI_SERVICE_KEY');

    if (!serviceKey || serviceKey !== expectedKey) {
      throw new UnauthorizedException('Clave de servicio inválida');
    }

    return true;
  }
}
