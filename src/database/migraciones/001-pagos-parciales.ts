import type { Connection, RowDataPacket } from "mysql2/promise";

/**
 * 001 · Pagos parciales: tablas de cargos, conceptos, pagos y aplicaciones; forma de pago SAT;
 * migración de RentaActual, HistoricoPagosRenta y PagosArrendatarios al modelo nuevo.
 * Las tablas anteriores NO se modifican ni se borran.
 */
export const VERSION = "001-pagos-parciales";
export const DESCRIPCION = "Cargos, pagos y aplicaciones (pagos parciales) + forma de pago SAT";

const TASA_IVA = 0.16;

// ─── DDL (idempotente; en MySQL el DDL no es transaccional) ─────────────────

export const DDL = [
  `CREATE TABLE IF NOT EXISTS SchemaMigrations (
     Version varchar(50) NOT NULL,
     Descripcion varchar(200) NOT NULL,
     FHAplicada datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
     Detalle json NULL,
     PRIMARY KEY (Version)
   ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci`,

  `CREATE TABLE IF NOT EXISTS Cargos (
     Id bigint NOT NULL AUTO_INCREMENT,
     IdArrendatario bigint NOT NULL,
     IdContrato bigint NULL,
     Clase varchar(15) NOT NULL,
     Mes datetime NOT NULL,
     FechaFin datetime NULL,
     Descripcion varchar(200) NULL,
     IdFormula bigint NULL,
     UsaFormula tinyint NULL,
     OcupoFormula tinyint NULL,
     FactorVariable decimal(10,2) NULL,
     Total decimal(12,2) NOT NULL DEFAULT '0.00',
     Pagado decimal(12,2) NOT NULL DEFAULT '0.00',
     Saldo decimal(12,2) NOT NULL DEFAULT '0.00',
     Liquidado tinyint NOT NULL DEFAULT '0',
     MarcaPagadoSinMonto tinyint NOT NULL DEFAULT '0',
     Origen varchar(20) NOT NULL,
     Estatus tinyint NOT NULL DEFAULT '1',
     IdLegacyRentaActual bigint NULL,
     IdLegacyHistorico bigint NULL,
     IdLegacyPagoArrendatario bigint NULL,
     FHRegistro datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
     IdUsuarioRegistro bigint NULL,
     FHActualizacion datetime NULL,
     PRIMARY KEY (Id),
     KEY IX_Cargos_Arrendatario (IdArrendatario),
     KEY IX_Cargos_Contrato_Mes (IdContrato, Mes),
     KEY IX_Cargos_Clase_Liquidado (Clase, Estatus, Liquidado),
     CONSTRAINT FK_Cargos_Arrendatario FOREIGN KEY (IdArrendatario) REFERENCES Arrendatarios (Id),
     CONSTRAINT FK_Cargos_Contrato FOREIGN KEY (IdContrato) REFERENCES ContratoArrendatarios (Id)
   ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci`,

  `CREATE TABLE IF NOT EXISTS CargoConceptos (
     Id bigint NOT NULL AUTO_INCREMENT,
     IdCargo bigint NOT NULL,
     Tipo varchar(15) NOT NULL,
     IdTipoServicio bigint NULL,
     IdServicioArrendatario bigint NULL,
     Descripcion varchar(200) NULL,
     MontoBase decimal(12,2) NULL,
     MontoFinal decimal(12,2) NULL,
     Total decimal(12,2) NOT NULL,
     TasaIva decimal(5,4) NOT NULL DEFAULT '0.1600',
     Subtotal decimal(12,2) NOT NULL,
     Iva decimal(12,2) NOT NULL,
     DesgloseEstimado tinyint NOT NULL DEFAULT '0',
     Pagado decimal(12,2) NOT NULL DEFAULT '0.00',
     Saldo decimal(12,2) NOT NULL DEFAULT '0.00',
     Estatus tinyint NOT NULL DEFAULT '1',
     FHRegistro datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
     PRIMARY KEY (Id),
     KEY IX_CargoConceptos_Cargo (IdCargo),
     CONSTRAINT FK_CargoConceptos_Cargo FOREIGN KEY (IdCargo) REFERENCES Cargos (Id)
   ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci`,

  `CREATE TABLE IF NOT EXISTS Pagos (
     Id bigint NOT NULL AUTO_INCREMENT,
     IdArrendatario bigint NOT NULL,
     FechaPago datetime NOT NULL,
     FechaPagoFinal datetime NULL,
     Monto decimal(12,2) NOT NULL,
     Aplicado decimal(12,2) NOT NULL DEFAULT '0.00',
     Disponible decimal(12,2) NOT NULL DEFAULT '0.00',
     IdMetodoPago bigint NULL,
     FormaPagoSat char(2) NULL,
     Referencia varchar(100) NULL,
     Concepto varchar(100) NULL,
     ComprobanteUrl varchar(500) NULL,
     IdCargoReferencia bigint NULL,
     Origen varchar(20) NOT NULL,
     Estatus tinyint NOT NULL DEFAULT '1',
     MotivoCancelacion varchar(300) NULL,
     FHCancelacion datetime NULL,
     IdUsuarioCancelacion bigint NULL,
     IdLegacyPagoArrendatario bigint NULL,
     FHRegistro datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
     IdUsuarioRegistro bigint NULL,
     PRIMARY KEY (Id),
     KEY IX_Pagos_Arrendatario (IdArrendatario),
     KEY IX_Pagos_CargoReferencia (IdCargoReferencia),
     CONSTRAINT FK_Pagos_Arrendatario FOREIGN KEY (IdArrendatario) REFERENCES Arrendatarios (Id)
   ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci`,

  `CREATE TABLE IF NOT EXISTS PagoAplicaciones (
     Id bigint NOT NULL AUTO_INCREMENT,
     IdPago bigint NOT NULL,
     IdCargoConcepto bigint NOT NULL,
     Monto decimal(12,2) NOT NULL,
     Estatus tinyint NOT NULL DEFAULT '1',
     FHRegistro datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
     IdUsuarioRegistro bigint NULL,
     FHAnulacion datetime NULL,
     IdUsuarioAnulacion bigint NULL,
     PRIMARY KEY (Id),
     KEY IX_PagoAplicaciones_Pago (IdPago),
     KEY IX_PagoAplicaciones_Concepto (IdCargoConcepto),
     CONSTRAINT FK_PagoAplicaciones_Pago FOREIGN KEY (IdPago) REFERENCES Pagos (Id),
     CONSTRAINT FK_PagoAplicaciones_Concepto FOREIGN KEY (IdCargoConcepto) REFERENCES CargoConceptos (Id)
   ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci`,
];

