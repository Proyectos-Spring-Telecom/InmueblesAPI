import {
  applyDecorators,
  CanActivate,
  ExecutionContext,
  Injectable,
  SetMetadata,
  UseGuards,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RecursoCliente, TenantAccessService } from './tenant-access.service';

const PERTENENCIA_KEY = 'pertenenciaCliente';

interface Regla {
  recurso: RecursoCliente;
  /** Nombre del parámetro de ruta (o de query si `enQuery`). */
  param: string;
  enQuery?: boolean;
}

@Injectable()
export class PerteneceAlClienteGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly tenantAccess: TenantAccessService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const reglas = this.reflector.get<Regla[]>(PERTENENCIA_KEY, context.getHandler()) ?? [];
    const req = context.switchToHttp().getRequest();
    for (const regla of reglas) {
      const valor = regla.enQuery ? req.query?.[regla.param] : req.params?.[regla.param];
      await this.tenantAccess.assert(regla.recurso, valor, req.user);
    }
    return true;
  }
}

/**
 * Exige que el recurso indicado por un parámetro de la ruta pertenezca al cliente
 * del JWT (rol 1 sin restricción). Debe usarse en controladores con JwtAuthGuard
 * a nivel de clase, que se ejecuta antes que este guard.
 *
 * @example @PerteneceAlCliente('inmueble', 'idInmueble')
 */
export function PerteneceAlCliente(
  recurso: RecursoCliente,
  param = 'id',
  opciones: { enQuery?: boolean } = {},
) {
  return applyDecorators(
    SetMetadata(PERTENENCIA_KEY, [{ recurso, param, enQuery: opciones.enQuery }]),
    UseGuards(PerteneceAlClienteGuard),
  );
}

/** Varias reglas en el mismo endpoint (p. ej. inmueble y contrato). */
export function PerteneceAlClienteTodos(...reglas: Regla[]) {
  return applyDecorators(SetMetadata(PERTENENCIA_KEY, reglas), UseGuards(PerteneceAlClienteGuard));
}
