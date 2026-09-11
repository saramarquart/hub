import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

/**
 * Exists mainly so `@/` resolves in tests the same way it does in the app —
 * without it every test reaches for relative imports and the repo ends up with
 * two conventions for the same thing.
 */
export default defineConfig({
  resolve: {
    alias: { '@': fileURLToPath(new URL('./', import.meta.url)) },
  },
  test: {
    include: ['tests/**/*.test.ts'],
  },
});
