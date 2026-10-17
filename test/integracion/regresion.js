// Regresión de lecturas: guarda las respuestas de los GET que consume el front y las compara después de un cambio.
// Sólo hace GET; no escribe datos. Firma tokens de prueba de 10 minutos con el JWT_SECRET del .env.
// Uso (desde la raíz del proyecto, con la API en ejecución):
//   npm run test:regresion -- guardar  regresion-antes.json    # antes de desplegar
//   npm run test:regresion -- comparar regresion-antes.json    # después de desplegar
// API_URL (por defecto http://localhost:3002/api), REGRESION_CLIENTE (por defecto 2) y REGRESION_USUARIO (46).
const fs = require("fs");
const prod = process.cwd();
require(prod + "/node_modules/dotenv").config({ path: prod + "/.env" });
const jwt = require(prod + "/node_modules/jsonwebtoken");
const mysql = require(prod + "/node_modules/mysql2/promise");
const e = process.env;
const API = e.API_URL || "http://localhost:3002/api";
const [modo, archivo] = process.argv.slice(2);
if (!["guardar", "comparar"].includes(modo) || !archivo) {
  console.error("Uso: regresion.js guardar|comparar <archivo.json>");
  process.exit(2);
}
const token = (c) => jwt.sign({ ...c, email: "prueba-regresion", type: "access" }, e.JWT_SECRET, { expiresIn: "10m" });
const perfiles = {
  superAdmin: token({ id: 1, cliente: 1, rol: 1 }),
  cliente: token({ id: Number(e.REGRESION_USUARIO || 46), cliente: Number(e.REGRESION_CLIENTE || 2), rol: 2 }),
};

/** Ordena llaves para que la comparación no dependa del orden de las propiedades. */
const normalizar = (v) =>
  Array.isArray(v) ? v.map(normalizar)
  : v && typeof v === "object" ? Object.fromEntries(Object.keys(v).sort().map((k) => [k, normalizar(v[k])]))
  : v;

async function get(path, tk) {
  const r = await fetch(API + path, { headers: { Authorization: `Bearer ${tk}` } });
  const text = await r.text();
  let json; try { json = JSON.parse(text); } catch { json = text; }
  return { status: r.status, json: normalizar(json) };
}

/** Diferencias entre dos valores, con la ruta de cada una (máximo `max`). */
function diferencias(a, b, ruta = "", out = [], max = 10) {
  if (out.length >= max) return out;
  if (JSON.stringify(a) === JSON.stringify(b)) return out;
  if (a && b && typeof a === "object" && typeof b === "object") {
    for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) diferencias(a[k], b[k], `${ruta}.${k}`, out, max);
  } else {
    out.push(`${ruta || "(raíz)"}: ${JSON.stringify(a)} → ${JSON.stringify(b)}`);
  }
  return out;
}

(async () => {
  // Ids de referencia del cliente de prueba, para los GET por id.
  const db = await mysql.createConnection({ host: e.DB_HOST, port: Number(e.DB_PORT || 3306), user: e.DB_USER, password: e.DB_PASSWORD, database: e.DB_DATABASE });
  const cli = Number(e.REGRESION_CLIENTE || 2);
  const [[ref]] = await db.query(
    `SELECT t.Id arr, (SELECT i.Id FROM Inmuebles i WHERE i.IdArrendador=a.Id ORDER BY i.Id LIMIT 1) inm
       FROM Arrendatarios t JOIN Arrendadores a ON a.Id=t.IdArrendador
      WHERE a.IdCliente=? AND t.Estatus=1 ORDER BY t.Id LIMIT 1`, [cli]);
  await db.end();

  const rutas = [
    "/renta-actual/paginated?page=1&limit=50",
    "/historico-pagos-renta/paginated?page=1&limit=50",
    "/historico-pagos-renta/ultimo",
    "/pagos-arrendatarios/paginated?page=1&limit=50",
    "/notificaciones",
    "/arrendatarios/paginated?page=1&limit=50",
    "/arrendatarios/listado",
    "/inmuebles/paginated?page=1&limit=50",
    ...(ref ? [
      `/arrendatarios/dashboard/${ref.arr}`,
      `/arrendatarios/servicios/${ref.arr}`,
      `/inmuebles/dashboard/${ref.inm}`,
      `/inmuebles/locales/${ref.inm}`,
    ] : []),
  ];

  const actual = {};
  for (const [perfil, tk] of Object.entries(perfiles)) {
    for (const ruta of rutas) actual[`${perfil} ${ruta}`] = await get(ruta, tk);
  }

  if (modo === "guardar") {
    fs.writeFileSync(archivo, JSON.stringify(actual, null, 1));
    const estados = Object.values(actual).map((r) => r.status);
    console.log(`Guardadas ${estados.length} respuestas en ${archivo} (${estados.filter((s) => s === 200).length} con 200).`);
    return;
  }

  const antes = JSON.parse(fs.readFileSync(archivo, "utf8"));
  let iguales = 0, distintas = 0;
  for (const clave of Object.keys({ ...antes, ...actual })) {
    const difs = diferencias(antes[clave], actual[clave]);
    if (difs.length === 0) { iguales++; continue; }
    distintas++;
    console.log(`  ≠ ${clave}`);
    for (const d of difs) console.log(`      ${d}`);
  }
  console.log(`\nResultado: ${iguales} iguales, ${distintas} distintas (revisar si las diferencias son esperadas).`);
  process.exitCode = distintas ? 1 : 0;
})();
