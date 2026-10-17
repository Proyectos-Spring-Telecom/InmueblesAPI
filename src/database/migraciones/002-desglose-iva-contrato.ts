import type { Connection, RowDataPacket } from "mysql2/promise";
import { cents, desgloseDeContrato, money } from "../../cobranza/money";

/**
 * 002 · Desglose de IVA desde el contrato: los conceptos de renta y mantenimiento migrados con
 * desglose estimado (total / 1.16) cuyo total es exactamente el del contrato toman el subtotal y
 * el IVA del contrato y dejan de marcarse como estimados. Corrige diferencias de un centavo.
 * Los demás (montos ajustados por INPC o monto final distinto, y servicios) siguen estimados
 * hasta que exista la factura (fase 3).
 */
export const VERSION = "002-desglose-iva-contrato";
export const DESCRIPCION = "Subtotal e IVA del contrato en conceptos migrados con desglose estimado";

export interface Resultado002 {
  revisados: number;
  tomadosDelContrato: number;
  conCambioDeMonto: number;
  siguenEstimados: number;
}

interface Fila extends RowDataPacket {
  id: number;
  tipo: string;
  total: string;
  subtotal: string;
  iva: string;
  rentaTotal: string | null;
  subTotalRenta: string | null;
  ivaRenta: string | null;
  mantenimientoTotal: string | null;
  subTotalMantenimiento: string | null;
  ivaMantenimiento: string | null;
}

export async function aplicar(db: Connection): Promise<Resultado002> {
  const [filas] = await db.query<Fila[]>(
    `SELECT cc.Id id, cc.Tipo tipo, cc.Total total, cc.Subtotal subtotal, cc.Iva iva,
            ct.RentaTotal rentaTotal, ct.SubTotalRenta subTotalRenta, ct.IVARenta ivaRenta,
            ct.MantenimientoTotal mantenimientoTotal, ct.SubTotalMantenimiento subTotalMantenimiento,
            ct.IVAMantenimiento ivaMantenimiento
       FROM CargoConceptos cc
       JOIN Cargos c ON c.Id = cc.IdCargo
       LEFT JOIN ContratoArrendatarios ct ON ct.Id = c.IdContrato
      WHERE cc.DesgloseEstimado = 1 AND cc.Tipo IN ('RENTA', 'MANTENIMIENTO') AND cc.Total > 0
      FOR UPDATE`,
  );
  const res: Resultado002 = { revisados: filas.length, tomadosDelContrato: 0, conCambioDeMonto: 0, siguenEstimados: 0 };
  for (const f of filas) {
    const ref =
      f.tipo === "RENTA"
        ? { total: f.rentaTotal, subtotal: f.subTotalRenta, iva: f.ivaRenta }
        : { total: f.mantenimientoTotal, subtotal: f.subTotalMantenimiento, iva: f.ivaMantenimiento };
    const d = desgloseDeContrato(cents(f.total), ref);
    if (!d) {
      res.siguenEstimados++;
      continue;
    }
    if (d.subtotal !== cents(f.subtotal) || d.iva !== cents(f.iva)) res.conCambioDeMonto++;
    await db.query(`UPDATE CargoConceptos SET Subtotal = ?, Iva = ?, DesgloseEstimado = 0 WHERE Id = ?`, [
      money(d.subtotal),
      money(d.iva),
      f.id,
    ]);
    res.tomadosDelContrato++;
  }
  return res;
}

/** Ningún concepto puede quedar con subtotal + IVA distinto de su total, ni con montos negativos. */
export async function verificar(db: Connection): Promise<string[]> {
  const [descuadres] = await db.query<RowDataPacket[]>(
    `SELECT Id, Total, Subtotal, Iva FROM CargoConceptos
      WHERE ROUND(Subtotal + Iva, 2) <> Total OR Subtotal < 0 OR Iva < 0 LIMIT 20`,
  );
  return descuadres.map((r) => `concepto ${r.Id}: subtotal ${r.Subtotal} + IVA ${r.Iva} ≠ total ${r.Total}`);
}
