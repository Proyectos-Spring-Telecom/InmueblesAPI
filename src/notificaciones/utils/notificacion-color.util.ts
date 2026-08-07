export type ColorAlerta = "verde" | "naranja" | "amarillo" | "rojo";

/**
 * Días calendario desde hoy (calendario local) hasta la fecha objetivo (día UTC de la fecha DB).
 * Negativo si ya venció.
 */
export function diasFaltantesHasta(
  fechaObjetivo: Date,
  referencia = new Date(),
): number {
  const refMs = Date.UTC(
    referencia.getFullYear(),
    referencia.getMonth(),
    referencia.getDate(),
  );
  const objMs = Date.UTC(
    fechaObjetivo.getUTCFullYear(),
    fechaObjetivo.getUTCMonth(),
    fechaObjetivo.getUTCDate(),
  );
  return Math.round((objMs - refMs) / 86400000);
}

/** Proyecta el día de la entidad a un mes/año concretos (UTC). */
export function fechaPagoEnMes(
  fechaPagoBase: Date,
  anio: number,
  mesIndex: number,
): Date {
  const diaBase = fechaPagoBase.getUTCDate();
  const ultimoDiaMes = new Date(Date.UTC(anio, mesIndex + 1, 0)).getUTCDate();
  const dia = Math.min(diaBase, ultimoDiaMes);
  return new Date(Date.UTC(anio, mesIndex, dia));
}

/**
 * Fecha de pago para la notificación:
 * - Por defecto: día de la entidad en el mes actual.
 * - Si esa fecha ya pasó y ya hay pago del mes → avanza al mes siguiente.
 */
export function fechaPagoParaNotificacion(
  fechaPagoBase: Date,
  referencia: Date,
  tienePagoDelMes: boolean,
): Date {
  const anio = referencia.getFullYear();
  const mes = referencia.getMonth();
  const fechaMesActual = fechaPagoEnMes(fechaPagoBase, anio, mes);

  if (
    tienePagoDelMes &&
    diasFaltantesHasta(fechaMesActual, referencia) < 0
  ) {
    const siguiente = new Date(anio, mes + 1, 1);
    return fechaPagoEnMes(
      fechaPagoBase,
      siguiente.getFullYear(),
      siguiente.getMonth(),
    );
  }

  return fechaMesActual;
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
