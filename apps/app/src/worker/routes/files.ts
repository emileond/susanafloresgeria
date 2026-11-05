import { and, desc, eq, isNull } from 'drizzle-orm';
import { Hono } from 'hono';
import { z } from 'zod';
import { ALLOWED_FILE_TYPES, MAX_FILE_BYTES } from '../../shared/constants';
import { fileMetaInput } from '../../shared/schemas';
import type { FileItem } from '../../shared/types';
import { files, users, type FileRecord } from '../db/schema';
import { audit } from '../lib/audit';
import { requireClinical } from '../lib/auth';
import { apiError, notFound } from '../lib/errors';
import { newId } from '../lib/ids';
import { isoReq } from '../lib/serialize';
import { validate } from '../lib/validate';
import type { AppEnv } from '../types';
import { getPatientOr404 } from './patients';

/**
 * Archivos del expediente (estudios, fotos, recetas…) en un bucket R2 privado.
 * Nunca hay URL pública: el contenido se entrega solo a través de la API, tras verificar la sesión.
 */

const toFileItem = (f: FileRecord, createdByName: string | null): FileItem => ({
  id: f.id,
  patientId: f.patientId,
  noteId: f.noteId,
  category: f.category,
  filename: f.filename,
  mime: f.mime,
  size: f.size,
  studyDate: f.studyDate,
  description: f.description,
  createdAt: isoReq(f.createdAt),
  createdByName,
});

/** Nombre de archivo seguro para mostrar y descargar. */
function safeFilename(name: string): string {
  const cleaned = name.replace(/[\\/:*?"<>|\u0000-\u001f]/g, '_').trim();
  return (cleaned || 'archivo').slice(0, 180);
}

function contentDisposition(kind: 'inline' | 'attachment', filename: string): string {
  const ascii = filename.replace(/[^\x20-\x7e]/g, '_').replace(/"/g, "'");
  return `${kind}; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(filename)}`;
}

async function sha256Hex(buf: ArrayBuffer): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', buf);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

const patientParam = z.object({ patientId: z.uuid() });
const idParam = z.object({ id: z.uuid() });

export const patientFileRoutes = new Hono<AppEnv>()
  .use(requireClinical)
  .get('/', validate('param', patientParam), async (c) => {
    const { patientId } = c.req.valid('param');
    const rows = await c
      .get('db')
      .select({ file: files, createdByName: users.name })
      .from(files)
      .leftJoin(users, eq(files.createdBy, users.id))
      .where(and(eq(files.patientId, patientId), isNull(files.archivedAt)))
      .orderBy(desc(files.createdAt));
    return c.json(rows.map((r) => toFileItem(r.file, r.createdByName)));
  })

  .post('/', validate('param', patientParam), async (c) => {
    const { patientId } = c.req.valid('param');
    const db = c.get('db');
    await getPatientOr404(db, patientId);

    const declared = Number(c.req.header('content-length') ?? 0);
    if (declared > MAX_FILE_BYTES + 1024 * 1024) throw apiError(413, 'file_too_large', 'El archivo supera el máximo de 50 MB.');

    const form = await c.req.formData();
    const file = form.get('file');
    if (!(file instanceof File)) throw apiError(422, 'file_missing', 'Seleccione un archivo.');
    if (!(file.type in ALLOWED_FILE_TYPES)) {
      throw apiError(415, 'file_type', 'Tipo de archivo no permitido. Use PDF, JPG, PNG, HEIC o DOCX.');
    }
    if (file.size === 0) throw apiError(422, 'file_empty', 'El archivo está vacío.');
    if (file.size > MAX_FILE_BYTES) throw apiError(413, 'file_too_large', 'El archivo supera el máximo de 50 MB.');

    const meta = fileMetaInput.safeParse({
      category: form.get('category') ?? undefined,
      description: form.get('description') ?? undefined,
      studyDate: form.get('studyDate') ?? undefined,
      noteId: form.get('noteId') || undefined,
    });
    if (!meta.success) throw apiError(422, 'invalid_input', 'Revise la categoría y la fecha del archivo.');

    const id = newId();
    const r2Key = `patients/${patientId}/${id}`;
    const buf = await file.arrayBuffer();
    const sha256 = await sha256Hex(buf);
    await c.env.FILES.put(r2Key, buf, {
      httpMetadata: { contentType: file.type },
      customMetadata: { patientId, fileId: id },
    });

    const userId = c.get('user').id;
    await db.insert(files).values({
      id,
      patientId,
      noteId: meta.data.noteId ?? null,
      category: meta.data.category,
      r2Key,
      filename: safeFilename(file.name),
      mime: file.type,
      size: file.size,
      sha256,
      studyDate: meta.data.studyDate ?? null,
      description: meta.data.description ?? null,
      createdBy: userId,
      updatedBy: userId,
    });
    audit(c, { action: 'upload', entity: 'file', entityId: id, patientId });
    const created = await db.query.files.findFirst({ where: eq(files.id, id) });
    return c.json(toFileItem(created!, c.get('user').name), 201);
  });

export const fileRoutes = new Hono<AppEnv>()
  .use(requireClinical)
  .get('/:id/content', validate('param', idParam), async (c) => {
    const { id } = c.req.valid('param');
    const record = await c.get('db').query.files.findFirst({ where: eq(files.id, id) });
    if (!record || record.archivedAt) throw notFound('Archivo');
    const object = await c.env.FILES.get(record.r2Key);
    if (!object) throw notFound('Archivo');
    const download = c.req.query('download') === '1';
    audit(c, { action: download ? 'download' : 'view', entity: 'file', entityId: id, patientId: record.patientId });
    const headers = new Headers({
      'content-type': record.mime,
      'content-length': String(record.size),
      'content-disposition': contentDisposition(download ? 'attachment' : 'inline', record.filename),
      'cache-control': 'private, no-store',
      'x-content-type-options': 'nosniff',
    });
    // Solo se aceptan PDF, imágenes y DOCX; aun así, fuera de los PDF (que usan el visor del navegador)
    // se impide cualquier ejecución de scripts.
    if (record.mime !== 'application/pdf') headers.set('content-security-policy', "default-src 'none'; img-src 'self'; sandbox");
    return new Response(object.body, { headers });
  })

  .patch('/:id', validate('param', idParam), validate('json', fileMetaInput.partial()), async (c) => {
    const { id } = c.req.valid('param');
    const input = c.req.valid('json');
    const db = c.get('db');
    const record = await db.query.files.findFirst({ where: eq(files.id, id) });
    if (!record) throw notFound('Archivo');
    await db
      .update(files)
      .set({
        ...(input.category ? { category: input.category } : {}),
        description: input.description ?? record.description,
        studyDate: input.studyDate ?? record.studyDate,
        updatedAt: new Date(),
        updatedBy: c.get('user').id,
      })
      .where(eq(files.id, id));
    audit(c, { action: 'update', entity: 'file', entityId: id, patientId: record.patientId });
    return c.json({ ok: true });
  })

  // Archivar oculta el archivo del expediente sin destruirlo (se conserva en R2).
  .post('/:id/archive', validate('param', idParam), async (c) => {
    const { id } = c.req.valid('param');
    const db = c.get('db');
    const record = await db.query.files.findFirst({ where: eq(files.id, id) });
    if (!record) throw notFound('Archivo');
    await db.update(files).set({ archivedAt: new Date(), updatedAt: new Date(), updatedBy: c.get('user').id }).where(eq(files.id, id));
    audit(c, { action: 'archive', entity: 'file', entityId: id, patientId: record.patientId });
    return c.json({ ok: true });
  });
