/**
 * Respaldo diario de la base D1 al bucket R2 privado BACKUPS (además del "Time Travel" de D1, que cubre 30 días).
 * - Descubre las tablas automáticamente, así las tablas nuevas también se respaldan.
 * - Un archivo JSON comprimido (gzip) por tabla: d1/AAAA-MM-DD/<tabla>.json.gz, más un manifiesto.
 * - Conserva 35 días; para conservar más tiempo, configure una regla de ciclo de vida en R2.
 * Restauración: scripts/restore-backup.mjs (ver README).
 */

const RETENTION_DAYS = 35;

async function gzipJson(value: unknown): Promise<ArrayBuffer> {
  const stream = new Blob([JSON.stringify(value)]).stream().pipeThrough(new CompressionStream('gzip'));
  return new Response(stream).arrayBuffer();
}

export interface BackupResult {
  prefix: string;
  tables: Record<string, number>;
  deletedOld: number;
}

export async function backupDatabase(env: Pick<Env, 'DB' | 'BACKUPS'>, now: Date = new Date()): Promise<BackupResult> {
  const day = now.toISOString().slice(0, 10);
  const prefix = `d1/${day}/`;
  const { results: tableRows } = await env.DB.prepare(
    "SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_cf_%' ORDER BY name",
  ).all<{ name: string }>();

  const tables: Record<string, number> = {};
  for (const { name } of tableRows) {
    if (!/^[A-Za-z0-9_]+$/.test(name)) continue;
    const { results } = await env.DB.prepare(`SELECT * FROM "${name}"`).all();
    tables[name] = results.length;
    await env.BACKUPS.put(`${prefix}${name}.json.gz`, await gzipJson(results), {
      httpMetadata: { contentType: 'application/json', contentEncoding: 'gzip' },
      customMetadata: { rows: String(results.length) },
    });
  }
  await env.BACKUPS.put(`${prefix}manifest.json`, JSON.stringify({ version: 1, createdAt: now.toISOString(), tables }), {
    httpMetadata: { contentType: 'application/json' },
  });

  // Limpieza de respaldos antiguos.
  const cutoff = new Date(now.getTime() - RETENTION_DAYS * 24 * 3600_000).toISOString().slice(0, 10);
  let deletedOld = 0;
  let cursor: string | undefined;
  do {
    const page = await env.BACKUPS.list({ prefix: 'd1/', cursor });
    const old = page.objects.map((o) => o.key).filter((k) => (k.split('/')[1] ?? '') < cutoff);
    if (old.length) {
      await env.BACKUPS.delete(old);
      deletedOld += old.length;
    }
    cursor = page.truncated ? page.cursor : undefined;
  } while (cursor);

  return { prefix, tables, deletedOld };
}
