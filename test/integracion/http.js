// Pruebas HTTP contra la API en ejecución (API_URL, por defecto http://localhost:3002/api).
// Sólo lecturas y peticiones que deben rechazarse antes de guardar: no escribe datos.
// Firma tokens de prueba de 10 minutos con el JWT_SECRET del .env. Uso: npm run test:http
const prod = process.cwd();
require(prod + "/node_modules/dotenv").config({ path: prod + "/.env" });
const jwt = require(prod + "/node_modules/jsonwebtoken");
const mysql = require(prod + "/node_modules/mysql2/promise");
const e = process.env;
const API = process.env.API_URL || "http://localhost:3002/api";
const token = (c) => jwt.sign({ ...c, email: "prueba-http", type: "access" }, e.JWT_SECRET, { expiresIn: "10m" });
const SA = token({ id: 1, cliente: 1, rol: 1 });
let ok = 0, fallas = 0;
const check = (cond, msg, extra = "") => { if (cond) { ok++; console.log("  ✔", msg); } else { fallas++; console.log("  ✘", msg, extra); } };
async function call(method, path, tk, body, isForm) {
  const headers = { Authorization: `Bearer ${tk}` };
  let payload;
  if (isForm) payload = body; else if (body !== undefined) { headers["Content-Type"] = "application/json"; payload = JSON.stringify(body); }
  const r = await fetch(API + path, { method, headers, body: payload });
  const text = await r.text();
  let json; try { json = JSON.parse(text); } catch { json = text; }
  return { status: r.status, json };
}