/** Columna FormaPagoSat en el catálogo de métodos de pago (MySQL no tiene ADD COLUMN IF NOT EXISTS). */
export async function asegurarColumnaFormaPago(db: Connection, schema: string): Promise<void> {
  const [rows] = await db.query<RowDataPacket[]>(
    `SELECT 1 FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'CatMetodosPago' AND COLUMN_NAME = 'FormaPagoSat'`,
    [schema],
  );
  if (rows.length === 0) {
    await db.query(`ALTER TABLE CatMetodosPago ADD COLUMN FormaPagoSat char(2) NULL`);
  }
}

// ─── Datos (dentro de una transacción) ──────────────────────────────────────

const c = (v: unknown): number => {
  if (v === null || v === undefined || v === "") return 0;
  const n = Number.parseFloat(String(v));
  return Number.isFinite(n) ? Math.round(n * 100) : 0;
};
const m = (cents: number) => (cents / 100).toFixed(2);
const mOrNull = (v: unknown) => (v === null || v === undefined ? null : m(c(v)));
const totalConcepto = (base: unknown, final: unknown) => (final !== null && final !== undefined ? c(final) : c(base));
const ym = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;

interface RentaRow extends RowDataPacket {
  Id: number;
  IdArrendatario: number | null;
  IdContrato: number | null;
  Mes: Date | null;
  Total: string | null;
  MontoFinal: string | null;
  TotalMantenimiento: string | null;
  MontoFinalMantenimiento: string | null;
  FechaFin: Date | null;
  IdFormula: number | null;
  UsaFormula: number | null;
  OcupoFormula: number | null;
  FactorVariable: string | null;
  Pagada: number | null;
  FHRegistro: Date | null;
}

