/** Utilidades de dinero en centavos enteros (evita errores de punto flotante). */

export const TASA_IVA = 0.16;

export function cents(value: string | number | null | undefined): number {
  if (value === null || value === undefined || value === "") return 0;
  const n = typeof value === "number" ? value : Number.parseFloat(String(value));
  return Number.isFinite(n) ? Math.round(n * 100) : 0;
}

export function money(c: number): string {
  return (c / 100).toFixed(2);
}

/** Decimal opcional como string (null si no viene), igual que `decStr` del modelo anterior. */
export function moneyOrNull(value: number | string | null | undefined): string | null {
  if (value === null || value === undefined || value === "") return null;
  return money(cents(value));
}

/** Desglose de un total con IVA incluido: subtotal = total / (1 + tasa). */
export function desglosarIva(totalCents: number, tasa = TASA_IVA): { subtotal: number; iva: number } {
  const subtotal = Math.round(totalCents / (1 + tasa));
  return { subtotal, iva: totalCents - subtotal };
}

/** Total a cobrar de un concepto: monto final si existe, si no el monto base. */
export function totalConcepto(montoBase: string | number | null, montoFinal: string | number | null): number {
  return montoFinal !== null && montoFinal !== undefined && montoFinal !== ""
    ? cents(montoFinal)
    : cents(montoBase);
}
