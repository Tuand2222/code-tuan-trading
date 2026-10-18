import { defineConfig } from 'vitest/config';
export default defineConfig({ test: { include: ['tests/trading/**/*.test.ts'], environment: 'node' } });
