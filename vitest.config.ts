import { coverageDefaults } from '@olivierzal/configs/vitest-coverage'
import { swcPlugin } from '@olivierzal/configs/vitest-swc'
import { type ViteUserConfig, defineConfig } from 'vitest/config'

const config: ViteUserConfig = defineConfig({
  oxc: false,
  plugins: [swcPlugin],
  test: {
    clearMocks: true,
    coverage: { ...coverageDefaults, include: ['src/**/*.ts'] },
    include: ['tests/**/*.test.ts'],
  },
})

export default config
