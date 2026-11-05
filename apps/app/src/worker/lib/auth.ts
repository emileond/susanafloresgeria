import { eq } from 'drizzle-orm';
import { createMiddleware } from 'hono/factory';
import { createRemoteJWKSet, jwtVerify, type JWTVerifyGetKey } from 'jose';
import type { Role } from '../../shared/constants';
import { users, type User } from '../db/schema';
import type { AppEnv } from '../types';
import { apiError } from './errors';
import { newId } from './ids';

/**
 * Autenticación:
 * - Producción: Cloudflare Access protege todo el dominio. Además, en cada petición a /api
 *   se verifica la firma del JWT de Access (`Cf-Access-Jwt-Assertion`) contra las llaves del equipo.
 * - Desarrollo local: sin Access; se usa DEV_USER_EMAIL, solo si ENVIRONMENT=development y la petición es a localhost.
 * El correo verificado se busca en la tabla `users` (rol y estado activo).
 */

const jwksCache = new Map<string, JWTVerifyGetKey>();
function jwksFor(teamDomain: string): JWTVerifyGetKey {
  let jwks = jwksCache.get(teamDomain);
  if (!jwks) {
    jwks = createRemoteJWKSet(new URL(`https://${teamDomain}/cdn-cgi/access/certs`));
    jwksCache.set(teamDomain, jwks);
  }
  return jwks;
}

async function verifiedEmail(env: Env, req: Request): Promise<string | null> {
  const host = new URL(req.url).hostname;
  const isLocal = host === 'localhost' || host === '127.0.0.1';
  if (env.ENVIRONMENT === 'development' && isLocal && env.DEV_USER_EMAIL) {
    return env.DEV_USER_EMAIL.toLowerCase();
  }

  const token = req.headers.get('cf-access-jwt-assertion');
  if (!token || !env.ACCESS_TEAM_DOMAIN || !env.ACCESS_AUD) return null;
  try {
    const { payload } = await jwtVerify(token, jwksFor(env.ACCESS_TEAM_DOMAIN), {
      issuer: `https://${env.ACCESS_TEAM_DOMAIN}`,
      audience: env.ACCESS_AUD,
    });
    return typeof payload.email === 'string' ? payload.email.toLowerCase() : null;
  } catch {
    return null;
  }
}

export const authMiddleware = createMiddleware<AppEnv>(async (c, next) => {
  const email = await verifiedEmail(c.env, c.req.raw);
  if (!email) throw apiError(401, 'unauthorized', 'Sesión no válida. Vuelva a iniciar sesión.');

  const db = c.get('db');
  let user: User | undefined = await db.query.users.findFirst({ where: eq(users.email, email) });

  // Primer acceso de la doctora: se da de alta automáticamente con el correo configurado.
  if (!user && c.env.BOOTSTRAP_ADMIN_EMAIL && email === c.env.BOOTSTRAP_ADMIN_EMAIL.toLowerCase()) {
    const [created] = await db
      .insert(users)
      .values({ id: newId(), email, name: 'Dra. Susana Flores Alonso', role: 'doctor' })
      .returning();
    user = created;
  }

  if (!user || !user.active) throw apiError(403, 'forbidden', 'Su cuenta no tiene acceso a esta aplicación.');

  const fiveMinutes = 5 * 60 * 1000;
  if (!user.lastSeenAt || Date.now() - user.lastSeenAt.getTime() > fiveMinutes) {
    const touch = db.update(users).set({ lastSeenAt: new Date() }).where(eq(users.id, user.id)).run();
    try {
      c.executionCtx.waitUntil(touch);
    } catch {
      await touch;
    }
  }

  c.set('user', user);
  await next();
});

/** Roles que pueden ver y editar información clínica (notas, historia, archivos, medicamentos). */
export const CLINICAL_ROLES: readonly Role[] = ['doctor', 'admin'];

export const canEditClinical = (role: Role) => CLINICAL_ROLES.includes(role);

export const requireClinical = createMiddleware<AppEnv>(async (c, next) => {
  if (!canEditClinical(c.get('user').role)) {
    throw apiError(403, 'forbidden', 'Su rol no permite acceder a información clínica.');
  }
  await next();
});
