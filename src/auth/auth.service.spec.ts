import { ForbiddenException } from '@nestjs/common';
import { AuthService } from './auth.service';

/** Cambio de contraseña: sólo la propia (o súper admin) y sin revelar si un usuario existe. */
describe('AuthService.resetPassword', () => {
  const usuarios = [
    { id: 46, userName: 'propio@ejemplo.mx', nombre: 'Propio' },
    { id: 47, userName: 'otro@ejemplo.mx', nombre: 'Otro' },
  ];
  function build() {
    const repo = {
      findOne: jest.fn(async ({ where }: any) =>
        usuarios.find((u) => (where.id !== undefined ? u.id === where.id : u.userName === where.userName)) ?? null,
      ),
      update: jest.fn(async () => undefined),
    };
    const service = Object.create(AuthService.prototype) as AuthService;
    Object.assign(service, {
      usuariosRepository: repo,
      revokeAllRefreshSessionsForUser: jest.fn(async () => undefined),
      bitacoraLogger: { logToBitacora: jest.fn(async () => undefined) },
    });
    return { service, repo };
  }

  it('permite cambiar la propia contraseña', async () => {
    const { service, repo } = build();
    await service.resetPassword({ userName: 'Propio@ejemplo.mx', password: 'nueva' } as any, { userId: 46, rol: 2 });
    expect(repo.update).toHaveBeenCalledWith(46, expect.objectContaining({ passwordHash: expect.any(String) }));
  });

  it('rechaza cambiar la de otro usuario con 403', async () => {
    const { service, repo } = build();
    await expect(
      service.resetPassword({ userName: 'otro@ejemplo.mx', password: 'x' } as any, { userId: 46, rol: 2 }),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(repo.update).not.toHaveBeenCalled();
  });

  it('responde igual (403) si el usuario no existe: no revela existencia', async () => {
    const { service } = build();
    await expect(
      service.resetPassword({ userName: 'noexiste@ejemplo.mx', password: 'x' } as any, { userId: 46, rol: 2 }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('el súper administrador puede cambiar la de otro', async () => {
    const { service, repo } = build();
    await service.resetPassword({ userName: 'otro@ejemplo.mx', password: 'x' } as any, { userId: 1, rol: 1 });
    expect(repo.update).toHaveBeenCalledWith(47, expect.anything());
  });
});
