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
 * Proyecta el día de `fechaPagoBase` al mes/año de `referencia`
 * (ej. 15/08/2026 → 15/09/2026 si referencia es septiembre).
 * Si el día no existe en el mes destino (ej. 31 en feb), usa el último día del mes.
 */
export function fechaPagoEnMesActual(
  fechaPagoBase: Date,
  referencia = new Date(),
): Date {
  const anio = referencia.getFullYear();
  const mes = referencia.getMonth();
  const diaBase = fechaPagoBase.getDate();
  const ultimoDiaMes = new Date(anio, mes + 1, 0).getDate();
  const dia = Math.min(diaBase, ultimoDiaMes);
  return new Date(anio, mes, dia);
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
