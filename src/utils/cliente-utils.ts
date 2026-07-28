import { ForbiddenException } from '@nestjs/common';
import { Repository } from 'typeorm';

export const ROL_SUPER_ADMIN = 1;

export function isSuperAdmin(rol: number): boolean {
  return Number(rol) === ROL_SUPER_ADMIN;
}

/**
 * IDs de Arrendadores cuyo IdCliente coincide con el cliente del JWT.
 * Usar para filtrar entidades ligadas a Arrendadores (inmuebles, arrendatarios, equipos, etc.).
 */
export async function getClienteHijos(
  clienteRepository: Repository<any>,
  cliente: number,
): Promise<{ ids: number[]; placeholders: string }> {
  const rows = await clienteRepository.query(
    `SELECT Id FROM Arrendadores WHERE IdCliente = ?`,
    [cliente],
  );

  const ids = (rows ?? [])
    .map((row: any) => Number(row.Id))
    .filter((id: number) => !isNaN(id));

  if (ids.length === 0) {
    return { ids: [], placeholders: '' };
  }

  const placeholders = ids.map(() => '?').join(', ');
  return { ids, placeholders };
}

/** Alias de getClienteHijos (compatibilidad con listados paginados). */
export async function getClienteHijosPag(
  clienteRepository: Repository<any>,
  cliente: number,
): Promise<{ ids: number[]; placeholders: string }> {
  return getClienteHijos(clienteRepository, cliente);
}

/**
 * Resuelve el alcance de arrendadores según rol.
 * - rol 1: sin restricción
 * - rol > 1: solo arrendadores con IdCliente = cliente JWT
 */
export async function resolveArrendadorScope(
  repo: Repository<any>,
  rol: number,
  idCliente: number,
): Promise<
  | { unrestricted: true }
  | { unrestricted: false; ids: number[]; placeholders: string }
> {
  if (isSuperAdmin(rol)) {
    return { unrestricted: true };
  }

  const { ids, placeholders } = await getClienteHijos(repo, idCliente);
  return { unrestricted: false, ids, placeholders };
}

/** Lanza Forbidden si el arrendador no pertenece al cliente (rol > 1). */
export async function assertArrendadorAccess(
  repo: Repository<any>,
  rol: number,
  idCliente: number,
  idArrendador: number,
): Promise<void> {
  if (isSuperAdmin(rol)) return;

  const rows = await repo.query(
    `SELECT Id FROM Arrendadores WHERE Id = ? AND IdCliente = ? LIMIT 1`,
    [idArrendador, idCliente],
  );
  if (!rows?.length) {
    throw new ForbiddenException(
      'No tienes acceso a este arrendador o a sus recursos.',
    );
  }
}