export interface ResultadoMigracion {
  cargosRenta: number;
  cargosServicio: number;
  pagos: number;
  aplicaciones: number;
  fusionados: number;
  duplicadosContratoMes: string[];
  omitidos: string[];
}

/** Monto total de un registro de renta legado (renta + mantenimiento). */
function montoRentaLegacy(r: RentaRow): number {
  return totalConcepto(r.Total, r.MontoFinal) + totalConcepto(r.TotalMantenimiento, r.MontoFinalMantenimiento);
}

export async function migrarDatos(db: Connection): Promise<ResultadoMigracion> {
  const [[{ n }]] = await db.query<RowDataPacket[]>(`SELECT COUNT(*) AS n FROM Cargos`);
  if (Number(n) > 0) {
    throw new Error("La tabla Cargos ya tiene datos: la migración de datos ya se ejecutó o hay capturas nuevas.");
  }

  const [historico] = await db.query<RentaRow[]>(`SELECT * FROM HistoricoPagosRenta ORDER BY Id`);
  const [actual] = await db.query<RentaRow[]>(`SELECT * FROM RentaActual ORDER BY Id`);
  const [pagosServ] = await db.query<RowDataPacket[]>(
    `SELECT p.*, s.IdTipoServicio, s.IdContrato AS IdContratoServicio, mp.FormaPagoSat
       FROM PagosArrendatarios p
       LEFT JOIN ServiciosArrendatarios s ON s.Id = p.IdServicioArrendatario
       LEFT JOIN CatMetodosPago mp ON mp.Id = p.IdMetodoPago
      ORDER BY p.Id`,
  );

  const res: ResultadoMigracion = {
    cargosRenta: 0,
    cargosServicio: 0,
    pagos: 0,
    aplicaciones: 0,
    fusionados: 0,
    duplicadosContratoMes: [],
    omitidos: [],
  };

  // Una renta pagada del mes en curso existe en ambas tablas: se fusiona en un solo cargo.
  const historicoPagadoPorClave = new Map<string, RentaRow>();
  for (const h of historico) {
    if (h.Mes && Number(h.Pagada) === 1) {
      historicoPagadoPorClave.set(`${h.IdArrendatario}|${h.IdContrato}|${ym(new Date(h.Mes))}`, h);
    }
  }
  const fusionDe = new Map<number, number>(); // IdHistorico → IdRentaActual
  const actualesSinFusion: RentaRow[] = [];
  for (const r of actual) {
    const h =
      r.Mes && Number(r.Pagada) === 1
        ? historicoPagadoPorClave.get(`${r.IdArrendatario}|${r.IdContrato}|${ym(new Date(r.Mes))}`)
        : undefined;
    if (h && !fusionDe.has(h.Id)) {
      fusionDe.set(h.Id, r.Id);
      res.fusionados++;
    } else {
      actualesSinFusion.push(r);
    }
  }

  const clavesContratoMes = new Map<string, number>();
  const crearCargoRenta = async (r: RentaRow, legacy: { historico?: number; actual?: number }) => {
    if (r.IdArrendatario == null || r.Mes == null) {
      res.omitidos.push(
        `${legacy.historico ? `HistoricoPagosRenta ${legacy.historico}` : `RentaActual ${legacy.actual}`}: sin arrendatario o mes`,
      );
      return;
    }
    const clave = `${r.IdContrato}|${ym(new Date(r.Mes))}`;
    clavesContratoMes.set(clave, (clavesContratoMes.get(clave) ?? 0) + 1);

    const conceptos: { tipo: string; base: unknown; final: unknown }[] = [
      { tipo: "RENTA", base: r.Total, final: r.MontoFinal },
    ];
    if (r.TotalMantenimiento !== null || r.MontoFinalMantenimiento !== null) {
      conceptos.push({ tipo: "MANTENIMIENTO", base: r.TotalMantenimiento, final: r.MontoFinalMantenimiento });
    }
    const pagada = Number(r.Pagada) === 1;
    const total = conceptos.reduce((s, k) => s + totalConcepto(k.base, k.final), 0);
    const liquidado = pagada ? 1 : 0;

    const [ins] = await db.query<any>(
      `INSERT INTO Cargos (IdArrendatario, IdContrato, Clase, Mes, FechaFin, IdFormula, UsaFormula, OcupoFormula,
         FactorVariable, Total, Pagado, Saldo, Liquidado, MarcaPagadoSinMonto, Origen, Estatus,
         IdLegacyRentaActual, IdLegacyHistorico, FHRegistro)
       VALUES (?, ?, 'RENTA', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'MIGRACION', 1, ?, ?, ?)`,
      [
        r.IdArrendatario, r.IdContrato, r.Mes, r.FechaFin, r.IdFormula, r.UsaFormula, r.OcupoFormula,
        r.FactorVariable, m(total), m(pagada ? total : 0), m(pagada ? 0 : total), liquidado,
        pagada && total === 0 ? 1 : 0, legacy.actual ?? null, legacy.historico ?? null, r.FHRegistro ?? new Date(),
      ],
    );
    const idCargo = Number(ins.insertId);
    res.cargosRenta++;

    const idsConceptos: { id: number; total: number }[] = [];
    for (const k of conceptos) {
      const t = totalConcepto(k.base, k.final);
      const subtotal = Math.round(t / (1 + TASA_IVA));
      const [ic] = await db.query<any>(
        `INSERT INTO CargoConceptos (IdCargo, Tipo, MontoBase, MontoFinal, Total, TasaIva, Subtotal, Iva,
           DesgloseEstimado, Pagado, Saldo, Estatus)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?, 1)`,
        [
          idCargo, k.tipo, mOrNull(k.base), mOrNull(k.final), m(t), TASA_IVA.toFixed(4), m(subtotal),
          m(t - subtotal), m(pagada ? t : 0), m(pagada ? 0 : t),
        ],
      );
      idsConceptos.push({ id: Number(ic.insertId), total: t });
    }

    if (pagada && total > 0) {
      // Pago de migración por el total; fecha de registro como aproximación de la fecha de pago.
      const [ip] = await db.query<any>(
        `INSERT INTO Pagos (IdArrendatario, FechaPago, Monto, Aplicado, Disponible, IdCargoReferencia, Origen, Estatus, Concepto)
         VALUES (?, ?, ?, ?, '0.00', ?, 'MIGRACION', 1, 'Pago migrado (renta pagada al 100%)')`,
        [r.IdArrendatario, r.FHRegistro ?? r.Mes, m(total), m(total), idCargo],
      );
      res.pagos++;
      for (const k of idsConceptos.filter((x) => x.total > 0)) {
        await db.query(
          `INSERT INTO PagoAplicaciones (IdPago, IdCargoConcepto, Monto, Estatus) VALUES (?, ?, ?, 1)`,
          [ip.insertId, k.id, m(k.total)],
        );
        res.aplicaciones++;
      }
    }
  };

  for (const h of historico) await crearCargoRenta(h, { historico: h.Id, actual: fusionDe.get(h.Id) });
  for (const r of actualesSinFusion) await crearCargoRenta(r, { actual: r.Id });

  // Pagos de servicios → cargo de servicio + pago.
  for (const p of pagosServ) {
    if (p.IdArrendatario == null || p.FechaPago == null) {
      res.omitidos.push(`PagosArrendatarios ${p.Id}: sin arrendatario o fecha`);
      continue;
    }
    const total = c(p.Monto);
    const estatus = Number(p.Estatus);
    const pagado = estatus === 1 ? total : 0;
    const subtotal = Math.round(total / (1 + TASA_IVA));
    const [ins] = await db.query<any>(
      `INSERT INTO Cargos (IdArrendatario, IdContrato, Clase, Mes, FechaFin, Descripcion, Total, Pagado, Saldo,
         Liquidado, Origen, Estatus, IdLegacyPagoArrendatario, FHRegistro)
       VALUES (?, ?, 'SERVICIO', ?, ?, ?, ?, ?, ?, ?, 'MIGRACION', ?, ?, ?)`,
      [
        p.IdArrendatario, p.IdContratoServicio ?? null, p.FechaPago, p.FechaPagoFinal, p.Concepto, m(total),
        m(pagado), m(total - pagado), estatus === 1 && total > 0 ? 1 : 0, estatus === 0 ? 0 : 1, p.Id,
        p.FHRegistro ?? new Date(),
      ],
    );
    const idCargo = Number(ins.insertId);
    res.cargosServicio++;
    const [ic] = await db.query<any>(
      `INSERT INTO CargoConceptos (IdCargo, Tipo, IdTipoServicio, IdServicioArrendatario, Descripcion, MontoBase,
         Total, TasaIva, Subtotal, Iva, DesgloseEstimado, Pagado, Saldo, Estatus)
       VALUES (?, 'SERVICIO', ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?, 1)`,
      [
        idCargo, p.IdTipoServicio ?? null, p.IdServicioArrendatario ?? null, p.Concepto, m(total), m(total),
        TASA_IVA.toFixed(4), m(subtotal), m(total - subtotal), m(pagado), m(total - pagado),
      ],
    );
    // 1 Pagado → confirmado y aplicado; 2 Pendiente → por confirmar; 0 Cancelado → cancelado.
    const estatusPago = estatus === 1 ? 1 : estatus === 2 ? 2 : 0;
    const [ip] = await db.query<any>(
      `INSERT INTO Pagos (IdArrendatario, FechaPago, FechaPagoFinal, Monto, Aplicado, Disponible, IdMetodoPago,
         FormaPagoSat, Concepto, ComprobanteUrl, IdCargoReferencia, Origen, Estatus, IdLegacyPagoArrendatario, FHRegistro)
       VALUES (?, ?, ?, ?, ?, '0.00', ?, ?, ?, ?, ?, 'LEGACY', ?, ?, ?)`,
      [
        p.IdArrendatario, p.FechaPago, p.FechaPagoFinal, m(total), m(estatusPago === 1 ? total : 0),
        p.IdMetodoPago, p.FormaPagoSat ?? null, p.Concepto, p.ComprobantePago, idCargo, estatusPago, p.Id,
        p.FHRegistro ?? new Date(),
      ],
    );
    res.pagos++;
    if (estatusPago === 1 && total > 0) {
      await db.query(
        `INSERT INTO PagoAplicaciones (IdPago, IdCargoConcepto, Monto, Estatus) VALUES (?, ?, ?, 1)`,
        [ip.insertId, ic.insertId, m(total)],
      );
      res.aplicaciones++;
    }
  }

  res.duplicadosContratoMes = [...clavesContratoMes.entries()]
    .filter(([, veces]) => veces > 1)
    .map(([clave, veces]) => `contrato|mes ${clave}: ${veces} cargos`);
  return res;
}

