import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

// Testes das regras puras (sem navegador). Config separada da do Vite para não carregar os
// plugins do Figma Make.
export default defineConfig({
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  test: {
    include: ['src/**/*.test.ts'],
    environment: 'node',
  },
})
