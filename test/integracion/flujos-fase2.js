// Flujos de la fase 2 (pagos, aplicaciones, saldo a favor, cancelación, estado de cuenta) sobre la base del .env,
// dentro de una transacción que se REVIERTE al final.
// Uso (desde la raíz del proyecto, después de `npm run build`): npm run test:flujos
const prod = process.cwd();
const dir = prod;
require(prod + "/node_modules/dotenv").config({ path: prod + "/.env" });
require(prod + "/node_modules/reflect-metadata");
const { DataSource } = require(prod + "/node_modules/typeorm");
const { CobranzaService } = require(dir + "/dist/cobranza/cobranza.service");
const { CobranzaApiService } = require(dir + "/dist/cobranza/cobranza-api.service");
const { TenantAccessService } = require(dir + "/dist/common/tenant-access/tenant-access.service");
const e = process.env;
const ds = new DataSource({
  type: "mysql", host: e.DB_HOST, port: Number(e.DB_PORT || 3306), username: e.DB_USER, password: e.DB_PASSWORD,
  database: e.DB_DATABASE, entities: [dir + "/dist/entities/*.js"], synchronize: false, timezone: "-06:00",
});
let ok = 0, fallas = 0;
const check = (cond, msg) => { if (cond) { ok++; console.log("  ✔", msg); } else { fallas++; console.log("  ✘", msg); } };
const SA = { userId: 1, cliente: 1, rol: 1 };