// ─── Verificación (antes del COMMIT) ────────────────────────────────────────

export async function verificar(db: Connection): Promise<string[]> {
  const errores: string[] = [];
  const q = async (sql: string) => (await db.query<RowDataPacket[]>(sql))[0];

  // 1. Totales de renta por arrendatario: origen vs cargos.
  const origen = new Map<number, number>();
  const [historico] = await db.query<RentaRow[]>(`SELECT * FROM HistoricoPagosRenta`);
  const [actual] = await db.query<RentaRow[]>(`SELECT * FROM RentaActual`);
  const fusionados = new Set(
    (await q(`SELECT IdLegacyRentaActual AS id FROM Cargos WHERE IdLegacyHistorico IS NOT NULL AND IdLegacyRentaActual IS NOT NULL`)).map(
      (r) => Number(r.id),
    ),
  );
  for (const r of [...historico, ...actual.filter((a) => !fusionados.has(a.Id))]) {
    if (r.IdArrendatario == null || r.Mes == null) continue;
    origen.set(Number(r.IdArrendatario), (origen.get(Number(r.IdArrendatario)) ?? 0) + montoRentaLegacy(r));
  }
  const destino = new Map<number, number>();
  for (const r of await q(`SELECT IdArrendatario AS a, SUM(Total) AS t FROM Cargos WHERE Clase = 'RENTA' GROUP BY IdArrendatario`)) {
    destino.set(Number(r.a), c(r.t));
  }
  for (const [a, t] of origen) {
    if ((destino.get(a) ?? 0) !== t) errores.push(`Renta arrendatario ${a}: origen ${m(t)} ≠ cargos ${m(destino.get(a) ?? 0)}`);
  }

  // 2. Lo pendiente de cobro hoy debe ser igual después de migrar.
  const pendienteOrigen = [...historico, ...actual.filter((a) => !fusionados.has(a.Id))]
    .filter((r) => Number(r.Pagada) !== 1 && r.IdArrendatario != null && r.Mes != null)
    .reduce((s, r) => s + montoRentaLegacy(r), 0);
  const [[{ saldo }]] = await db.query<RowDataPacket[]>(`SELECT COALESCE(SUM(Saldo), 0) AS saldo FROM Cargos WHERE Clase = 'RENTA'`);
  if (c(saldo) !== pendienteOrigen) errores.push(`Saldo de renta: origen ${m(pendienteOrigen)} ≠ cargos ${m(c(saldo))}`);

  // 3. Servicios: mismo número de registros y misma suma.
  const [[serv]] = await db.query<RowDataPacket[]>(`SELECT COUNT(*) AS n, COALESCE(SUM(Monto), 0) AS t FROM PagosArrendatarios`);
  const [[servCargos]] = await db.query<RowDataPacket[]>(
    `SELECT COUNT(*) AS n, COALESCE(SUM(Total), 0) AS t FROM Cargos WHERE Clase = 'SERVICIO'`,
  );
  if (Number(serv.n) !== Number(servCargos.n) || c(serv.t) !== c(servCargos.t)) {
    errores.push(`Servicios: origen ${serv.n} / ${serv.t} ≠ cargos ${servCargos.n} / ${servCargos.t}`);
  }

  // 4. Consistencia interna: totales, pagado y saldos.
  for (const r of await q(`
      SELECT c.Id FROM Cargos c
        LEFT JOIN (SELECT IdCargo, SUM(Total) t FROM CargoConceptos WHERE Estatus = 1 GROUP BY IdCargo) cc ON cc.IdCargo = c.Id
       WHERE ROUND(COALESCE(cc.t, 0), 2) <> c.Total`)) errores.push(`Cargo ${r.Id}: Total ≠ suma de conceptos`);
  for (const r of await q(`
      SELECT cc.Id FROM CargoConceptos cc
        LEFT JOIN (SELECT IdCargoConcepto, SUM(Monto) p FROM PagoAplicaciones WHERE Estatus = 1 GROUP BY IdCargoConcepto) a
          ON a.IdCargoConcepto = cc.Id
       WHERE ROUND(COALESCE(a.p, 0), 2) <> cc.Pagado OR cc.Saldo <> cc.Total - cc.Pagado`))
    errores.push(`Concepto ${r.Id}: pagado/saldo no cuadra con aplicaciones`);
  for (const r of await q(`
      SELECT p.Id FROM Pagos p
        LEFT JOIN (SELECT IdPago, SUM(Monto) s FROM PagoAplicaciones WHERE Estatus = 1 GROUP BY IdPago) a ON a.IdPago = p.Id
       WHERE ROUND(COALESCE(a.s, 0), 2) <> p.Aplicado OR p.Aplicado > p.Monto`))
    errores.push(`Pago ${r.Id}: aplicado no cuadra`);

  return errores;
}
