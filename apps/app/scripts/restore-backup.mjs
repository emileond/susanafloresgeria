#!/usr/bin/env node
/**
 * Convierte un respaldo descargado de R2 (carpeta d1/AAAA-MM-DD/) en un archivo SQL para restaurar D1.
 *
 * Uso:
 *   1. Descargar los archivos del respaldo (panel de R2 o `wrangler r2 object get`), p. ej. a ./respaldo/
 *   2. node scripts/restore-backup.mjs ./respaldo > restore.sql
 *   3. En una base NUEVA con las migraciones aplicadas:
 *        npx wrangler d1 execute DB --remote --file=restore.sql
 *
 * Las tablas se insertan en un orden que respeta las llaves foráneas.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { gunzipSync } from 'node:zlib';

const dir = process.argv[2];
if (!dir) {
  console.error('Uso: node scripts/restore-backup.mjs <carpeta-del-respaldo>');
  process.exit(1);
}

const ORDER = ['users', 'patients', 'patient_contacts', 'clinical_histories', 'notes', 'files', 'medications', 'assessments', 'prescriptions', 'appointments', 'sync_runs', 'audit_log'];
const SKIP = new Set(['d1_migrations']);
const files = readdirSync(dir).filter((f) => f.endsWith('.json.gz'));
const tables = files.map((f) => f.replace(/\.json\.gz$/, '')).filter((t) => !SKIP.has(t));
tables.sort((a, b) => (ORDER.indexOf(a) === -1 ? 99 : ORDER.indexOf(a)) - (ORDER.indexOf(b) === -1 ? 99 : ORDER.indexOf(b)));

const sqlValue = (v) => (v === null || v === undefined ? 'NULL' : typeof v === 'number' ? String(v) : `'${String(v).replace(/'/g, "''")}'`);

const out = [];
for (const table of tables) {
  const rows = JSON.parse(gunzipSync(readFileSync(join(dir, `${table}.json.gz`))).toString('utf8'));
  for (const row of rows) {
    const cols = Object.keys(row);
    out.push(`INSERT INTO "${table}" (${cols.map((c) => `"${c}"`).join(', ')}) VALUES (${cols.map((c) => sqlValue(row[c])).join(', ')});`);
  }
  console.error(`${table}: ${rows.length} filas`);
}
process.stdout.write(out.join('\n') + '\n');
