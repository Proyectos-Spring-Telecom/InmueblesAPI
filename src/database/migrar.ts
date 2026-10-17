/**
 * Ejecutor de migraciones de base de datos.
 *
 *   node dist/database/migrar.js                       aplica las migraciones pendientes, en orden
 *   node dist/database/migrar.js --dry-run             ejecuta, verifica y hace ROLLBACK (no cambia datos)
 *   node dist/database/migrar.js --db=Inmuebles_prueba  usa otra base (pruebas)
 *
 * Toma la conexión del .env de la API. El DDL (CREATE TABLE) no es transaccional en MySQL,
 * pero sólo crea tablas nuevas vacías; los cambios de datos de TODAS las migraciones pendientes
 * corren en una sola transacción y sólo se confirman si cada verificación sale sin diferencias.
 */
import { join } from "path";
import { config } from "dotenv";
import { createConnection, type Connection } from "mysql2/promise";
import * as m001 from "./migraciones/001-pagos-parciales";
import * as m002 from "./migraciones/002-desglose-iva-contrato";

config({ path: join(__dirname, "..", "..", ".env") });

interface Migracion {
  VERSION: string;
  DESCRIPCION: string;
  aplicar(db: Connection): Promise<unknown>;
  verificar(db: Connection): Promise<string[]>;
}

const MIGRACIONES: Migracion[] = [m001, m002];

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

    const [aplicadas] = await db.query<any[]>(`SELECT Version FROM SchemaMigrations`);
    const hechas = new Set(aplicadas.map((r) => r.Version));
    const pendientes = MIGRACIONES.filter((mig) => !hechas.has(mig.VERSION));
    if (pendientes.length === 0) {
      console.log("Sin migraciones pendientes.");
      return;
    }

    await db.beginTransaction();
    for (const mig of pendientes) {
      const resultado = await mig.aplicar(db);
      console.log(`${mig.VERSION}:`, JSON.stringify(resultado, null, 2));
      const errores = await mig.verificar(db);
      if (errores.length > 0) {
        await db.rollback();
        console.error(`${mig.VERSION}: VERIFICACIÓN FALLIDA (${errores.length}); se hizo ROLLBACK, no cambió ningún dato:`);
        for (const e of errores) console.error(` - ${e}`);
        process.exitCode = 1;
        return;
      }
      console.log(`${mig.VERSION}: verificación OK.`);
      await db.query(`INSERT INTO SchemaMigrations (Version, Descripcion, Detalle) VALUES (?, ?, ?)`, [
        mig.VERSION,
        mig.DESCRIPCION,
        JSON.stringify(resultado),
      ]);
    }

    if (dryRun) {
      await db.rollback();
      console.log("dry-run: ROLLBACK realizado. No cambió ningún dato.");
      return;
    }
    await db.commit();
    console.log(`Aplicadas y confirmadas: ${pendientes.map((p) => p.VERSION).join(", ")}.`);
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
