import { defineConfig } from 'drizzle-kit';

// Genera migraciones SQL en ./drizzle; se aplican con `wrangler d1 migrations apply`.
export default defineConfig({
  dialect: 'sqlite',
  schema: './src/worker/db/schema.ts',
  out: './drizzle',
});
