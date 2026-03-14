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
    include: ['src/**/__tests__/**/*.test.ts'],
  },
})
