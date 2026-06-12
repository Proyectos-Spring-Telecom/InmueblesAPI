import { BadRequestException } from "@nestjs/common";

const MX_TZ = "America/Mexico_City";

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
