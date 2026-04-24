import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  schema: './db/schema.ts',
  out: './db/migrations',
  dialect: 'sqlite',
  // For local dev introspection; production uses CF D1 via wrangler
  dbCredentials: { url: './local.db' },
});
