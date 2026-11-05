import { createExecutionContext, waitOnExecutionContext } from 'cloudflare:test';
import { env } from 'cloudflare:workers';
import worker from '../src/worker/index';

export const DOCTOR_EMAIL = 'doctora@example.com';

/** Llama a la API como el usuario local de desarrollo (o con variables de entorno alteradas). */
export async function call(path: string, init: RequestInit & { json?: unknown } = {}, envOverrides: Partial<Env> = {}) {
  const { json, ...rest } = init;
  const req = new Request(`http://localhost/api${path}`, {
    ...rest,
    headers: { ...(json !== undefined ? { 'content-type': 'application/json' } : {}), ...(rest.headers ?? {}) },
    body: json !== undefined ? JSON.stringify(json) : rest.body,
  });
  const ctx = createExecutionContext();
  const res = await worker.fetch(req, { ...env, ...envOverrides }, ctx);
  await waitOnExecutionContext(ctx);
  return res;
}

export async function seedUser(email = DOCTOR_EMAIL, role: 'doctor' | 'assistant' | 'admin' = 'doctor') {
  await env.DB.prepare('INSERT OR IGNORE INTO users (id, email, name, role) VALUES (?, ?, ?, ?)')
    .bind(crypto.randomUUID(), email, `Usuario ${role}`, role)
    .run();
}

export async function createPatient(fullName = 'José Pérez Núñez') {
  const res = await call('/patients', {
    method: 'POST',
    json: { fullName, birthDate: '1940-05-10', sex: 'M', caregiver: { name: 'Ana Pérez', relationship: 'Hija', phone: '477 123 4567' } },
  });
  return ((await res.json()) as { id: string }).id;
}
