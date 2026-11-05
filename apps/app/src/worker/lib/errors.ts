import { HTTPException } from 'hono/http-exception';
import type { ApiErrorBody } from '../../shared/types';

/** Error de la API con código estable y mensaje en español para mostrar al usuario. */
export function apiError(status: 400 | 401 | 403 | 404 | 409 | 413 | 415 | 422 | 429 | 500 | 502 | 503, code: string, message: string): HTTPException {
  const body: ApiErrorBody = { error: { code, message } };
  return new HTTPException(status, {
    res: new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } }),
  });
}

export const notFound = (what = 'Registro') => apiError(404, 'not_found', `${what} no encontrado`);
