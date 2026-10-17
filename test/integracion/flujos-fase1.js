// Flujos de pagos parciales (fase 1) sobre la base del .env, dentro de una transacción que se REVIERTE al final.
// Uso (desde la raíz del proyecto, después de `npm run build`): npm run test:flujos
const base = process.cwd();
require(base + "/node_modules/dotenv").config({ path: base + "/.env" });
require(base + "/node_modules/reflect-metadata");
const { DataSource } = require(base + "/node_modules/typeorm");
const { CobranzaService } = require(base + "/dist/cobranza/cobranza.service");
const e = process.env;
const ds = new DataSource({ type: "mysql", host: e.DB_HOST, port: Number(e.DB_PORT || 3306), username: e.DB_USER, password: e.DB_PASSWORD,
  database: e.DB_DATABASE, entities: [base + "/dist/entities/*.js"], synchronize: false, timezone: "-06:00" });
const svc = new CobranzaService();
let ok = 0, fallas = 0;
const check = (cond, msg) => { if (cond) { ok++; console.log("  ✔", msg); } else { fallas++; console.log("  ✘", msg); } };
const cargo = async (m, id) => (await m.query("SELECT Total, Pagado, Saldo, Liquidado FROM Cargos WHERE Id = ?", [id]))[0];
const pago = async (m, id) => (await m.query("SELECT Monto, Aplicado, Disponible, Estatus FROM Pagos WHERE Id = ?", [id]))[0];
(async () => {
  await ds.initialize();
  const antes = await ds.query("SELECT (SELECT COUNT(*) FROM Cargos) c, (SELECT COUNT(*) FROM Pagos) p, (SELECT COUNT(*) FROM PagoAplicaciones) a, (SELECT SUM(Saldo) FROM Cargos) s");
  const qr = ds.createQueryRunner(); await qr.connect(); await qr.startTransaction(); const m = qr.manager;
  try {
    // Arrendatario con al menos dos cargos de renta pendientes con saldo.
    const [sel] = await m.query(`SELECT IdArrendatario FROM Cargos WHERE Clase='RENTA' AND Estatus=1 AND Liquidado=0 AND Saldo > 20000
                                  GROUP BY IdArrendatario HAVING COUNT(*) >= 2 LIMIT 1`);
    const arr = Number(sel.IdArrendatario);
    const [c1, c2] = await m.query(`SELECT Id FROM Cargos WHERE IdArrendatario=? AND Clase='RENTA' AND Estatus=1 AND Liquidado=0 ORDER BY Mes LIMIT 2`, [arr]);
    const con1 = (await m.query(`SELECT Id, Total FROM CargoConceptos WHERE IdCargo=? AND Tipo='RENTA'`, [c1.Id]))[0];
    const con2 = (await m.query(`SELECT Id, Total FROM CargoConceptos WHERE IdCargo=? AND Tipo='RENTA'`, [c2.Id]))[0];
    const t1 = Math.round(Number(con1.Total) * 100);
    console.log(`Arrendatario ${arr}; cargo A=${c1.Id} (renta ${con1.Total}), cargo B=${c2.Id} (renta ${con2.Total})`);

    console.log("1. Pago parcial de 10,000 al cargo A");
    const p1 = await svc.registrarPago(m, { idArrendatario: arr, fechaPago: new Date(), monto: 10000, origen: "CAPTURA" }, [{ idCargoConcepto: Number(con1.Id), monto: 10000 }]);
    let a = await cargo(m, c1.Id);
    check(Number(a.Pagado) >= 10000 && Number(a.Liquidado) === 0, `cargo A parcial: pagado ${a.Pagado}, saldo ${a.Saldo}`);

    console.log("2. Complemento en una segunda exhibición de 3,000");
    const p2 = await svc.registrarPago(m, { idArrendatario: arr, fechaPago: new Date(), monto: 3000, origen: "CAPTURA" }, [{ idCargoConcepto: Number(con1.Id), monto: 3000 }]);
    const saldoTrasP2 = Number((await cargo(m, c1.Id)).Saldo);
    check(Math.abs(saldoTrasP2 - (Number(a.Saldo) - 3000)) < 0.01, `saldo bajó 3,000 → ${saldoTrasP2}`);

    console.log("3. Pago con excedente: cubre el resto de la renta de A y deja 5,000 a favor");
    const [conRest] = await m.query("SELECT Saldo FROM CargoConceptos WHERE Id=?", [con1.Id]);
    const resto = Number(conRest.Saldo);
    const p3 = await svc.registrarPago(m, { idArrendatario: arr, fechaPago: new Date(), monto: resto + 5000, origen: "CAPTURA" }, [{ idCargoConcepto: Number(con1.Id), monto: resto }]);
    const [con1Final] = await m.query("SELECT Saldo FROM CargoConceptos WHERE Id=?", [con1.Id]);
    check(Number(con1Final.Saldo) === 0, "renta de A sin saldo");
    let pp3 = await pago(m, p3);
    check(Number(pp3.Disponible) === 5000, `pago 3 con saldo a favor de ${pp3.Disponible}`);

    console.log("4. Aplicar el saldo a favor al cargo B (meses después, decisión del usuario)");
    await svc.aplicar(m, p3, [{ idCargoConcepto: Number(con2.Id), monto: 5000 }], null);
    pp3 = await pago(m, p3);
    check(Number(pp3.Disponible) === 0, "saldo a favor aplicado por completo");
    check(Number((await cargo(m, c2.Id)).Pagado) >= 5000, "cargo B con 5,000 pagados (parcial)");

    console.log("5. Validaciones: exceder el saldo o el disponible se rechaza");
    let rechazado = false;
    try { await svc.aplicar(m, p1, [{ idCargoConcepto: Number(con2.Id), monto: 1 }], null); } catch { rechazado = true; }
    check(rechazado, "no se puede aplicar más de lo disponible del pago");
    rechazado = false;
    try { await svc.registrarPago(m, { idArrendatario: arr, fechaPago: new Date(), monto: 99999999, origen: "CAPTURA" }, [{ idCargoConcepto: Number(con2.Id), monto: 99999999 }]); } catch { rechazado = true; }
    check(rechazado, "no se puede aplicar más que el saldo del concepto");

    console.log("6. Cancelar el pago 2 (mal capturado): el saldo de A se recalcula");
    await svc.cancelarPago(m, p2, "prueba", null);
    const [con1Tras] = await m.query("SELECT Saldo FROM CargoConceptos WHERE Id=?", [con1.Id]);
    check(Number(con1Tras.Saldo) === 3000, `renta de A vuelve a deber 3,000 (saldo ${con1Tras.Saldo})`);
    check(Number((await pago(m, p2)).Estatus) === 0, "pago 2 cancelado");

    console.log("7. Liquidar el saldo completo de B (equivale a marcar pagada)");
    await svc.liquidarCargo(m, Number(c2.Id), { origen: "CAPTURA" });
    const b = await cargo(m, c2.Id);
    check(Number(b.Liquidado) === 1 && Number(b.Saldo) === 0, "cargo B liquidado");

    console.log("8. Consistencia: pagado de cada cargo = suma de aplicaciones vigentes");
    const [inc] = await m.query(`SELECT COUNT(*) n FROM Cargos c LEFT JOIN (SELECT cc.IdCargo, SUM(pa.Monto) s FROM PagoAplicaciones pa
       JOIN CargoConceptos cc ON cc.Id=pa.IdCargoConcepto WHERE pa.Estatus=1 GROUP BY cc.IdCargo) x ON x.IdCargo=c.Id
       WHERE ROUND(COALESCE(x.s,0),2) <> c.Pagado`);
    check(Number(inc.n) === 0, "sin descuadres en ningún cargo");
  } catch (err) { fallas++; console.log("  ✘ error inesperado:", err.message); }
  finally { await qr.rollbackTransaction(); await qr.release(); }
  const despues = await ds.query("SELECT (SELECT COUNT(*) FROM Cargos) c, (SELECT COUNT(*) FROM Pagos) p, (SELECT COUNT(*) FROM PagoAplicaciones) a, (SELECT SUM(Saldo) FROM Cargos) s");
  console.log(`\nROLLBACK hecho. Antes ${JSON.stringify(antes[0])} · después ${JSON.stringify(despues[0])} → ${JSON.stringify(antes[0]) === JSON.stringify(despues[0]) ? "sin residuos" : "¡DIFERENCIA!"}`);
  console.log(`Resultado: ${ok} OK, ${fallas} fallas`);
  process.exitCode = fallas ? 1 : 0;
  await ds.destroy();
})();
