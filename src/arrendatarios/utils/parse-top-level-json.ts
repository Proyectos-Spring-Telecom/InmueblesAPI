import { BadRequestException } from "@nestjs/common";

/**
 * Convierte campos de texto que vienen como JSON string en el FormData
 * (p. ej. `arrendatario`, `contratoArrendatario`) en objetos anidados.
 */
export function parseTopLevelJsonStrings(
  obj: Record<string, any>,
  keys: string[],
): void {
  for (const k of keys) {
    const v = obj[k];
    if (v === undefined || v === null) continue;
    if (typeof v === "string" && v.trim() === "") {
      delete obj[k];
      continue;
    }
    if (typeof v === "string") {
      try {
        obj[k] = JSON.parse(v);
      } catch {
        throw new BadRequestException(
          `El campo "${k}" no contiene JSON válido.`,
        );
      }
    }
  }
}
