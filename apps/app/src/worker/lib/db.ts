import { drizzle } from 'drizzle-orm/d1';
import { createMiddleware } from 'hono/factory';
import * as schema from '../db/schema';
import type { AppEnv } from '../types';

export const dbMiddleware = createMiddleware<AppEnv>(async (c, next) => {
  c.set('db', drizzle(c.env.DB, { schema }));
  await next();
});
