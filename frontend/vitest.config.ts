import { mergeConfig } from 'vite'
import { defineConfig as defineVitestConfig } from 'vitest/config'
import viteConfig from './vite.config.ts'

export default mergeConfig(
  viteConfig,
  defineVitestConfig({
    test: {
      environment: 'jsdom',
      setupFiles: ['./src/tests/setup.ts'],
      globals: true,
      // tests/e2e is Playwright's territory (bun run test:e2e), not Vitest's.
      exclude: ['node_modules/**', 'tests/e2e/**'],
    },
  }),
)
