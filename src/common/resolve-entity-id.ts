/**
 * Normaliza el id de una entidad desde JSON o FormData (número o string numérica).
 * Devuelve undefined si no hay id válido (insertar).
 */
export function resolveEntityId(id: unknown): number | undefined {
  if (id === undefined || id === null || id === "") {
    return undefined;
  }
  const n = Number(id);
  if (!Number.isInteger(n) || n <= 0) {
    return undefined;
  }
  return n;
}