(async () => {
  const db = await mysql.createConnection({ host: e.DB_HOST, port: Number(e.DB_PORT || 3306), user: e.DB_USER, password: e.DB_PASSWORD, database: e.DB_DATABASE });
  const firma = async () => JSON.stringify((await db.query(
    "SELECT (SELECT COUNT(*) FROM Cargos) c, (SELECT COUNT(*) FROM CargoConceptos) k, (SELECT COUNT(*) FROM Pagos) p, (SELECT COUNT(*) FROM PagoAplicaciones) a, (SELECT SUM(Saldo) FROM Cargos) s"))[0][0]);
  const antes = await firma();

  // Datos de referencia: un arrendatario de cliente 2 con cargos con saldo, y uno de otro cliente.
  const [[ref]] = await db.query(`SELECT c.IdArrendatario arr, a.IdCliente cli FROM Cargos c JOIN Arrendatarios t ON t.Id=c.IdArrendatario
     JOIN Arrendadores a ON a.Id=t.IdArrendador WHERE c.Clase='RENTA' AND c.Saldo>0 AND a.IdCliente=2 LIMIT 1`);
  const [[ajeno]] = await db.query(`SELECT c.Id cargo, c.IdArrendatario arr FROM Cargos c JOIN Arrendatarios t ON t.Id=c.IdArrendatario
     JOIN Arrendadores a ON a.Id=t.IdArrendador WHERE a.IdCliente<>2 LIMIT 1`);
  const [[pagoMig]] = await db.query(`SELECT p.Id id FROM Pagos p JOIN Arrendatarios t ON t.Id=p.IdArrendatario JOIN Arrendadores a ON a.Id=t.IdArrendador WHERE a.IdCliente=2 LIMIT 1`);
  const C2 = token({ id: 46, cliente: 2, rol: 2 });
  const arr = Number(ref.arr);

  console.log("Lecturas");
  let r = await call("GET", "/cargos?page=1&limit=5&estado=CON_SALDO", SA);
  check(r.status === 200 && Array.isArray(r.json.data) && r.json.paginated.total > 0, `GET /cargos (SA): ${r.status}, total ${r.json?.paginated?.total}`);
  const cargo = r.json.data[0];
  check(cargo && cargo.conceptos?.length > 0 && typeof cargo.saldo === "string", "cargos traen conceptos y montos como texto");
  r = await call("GET", `/cargos/${cargo.id}`, SA);
  check(r.status === 200 && Array.isArray(r.json.aplicaciones), `GET /cargos/:id: ${r.status}`);
  r = await call("GET", "/pagos?page=1&limit=5", SA);
  check(r.status === 200 && r.json.paginated.total > 0, `GET /pagos (SA): total ${r.json?.paginated?.total}`);
  r = await call("GET", `/pagos/${pagoMig.id}`, C2);
  check(r.status === 200 && r.json.estatus, `GET /pagos/:id (cliente 2, pago propio): ${r.status} ${r.json?.estatus}`);
  r = await call("GET", "/pagos?page=1&limit=5&conDisponible=true", SA);
  check(r.status === 200, `GET /pagos?conDisponible=true: ${r.status}`);
  r = await call("GET", `/arrendatarios/${arr}/estado-cuenta`, C2);
  check(r.status === 200 && r.json.resumen && Number(r.json.resumen.saldoTotal) > 0, `GET estado-cuenta (cliente 2): saldo ${r.json?.resumen?.saldoTotal}, vencido ${r.json?.resumen?.saldoVencido}`);
  r = await call("GET", `/arrendatarios/${arr}/estado-cuenta?fechaInicio=2026-01-01&fechaFin=2026-12-31`, C2);
  check(r.status === 200, `estado-cuenta con rango: ${r.status}`);
  r = await call("GET", "/cargos?page=1&limit=500", C2);
  check(r.status === 200 && r.json.data.every((c) => Number(c.idArrendatario) !== Number(ajeno.arr)), "cliente 2 sólo ve sus cargos");

  console.log("Aislamiento entre clientes (404 sin revelar existencia)");
  r = await call("GET", `/cargos/${ajeno.cargo}`, C2);
  check(r.status === 404, `GET cargo ajeno: ${r.status}`);
  r = await call("GET", `/arrendatarios/${ajeno.arr}/estado-cuenta`, C2);
  check(r.status === 404, `estado de cuenta ajeno: ${r.status}`);
  r = await call("POST", "/pagos", C2, { idArrendatario: Number(ajeno.arr), fechaPago: "2026-10-17", monto: 10 });
  check(r.status === 404, `registrar pago a arrendatario ajeno: ${r.status}`);
  r = await call("POST", `/cargos`, C2, { idArrendatario: Number(ajeno.arr), clase: "SERVICIO", fecha: "2026-10-17", conceptos: [{ total: 10 }] });
  check(r.status === 404, `crear cargo a arrendatario ajeno: ${r.status}`);

  console.log("Autenticación");
  r = await fetch(API + "/cargos").then((x) => x.status);
  check(r === 401, `sin token: ${r}`);

  console.log("Validación de DTOs (400 antes de guardar)");
  r = await call("POST", "/pagos", C2, { idArrendatario: arr, fechaPago: "no-es-fecha", monto: -5 });
  check(r.status === 400, `fecha inválida y monto negativo: ${r.status}`, JSON.stringify(r.json).slice(0, 200));
  r = await call("POST", "/pagos", C2, { idArrendatario: arr, fechaPago: "2026-10-17", monto: 10, campoExtra: 1 });
  check(r.status === 400, `campo no permitido: ${r.status}`);
  r = await call("POST", "/pagos", C2, { idArrendatario: arr, fechaPago: "2026-10-17", monto: 10, aplicaciones: [{ idCargoConcepto: 1, monto: 0 }] });
  check(r.status === 400, `aplicación con monto 0: ${r.status}`);
  r = await call("POST", "/pagos", C2, { idArrendatario: arr, fechaPago: "2026-10-17", monto: 10, formaPagoSat: "3" });
  check(r.status === 400, `forma de pago SAT inválida: ${r.status}`);
  r = await call("POST", "/cargos", C2, { idArrendatario: arr, clase: "RENTA", fecha: "2026-10-17", conceptos: [{ total: 10 }] });
  check(r.status === 400, `clase RENTA no permitida en /cargos: ${r.status}`);
  r = await call("POST", "/cargos", C2, { idArrendatario: arr, clase: "SERVICIO", fecha: "2026-10-17", conceptos: [] });
  check(r.status === 400, `cargo sin conceptos: ${r.status}`);
  r = await call("PATCH", `/pagos/${pagoMig.id}/cancelar`, C2, {});
  check(r.status === 400, `cancelar sin motivo: ${r.status}`);
  r = await call("GET", "/cargos?estado=INVALIDO", C2);
  check(r.status === 400, `filtro de estado inválido: ${r.status}`);

  console.log("Reglas de negocio vía HTTP (rechazadas antes de guardar)");
  const conceptoId = cargo.conceptos[0].id;
  r = await call("POST", "/pagos", SA, { idArrendatario: Number(cargo.idArrendatario), fechaPago: "2026-10-17", monto: 10, aplicaciones: [{ idCargoConcepto: conceptoId, monto: 20 }] });
  check(r.status === 400 && /exceden/.test(JSON.stringify(r.json)), `aplicaciones mayores al monto: ${r.status}`);
  const form = new FormData();
  form.append("idArrendatario", String(cargo.idArrendatario));
  form.append("fechaPago", "2026-10-17");
  form.append("monto", "10");
  form.append("aplicaciones", JSON.stringify([{ idCargoConcepto: conceptoId, monto: 20 }]));
  r = await call("POST", "/pagos", SA, form, true);
  check(r.status === 400 && /exceden/.test(JSON.stringify(r.json)), `multipart: 'aplicaciones' como texto JSON se interpreta (rechazo por exceder): ${r.status}`);
  const formMal = new FormData();
  formMal.append("idArrendatario", String(cargo.idArrendatario));
  formMal.append("fechaPago", "2026-10-17");
  formMal.append("monto", "10");
  formMal.append("comprobante", new Blob(["hola"], { type: "text/plain" }), "x.txt");
  r = await call("POST", "/pagos", SA, formMal, true);
  check(r.status >= 400 && r.status < 500, `multipart: comprobante con tipo no permitido rechazado: ${r.status}`);
  r = await call("POST", `/pagos/${pagoMig.id}/aplicaciones`, C2, { aplicaciones: [{ idCargoConcepto: conceptoId, monto: 1 }] });
  check(r.status === 400, `aplicar más del disponible de un pago ya aplicado: ${r.status}`);
  r = await call("DELETE", `/pagos/${pagoMig.id}/aplicaciones/999999999`, C2);
  check(r.status === 404, `anular aplicación inexistente: ${r.status}`);

  console.log("Compatibilidad");
  r = await call("GET", "/renta-actual/paginated?page=1&limit=3", C2);
  check(r.status === 200 && r.json.data[0] && "estadoPago" in r.json.data[0] && "desglose" in r.json.data[0], "renta-actual conserva forma y agrega estadoPago");

  const despues = await firma();
  console.log(`\nDatos: ${antes === despues ? "sin cambios (ninguna prueba escribió)" : `¡CAMBIARON! antes ${antes} después ${despues}`}`);
  console.log(`Resultado: ${ok} OK, ${fallas} fallas`);
  process.exitCode = fallas ? 1 : 0;
  await db.end();
})();
