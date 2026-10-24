import { defineConfig } from 'vitest/config';
export default defineConfig({
  test: { include: ['tests/unit/**/*.test.ts', 'tests/golden/**/*.test.ts'], environment: 'node' },
});
