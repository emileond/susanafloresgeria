import type { Context } from 'hono';
import { auditLog } from '../db/schema';
import type { AppEnv } from '../types';
import { newId } from './ids';

export type AuditAction = 'view' | 'create' | 'update' | 'sign' | 'issue' | 'cancel' | 'print' | 'archive' | 'unarchive' | 'delete' | 'download' | 'upload';

/**
 * Registra un acceso o cambio en la bitácora (NOM-024). Solo metadatos: nunca contenido clínico.
 * Se escribe en segundo plano para no retrasar la respuesta.
 */
export function audit(
  c: Context<AppEnv>,
  entry: { action: AuditAction; entity: string; entityId?: string | null; patientId?: string | null },
): void {
  const user = c.get('user');
  const write = c
    .get('db')
    .insert(auditLog)
    .values({
      id: newId(),
      userId: user?.id ?? null,
      action: entry.action,
      entity: entry.entity,
      entityId: entry.entityId ?? null,
      patientId: entry.patientId ?? null,
      ip: c.req.header('cf-connecting-ip') ?? null,
      userAgent: c.req.header('user-agent')?.slice(0, 300) ?? null,
    })
    .run()
    .catch(() => console.error('audit_write_failed'));
  try {
    c.executionCtx.waitUntil(write);
  } catch {
    // Sin contexto de ejecución (p. ej. pruebas unitarias): esperar a que termine.
    void write;
  }
}
