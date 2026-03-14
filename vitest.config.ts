import swc from 'unplugin-swc'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  oxc: false,
  plugins: [
    swc.vite({
      jsc: {
        parser: {
          decorators: true,
          syntax: 'typescript',
        },
        transform: {
          decoratorVersion: '2022-03',
        },
      },
    }),
  ],
  test: {
    coverage: {
      exclude: ['src/**/index.ts', 'src/**/interfaces.ts', 'src/services/melcloud-home.ts', 'src/main.ts', 'src/types/**/*.ts'],
      include: ['src/**/*.ts'],
    },
    include: ['tests/**/*.test.ts'],
  },
})
