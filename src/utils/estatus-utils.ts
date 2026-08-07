import { isSuperAdmin } from "./cliente-utils";

/**
 * Filtro de Estatus para GETs según rol del JWT:
 * - rol 1: sin filtro (ve activos e inactivos)
 * - rol > 1: solo Estatus = 1
 */
export function estatusWhereForRol(rol: number): { estatus: number } | Record<string, never> {
  if (isSuperAdmin(rol)) return {};
  return { estatus: 1 };
}

/** true si el rol puede ver registros inactivos (estatus 0). */
export function canSeeInactive(rol: number): boolean {
  return isSuperAdmin(rol);
}

/**
 * Filtra en memoria colecciones con campo `estatus` binario (0/1).
 * Rol 1: sin cambio. Rol > 1: solo estatus === 1.
 */
export function filterByEstatusRol<T extends { estatus?: number | null }>(
  items: T[] | null | undefined,
  rol: number,
): T[] {
  const list = items ?? [];
  if (canSeeInactive(rol)) return list;
  return list.filter((item) => Number(item.estatus) === 1);
}

/** Clausula SQL opcional: '' | ' AND alias.Estatus = 1' */
export function sqlEstatusAnd(rol: number, alias: string): string {
  if (canSeeInactive(rol)) return "";
  return ` AND ${alias}.Estatus = 1`;
}

/** WHERE fragmento: '' | 'Estatus = 1' (sin AND, para armar queries). */
export function sqlEstatusWhere(rol: number, alias?: string): string {
  if (canSeeInactive(rol)) return "";
  const col = alias ? `${alias}.Estatus` : "Estatus";
  return `${col} = 1`;
}

/** Filtra relaciones anidadas de un Inmueble según rol. Locales no se filtran. */
export function filterInmuebleRelations<
  T extends {
    servicios?: Array<{ estatus?: number | null }> | null;
    archivos?: Array<{ estatus?: number | null }> | null;
    zonas?: Array<{
      estatus?: number | null;
      locales?: Array<{ estatus?: number | null }> | null;
    }> | null;
  },
>(inmueble: T, rol: number): T {
  if (canSeeInactive(rol)) return inmueble;

  return {
    ...inmueble,
    servicios: filterByEstatusRol(inmueble.servicios, rol),
    archivos: filterByEstatusRol(inmueble.archivos, rol),
    zonas: filterByEstatusRol(inmueble.zonas, rol),
  };
}

/** Filtra relaciones anidadas de un Arrendatario según rol. */
export function filterArrendatarioRelations<
  T extends {
    servicios?: Array<{ estatus?: number | null }> | null;
    archivos?: Array<{ estatus?: number | null }> | null;
    socios?: Array<{ estatus?: number | null }> | null;
    contratos?: Array<{
      estatus?: number | null;
      contratoLocales?: Array<{ estatus?: number | null }> | null;
    }> | null;
  },
>(arrendatario: T, rol: number): T {
  if (canSeeInactive(rol)) return arrendatario;

  const contratos = filterByEstatusRol(arrendatario.contratos, rol).map(
    (contrato) => ({
      ...contrato,
      contratoLocales: filterByEstatusRol(contrato.contratoLocales, rol),
    }),
  );

  return {
    ...arrendatario,
    servicios: filterByEstatusRol(arrendatario.servicios, rol),
    archivos: filterByEstatusRol(arrendatario.archivos, rol),
    socios: filterByEstatusRol(arrendatario.socios, rol),
    contratos,
  };
}
