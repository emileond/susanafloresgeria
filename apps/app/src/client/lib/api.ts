import type { ApiErrorBody } from '../../shared/types';

/** Error de la API con mensaje en español listo para mostrar. */
export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public fields?: Record<string, string>,
  ) {
    super(message);
  }
}

async function parseError(res: Response): Promise<ApiError> {
  try {
    const body = (await res.json()) as ApiErrorBody;
    return new ApiError(res.status, body.error.code, body.error.message, body.error.fields);
  } catch {
    return new ApiError(res.status, 'http_error', 'No se pudo completar la operación. Intente de nuevo.');
  }
}

export async function api<T>(path: string, init: RequestInit & { json?: unknown } = {}): Promise<T> {
  const { json, headers, ...rest } = init;
  let res: Response;
  try {
    res = await fetch(`/api${path}`, {
      credentials: 'same-origin',
      ...rest,
      headers: { ...(json !== undefined ? { 'content-type': 'application/json' } : {}), ...headers },
      body: json !== undefined ? JSON.stringify(json) : rest.body,
    });
  } catch {
    throw new ApiError(0, 'network', 'Sin conexión. Revise su internet e intente de nuevo.');
  }
  if (res.status === 401) {
    // La sesión de Cloudflare Access expiró: recargar lleva a la pantalla de inicio de sesión.
    window.location.reload();
    throw new ApiError(401, 'unauthorized', 'Su sesión expiró.');
  }
  if (!res.ok) throw await parseError(res);
  return (await res.json()) as T;
}

export const fileUrl = (id: string, download = false) => `/api/files/${id}/content${download ? '?download=1' : ''}`;