(async () => {
  await ds.initialize();
  const firma = async () => JSON.stringify((await ds.query(
    "SELECT (SELECT COUNT(*) FROM Cargos) c, (SELECT COUNT(*) FROM Pagos) p, (SELECT COUNT(*) FROM PagoAplicaciones) a, (SELECT SUM(Saldo) FROM Cargos) s, (SELECT COUNT(*) FROM Bitacora) b"))[0]);
  const antes = await firma();
  const qr = ds.createQueryRunner(); await qr.connect(); await qr.startTransaction(); const m = qr.manager;
  // DataSource "falso": todo pasa por la transacción abierta.
  const fakeDs = { manager: m, transaction: (fn) => fn(m), query: (...a) => m.query(...a) };
  const api = new CobranzaApiService(fakeDs, new CobranzaService(), new TenantAccessService(fakeDs));
  try {
    const [sel] = await m.query(`SELECT IdArrendatario FROM Cargos WHERE Clase='RENTA' AND Estatus=1 AND Liquidado=0 AND Saldo > 20000
                                  GROUP BY IdArrendatario HAVING COUNT(*) >= 2 LIMIT 1`);
    const arr = Number(sel.IdArrendatario);
    console.log(`Arrendatario de prueba: ${arr}`);

    console.log("1. Estado de cuenta inicial");
    const ec0 = await api.estadoCuenta(arr, {});
    check(Number(ec0.resumen.saldoTotal) > 0 && ec0.cargos.length >= 2, `saldo total ${ec0.resumen.saldoTotal}, vencido ${ec0.resumen.saldoVencido}, ${ec0.cargos.length} cargos con saldo`);
    const [cA, cB] = ec0.cargos;
    const rentaA = cA.conceptos.find((k) => k.tipo === "RENTA");
    const rentaB = cB.conceptos.find((k) => k.tipo === "RENTA");

    console.log("2. POST /pagos: pago de 8,000 aplicando 6,000 a la renta de A (2,000 a favor)");
    const r1 = await api.registrarPago({ idArrendatario: arr, fechaPago: "2026-10-12", monto: 8000, idMetodoPago: 1,
      referencia: "PRUEBA", aplicaciones: [{ idCargoConcepto: rentaA.id, monto: 6000 }] }, undefined, SA);
    check(r1.data.disponible === "2000.00" && r1.data.formaPagoSat === "03", `pago ${r1.data.id}: aplicado ${r1.data.aplicado}, disponible ${r1.data.disponible}, forma SAT ${r1.data.formaPagoSat}`);
    const cargoA1 = await api.obtenerCargo(cA.id);
    check(cargoA1.estadoPago === "PARCIAL" && cargoA1.aplicaciones.length >= 1, `cargo A ${cargoA1.estadoPago}, saldo ${cargoA1.saldo}`);

    console.log("3. Validación: aplicaciones mayores al monto del pago se rechazan");
    let rechazado = false;
    try { await api.registrarPago({ idArrendatario: arr, fechaPago: "2026-10-12", monto: 100, aplicaciones: [{ idCargoConcepto: rentaA.id, monto: 200 }] }, undefined, SA); }
    catch (err) { rechazado = /exceden/.test(err.message); }
    check(rechazado, "rechaza aplicar 200 de un pago de 100");

    console.log("4. GET /pagos?conDisponible=true lista el saldo a favor");
    const conDisp = await api.listarPagos({ page: 1, limit: 50, idArrendatario: arr, conDisponible: true }, SA);
    check(conDisp.data.some((p) => p.id === r1.data.id), "el pago con 2,000 a favor aparece");

    console.log("5. POST /pagos/:id/aplicaciones: aplicar los 2,000 a la renta de B");
    const r2 = await api.aplicarPago(r1.data.id, [{ idCargoConcepto: rentaB.id, monto: 2000 }], SA);
    check(r2.data.disponible === "0.00" && r2.data.aplicaciones.filter((a) => a.vigente).length === 2, "saldo a favor aplicado; 2 aplicaciones vigentes");

    console.log("6. DELETE /pagos/:id/aplicaciones/:idAplicacion: anular la aplicación a B");
    const apB = r2.data.aplicaciones.find((a) => a.concepto.id === rentaB.id && a.vigente);
    const r3 = await api.anularAplicacion(r1.data.id, apB.id, SA);
    check(r3.data.disponible === "2000.00", "los 2,000 vuelven a ser saldo a favor");
    rechazado = false;
    try { await api.anularAplicacion(r1.data.id + 99999, apB.id, SA); } catch { rechazado = true; }
    check(rechazado, "no se puede anular una aplicación desde otro pago");

    console.log("7. PATCH /pagos/:id/cancelar: el cargo A vuelve a su saldo original");
    const r4 = await api.cancelarPago(r1.data.id, "Prueba de cancelación", SA);
    const cargoA2 = await api.obtenerCargo(cA.id);
    check(r4.data.estatus === "CANCELADO" && r4.data.disponible === "0.00", "pago cancelado y sin disponible");
    check(cargoA2.saldo === cA.saldo && cargoA2.estadoPago === cA.estadoPago, `cargo A regresa a saldo ${cargoA2.saldo} (${cargoA2.estadoPago})`);

    console.log("8. POST /cargos: cargo de luz con desglose capturado, y pago parcial en dos exhibiciones");
    const c1 = await api.crearCargo({ idArrendatario: arr, clase: "SERVICIO", fecha: "2026-09-30", descripcion: "Luz septiembre (prueba)",
      conceptos: [{ idTipoServicio: 6, total: 1740, subtotal: 1500, iva: 240 }] }, SA);
    const luz = c1.data.conceptos[0];
    check(c1.data.clase === "SERVICIO" && luz.subtotal === "1500.00" && luz.iva === "240.00" && !luz.desgloseEstimado, "cargo de luz con subtotal/IVA capturados");
    await api.registrarPago({ idArrendatario: arr, fechaPago: "2026-10-01", monto: 1000, aplicaciones: [{ idCargoConcepto: luz.id, monto: 1000 }] }, undefined, SA);
    await api.registrarPago({ idArrendatario: arr, fechaPago: "2026-10-15", monto: 740, aplicaciones: [{ idCargoConcepto: luz.id, monto: 740 }] }, undefined, SA);
    const luzFinal = await api.obtenerCargo(c1.data.id);
    check(luzFinal.estadoPago === "PAGADO" && luzFinal.aplicaciones.length === 2, "luz pagada en 2 exhibiciones");

    console.log("9. Validación: subtotal + IVA debe coincidir con el total");
    rechazado = false;
    try { await api.crearCargo({ idArrendatario: arr, clase: "SERVICIO", fecha: "2026-09-30", conceptos: [{ total: 1000, subtotal: 800, iva: 100 }] }, SA); }
    catch (err) { rechazado = /no coincide/.test(err.message); }
    check(rechazado, "rechaza desglose que no suma");

    console.log("10. PATCH /cargos/:id/cancelar: no se permite con pagos aplicados; sí sin pagos");
    rechazado = false;
    try { await api.cancelarCargo(c1.data.id, "prueba", SA); } catch { rechazado = true; }
    check(rechazado, "cargo con pagos aplicados no se cancela");
    const c2 = await api.crearCargo({ idArrendatario: arr, clase: "OTRO", fecha: "2026-10-01", descripcion: "Penalización (prueba)", conceptos: [{ total: 500 }] }, SA);
    const r5 = await api.cancelarCargo(c2.data.id, "Capturado por error", SA);
    check(r5.data.estadoPago === "CANCELADO", "cargo sin pagos cancelado");

    console.log("11. Contrato cancelado: no se crean cargos nuevos, pero sí se aceptan pagos de lo que debe");
    const [cto] = await m.query(`SELECT IdContrato FROM Cargos WHERE Id = ?`, [cB.id]);
    await m.query(`UPDATE ContratoArrendatarios SET Estatus = 0 WHERE Id = ?`, [cto.IdContrato]);
    rechazado = false;
    try { await api.crearCargo({ idArrendatario: arr, idContrato: Number(cto.IdContrato), clase: "SERVICIO", fecha: "2026-10-01", conceptos: [{ total: 100 }] }, SA); }
    catch (err) { rechazado = /contrato cancelado/.test(err.message); }
    check(rechazado, "rechaza cargo nuevo en contrato cancelado");
    const r6 = await api.registrarPago({ idArrendatario: arr, fechaPago: "2026-10-16", monto: 1000, aplicaciones: [{ idCargoConcepto: rentaB.id, monto: 1000 }] }, undefined, SA);
    check(r6.data.aplicado === "1000.00", "acepta pago aplicado a un cargo del contrato cancelado");

    console.log("12. Alcance por cliente: un usuario de otro cliente no ve los cargos de este arrendatario");
    const [cli] = await m.query(`SELECT a.IdCliente FROM Arrendatarios t JOIN Arrendadores a ON a.Id = t.IdArrendador WHERE t.Id = ?`, [arr]);
    const otro = { userId: 999, cliente: Number(cli.IdCliente) === 2 ? 3 : 2, rol: 2 };
    const ajenos = await api.listarCargos({ page: 1, limit: 5, idArrendatario: arr }, otro);
    const propios = await api.listarCargos({ page: 1, limit: 5, idArrendatario: arr }, { userId: 999, cliente: Number(cli.IdCliente), rol: 2 });
    check(ajenos.paginated.total === 0 && propios.paginated.total > 0, `otro cliente ve ${ajenos.paginated.total}; su cliente ve ${propios.paginated.total}`);
    rechazado = false;
    try { await api.registrarPago({ idArrendatario: arr, fechaPago: "2026-10-16", monto: 10 }, undefined, otro); } catch { rechazado = true; }
    check(rechazado, "otro cliente no puede registrar pagos a este arrendatario");

    console.log("13. Estado de cuenta final y consistencia");
    const ec1 = await api.estadoCuenta(arr, { fechaInicio: "2026-01-01", fechaFin: "2026-12-31" });
    check(Number(ec1.resumen.saldoTotal) < Number(ec0.resumen.saldoTotal), `saldo total bajó de ${ec0.resumen.saldoTotal} a ${ec1.resumen.saldoTotal}`);
    const [inc] = await m.query(`SELECT COUNT(*) n FROM Cargos c LEFT JOIN (SELECT cc.IdCargo, SUM(pa.Monto) s FROM PagoAplicaciones pa
       JOIN CargoConceptos cc ON cc.Id = pa.IdCargoConcepto WHERE pa.Estatus = 1 GROUP BY cc.IdCargo) x ON x.IdCargo = c.Id
       WHERE ROUND(COALESCE(x.s, 0), 2) <> c.Pagado`);
    check(Number(inc.n) === 0, "sin descuadres entre cargos y aplicaciones");
  } catch (err) { fallas++; console.log("  ✘ error inesperado:", err.stack || err.message); }
  finally { await qr.rollbackTransaction(); await qr.release(); }
  const despues = await firma();
  console.log(`\nROLLBACK hecho → ${antes === despues ? "sin residuos" : `¡DIFERENCIA! antes ${antes} después ${despues}`}`);
  console.log(`Resultado: ${ok} OK, ${fallas} fallas`);
  process.exitCode = fallas ? 1 : 0;
  await ds.destroy();
})();
