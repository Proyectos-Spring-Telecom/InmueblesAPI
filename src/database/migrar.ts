/**
 * Ejecutor de migraciones de base de datos.
 *
 *   node dist/database/migrar.js                       aplica las migraciones pendientes
 *   node dist/database/migrar.js --dry-run             ejecuta, verifica y hace ROLLBACK (no cambia datos)
 *   node dist/database/migrar.js --db=Inmuebles_prueba  usa otra base (pruebas)
 *
 * Toma la conexión del .env de la API. El DDL (CREATE TABLE) no es transaccional en MySQL,
 * pero sólo crea tablas nuevas vacías; la migración de datos corre en una transacción y sólo
 * se confirma si la verificación no encuentra diferencias.
 */
import { join } from "path";
import { config } from "dotenv";
import { createConnection } from "mysql2/promise";
import * as m001 from "./migraciones/001-pagos-parciales";

config({ path: join(__dirname, "..", "..", ".env") });

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes("--dry-run");
  const database = args.find((a) => a.startsWith("--db="))?.slice(5) ?? process.env.DB_DATABASE ?? "Inmuebles";

  const db = await createConnection({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT ?? 3306),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database,
    timezone: process.env.DB_TZ ?? "-06:00",
    multipleStatements: false,
  });
  console.log(`Base: ${database}${dryRun ? " (dry-run: no se confirmará nada)" : ""}`);

  try {
    for (const sql of m001.DDL) await db.query(sql);
    await m001.asegurarColumnaFormaPago(db, database);

    const [aplicada] = await db.query<any[]>(`SELECT Version FROM SchemaMigrations WHERE Version = ?`, [m001.VERSION]);
    if (aplicada.length > 0) {
      console.log(`${m001.VERSION}: ya aplicada. Nada que hacer.`);
      return;
    }

    await db.beginTransaction();
    // Catálogo SAT de formas de pago (03 transferencia, 01 efectivo/depósito, 02 cheque, 04 crédito, 28 débito).
    await db.query(
      `UPDATE CatMetodosPago SET FormaPagoSat = CASE Id WHEN 1 THEN '03' WHEN 2 THEN '01' WHEN 3 THEN '01' WHEN 4 THEN '02' WHEN 5 THEN '04' ELSE FormaPagoSat END`,
    );
    await db.query(
      `INSERT INTO CatMetodosPago (Nombre, Estatus, FormaPagoSat)
       SELECT 'Tarjeta de Débito', 1, '28' FROM DUAL
        WHERE NOT EXISTS (SELECT 1 FROM CatMetodosPago WHERE Nombre = 'Tarjeta de Débito')`,
    );

    const resultado = await m001.migrarDatos(db);
    console.log("Migración de datos:", JSON.stringify(resultado, null, 2));

    const errores = await m001.verificar(db);
    if (errores.length > 0) {
      await db.rollback();
      console.error(`VERIFICACIÓN FALLIDA (${errores.length}); se hizo ROLLBACK, no cambió ningún dato:`);
      for (const e of errores) console.error(` - ${e}`);
      process.exitCode = 1;
      return;
    }
    console.log("Verificación: OK (totales por arrendatario, saldo pendiente, servicios y consistencia interna).");

    if (dryRun) {
      await db.rollback();
      console.log("dry-run: ROLLBACK realizado. Las tablas nuevas quedan vacías.");
      return;
    }

    await db.query(`INSERT INTO SchemaMigrations (Version, Descripcion, Detalle) VALUES (?, ?, ?)`, [
      m001.VERSION,
      m001.DESCRIPCION,
      JSON.stringify(resultado),
    ]);
    await db.commit();
    console.log(`${m001.VERSION}: aplicada y confirmada.`);
  } catch (err) {
    try {
      await db.rollback();
    } catch {
      /* sin transacción abierta */
    }
    console.error("Error; se hizo ROLLBACK de los datos:", (err as Error).message);
    process.exitCode = 1;
  } finally {
    await db.end();
  }
}

main();
