import { NotFoundException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { GUARDS_METADATA } from '@nestjs/common/constants';
import { JwtAuthGuard } from 'src/guard/jwt-auth.guard';
import { IncidenciasController } from 'src/incidencias/incidencias.controller';
import { InmueblesController } from 'src/inmuebles/inmuebles.controller';
import { PerteneceAlClienteGuard } from './pertenece-al-cliente.decorator';
import { TenantAccessService } from './tenant-access.service';

function serviceWithRows(rows: unknown[]) {
  const query = jest.fn().mockResolvedValue(rows);
  return { service: new TenantAccessService({ query } as never), query };
}

describe('TenantAccessService', () => {
  it('no restringe al súper administrador', async () => {
    const { service, query } = serviceWithRows([]);
    await expect(service.assert('inmueble', 5, { rol: 1, cliente: 9 })).resolves.toBeUndefined();
    expect(query).not.toHaveBeenCalled();
  });

  it('permite el recurso del propio cliente y consulta con id y cliente', async () => {
    const { service, query } = serviceWithRows([{ Id: 5 }]);
    await service.assert('inmueble', 5, { rol: 2, cliente: 3 });
    expect(query).toHaveBeenCalledWith(expect.stringContaining('FROM Inmuebles i'), [5, 3]);
  });

  it('responde 404 si el recurso es de otro cliente', async () => {
    const { service } = serviceWithRows([]);
    await expect(service.assert('arrendatario', 7, { rol: 2, cliente: 3 })).rejects.toBeInstanceOf(NotFoundException);
  });

  it('usa cliente 0 si el token no trae cliente (nunca coincide)', async () => {
    const { service, query } = serviceWithRows([]);
    await expect(service.assert('pagoInmueble', 1, { rol: 2 })).rejects.toBeInstanceOf(NotFoundException);
    expect(query).toHaveBeenCalledWith(expect.any(String), [1, 0]);
  });

  it('ignora parámetros opcionales ausentes', async () => {
    const { service, query } = serviceWithRows([]);
    await service.assert('contrato', undefined, { rol: 2, cliente: 3 });
    expect(query).not.toHaveBeenCalled();
  });
});

describe('PerteneceAlClienteGuard', () => {
  const ctx = (handler: unknown, req: unknown) =>
    ({
      getHandler: () => handler,
      switchToHttp: () => ({ getRequest: () => req }),
    }) as never;

  it('valida el parámetro declarado en el decorador', async () => {
    const assert = jest.fn().mockResolvedValue(undefined);
    const guard = new PerteneceAlClienteGuard(new Reflector(), { assert } as never);
    const req = { params: { idInmueble: '12' }, user: { rol: 2, cliente: 3 } };
    await guard.canActivate(ctx(InmueblesController.prototype.findAreaOcupada, req));
    expect(assert).toHaveBeenCalledWith('inmueble', '12', req.user);
  });

  it('valida todos los parámetros con varias reglas (inmueble y contrato)', async () => {
    const assert = jest.fn().mockResolvedValue(undefined);
    const guard = new PerteneceAlClienteGuard(new Reflector(), { assert } as never);
    const handler = Object.getOwnPropertyNames(InmueblesController.prototype)
      .map((n) => (InmueblesController.prototype as never)[n])
      .find((fn) => (Reflect.getMetadata('pertenenciaCliente', fn as object) ?? []).length === 2);
    const req = { params: { idInmueble: '1', idContrato: '2' }, user: { rol: 2, cliente: 3 } };
    await guard.canActivate(ctx(handler, req));
    expect(assert).toHaveBeenNthCalledWith(1, 'inmueble', '1', req.user);
    expect(assert).toHaveBeenNthCalledWith(2, 'contrato', '2', req.user);
  });
});

describe('Incidencias', () => {
  it('en los GET el JWT se ejecuta antes que la validación de pertenencia', () => {
    const guards = Reflect.getMetadata(GUARDS_METADATA, IncidenciasController.prototype.getIncidencias);
    expect(guards).toEqual([JwtAuthGuard, PerteneceAlClienteGuard]);
  });

  it('el POST de los dispositivos sigue sin autenticación', () => {
    expect(Reflect.getMetadata(GUARDS_METADATA, IncidenciasController.prototype.create)).toBeUndefined();
  });
});
