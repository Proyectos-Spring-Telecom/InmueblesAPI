export type ColorAlerta = "verde" | "naranja" | "amarillo" | "rojo";

function truncarDia(fecha: Date): Date {
  return new Date(fecha.getFullYear(), fecha.getMonth(), fecha.getDate());
}

/** Días calendario desde hoy hasta la fecha objetivo (negativo si ya venció). */
export function diasFaltantesHasta(
  fechaObjetivo: Date,
  referencia = new Date(),
): number {
  const ref = truncarDia(referencia);
  const obj = truncarDia(fechaObjetivo);
  return Math.round((obj.getTime() - ref.getTime()) / 86400000);
}

/**
 * > 30 días: verde | 16–30: naranja | 4–15: amarillo | ≤ 3: rojo
 * (vencidos cuentan como ≤ 3 → rojo)
 */
export function colorPorDiasFaltantes(dias: number): ColorAlerta {
  if (dias <= 3) return "rojo";
  if (dias <= 15) return "amarillo";
  if (dias > 15 && dias <= 30) return "naranja";
  return "verde";
}
