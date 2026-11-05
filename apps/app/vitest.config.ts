import { cloudflareTest, readD1Migrations } from '@cloudflare/vitest-plugin';
import { defineConfig } from 'vitest/config';

// Las pruebas corren dentro del runtime de Workers (Miniflare) con D1 y R2 locales y aislados.
export default defineConfig(async () => {
  const migrations = await readD1Migrations('./drizzle');
  return {
    plugins: [
      cloudflareTest({
        wrangler: { configPath: './wrangler.jsonc' },
        miniflare: {
          bindings: {
            TEST_MIGRATIONS: migrations,
            ENVIRONMENT: 'development',
            DEV_USER_EMAIL: 'doctora@example.com',
            BOOTSTRAP_ADMIN_EMAIL: '',
          },
        },
      }),
    ],
    test: {
      include: ['test/**/*.test.ts'],
      setupFiles: ['./test/setup.ts'],
    },
  };
});
