import { BadRequestException } from "@nestjs/common";

const MX_TZ = "America/Mexico_City";

/** Normaliza decimales opcionales: null/vacío → undefined, redondeo a 2 decimales. */
export function optionalDecimalTransform({
  value,
}: {
  value: unknown;
}): number | undefined {
  if (value === null || value === undefined || value === "") {
    return undefined;
  }

  const n =
    typeof value === "number"
      ? value
      : Number.parseFloat(String(value).trim().replace(",", "."));

  if (!Number.isFinite(n)) {
    return undefined;
  }

  return Math.round(n * 100) / 100;
}

export function decStr(v: number | undefined | null): string | null {
  if (v === undefined || v === null) return null;
  return String(v);
}

/** Primer día del mes actual en zona horaria de México. */
export function getMesActual(): Date {
  const now = new Date();
  const mx = new Date(now.toLocaleString("en-US", { timeZone: MX_TZ }));
  return new Date(mx.getFullYear(), mx.getMonth(), 1);
}

/** Avanza la fecha un mes calendario, preservando día y hora. */
export function addOneMonth(fecha: Date): Date {
  const d = new Date(fecha.getTime());
  d.setMonth(d.getMonth() + 1);
  return d;
}

function getAnioMesMx(fecha: Date): { anio: number; mes: number } {
  const mx = new Date(fecha.toLocaleString("en-US", { timeZone: MX_TZ }));
  return { anio: mx.getFullYear(), mes: mx.getMonth() };
}

/** Indica si la fecha pertenece al mes-año actual (zona México). */
export function isMesActual(fecha: Date | null | undefined): boolean {
  if (!fecha) return false;
  const actual = getAnioMesMx(getMesActual());
  const ref = getAnioMesMx(fecha);
  return actual.anio === ref.anio && actual.mes === ref.mes;
}

export function parseRangoFechas(
  fechaInicio: string | undefined,
  fechaFin: string | undefined,
): { inicio: Date; fin: Date } {
  if (!fechaInicio || !fechaFin) {
    throw new BadRequestException(
      "Se requieren fechaInicio y fechaFin (formato YYYY-MM-DD).",
    );
  }

  const inicio = new Date(`${fechaInicio} 00:00:00`);
  const fin = new Date(`${fechaFin} 23:59:59`);

  if (Number.isNaN(inicio.getTime()) || Number.isNaN(fin.getTime())) {
    throw new BadRequestException(
      "fechaInicio y fechaFin deben ser fechas válidas (YYYY-MM-DD).",
    );
  }
  if (inicio > fin) {
    throw new BadRequestException(
      "fechaInicio no puede ser posterior a fechaFin.",
    );
  }

  return { inicio, fin };
}

export const PAGO_MENSUAL_RELATIONS = [
  "arrendatario",
  "contrato",
  "contrato.inmueble",
  "contrato.contratoLocales",
  "contrato.contratoLocales.local",
  "formula",
] as const;

export interface PagoRentaMontos {
  total: string | null;
  montoFinal: string | null;
  totalMantenimiento: string | null;
  montoFinalMantenimiento: string | null;
}

export interface IncrementoRentaFlags {
  total: boolean;
  montoFinal: boolean;
}

export interface IncrementoMantenimientoFlags {
  totalMantenimiento: boolean;
  montoFinalMantenimiento: boolean;
}

function montoIncremento(
  actual: string | null,
  anterior: string | null,
): boolean {
  if (actual == null || anterior == null) return false;
  const a = Number.parseFloat(actual);
  const b = Number.parseFloat(anterior);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return false;
  return a > b;
}

export function calcIncrementoRenta(
  actual: PagoRentaMontos,
  anterior: PagoRentaMontos | null | undefined,
): IncrementoRentaFlags {
  if (!anterior) {
    return { total: false, montoFinal: false };
  }
  return {
    total: montoIncremento(actual.total, anterior.total),
    montoFinal: montoIncremento(actual.montoFinal, anterior.montoFinal),
  };
}

export function calcIncrementoMantenimiento(
  actual: PagoRentaMontos,
  anterior: PagoRentaMontos | null | undefined,
): IncrementoMantenimientoFlags {
  if (!anterior) {
    return {
      totalMantenimiento: false,
      montoFinalMantenimiento: false,
    };
  }
  return {
    totalMantenimiento: montoIncremento(
      actual.totalMantenimiento,
      anterior.totalMantenimiento,
    ),
    montoFinalMantenimiento: montoIncremento(
      actual.montoFinalMantenimiento,
      anterior.montoFinalMantenimiento,
    ),
  };
}

export function mapPagoRentaDesglose<T extends PagoRentaMontos>(
  row: T,
): T & {
  desglose: {
    renta: { total: string | null; montoFinal: string | null };
    mantenimiento: {
      totalMantenimiento: string | null;
      montoFinalMantenimiento: string | null;
    };
  };
} {
  return {
    ...row,
    desglose: {
      renta: {
        total: row.total,
        montoFinal: row.montoFinal,
      },
      mantenimiento: {
        totalMantenimiento: row.totalMantenimiento,
        montoFinalMantenimiento: row.montoFinalMantenimiento,
      },
    },
  };
}

export function mapHistoricoPagoRentaResponse<
  T extends PagoRentaMontos & { id?: number },
>(
  row: T,
  mesAnterior?: PagoRentaMontos | null,
): ReturnType<typeof mapPagoRentaDesglose<T>> & {
  incrementoRenta: IncrementoRentaFlags;
  incrementoMantenimiento: IncrementoMantenimientoFlags;
} {
  return {
    ...mapPagoRentaDesglose(row),
    incrementoRenta: calcIncrementoRenta(row, mesAnterior),
    incrementoMantenimiento: calcIncrementoMantenimiento(row, mesAnterior),
  };
}
