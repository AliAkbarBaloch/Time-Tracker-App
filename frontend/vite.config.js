import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    proxy: {
      '/api': {
        target: 'http://localhost:8080',
        changeOrigin: true,
      },
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: './src/test/setup.js',
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov', 'html'],
      exclude: [
        // Thin axios adapter wrappers — always mocked in component tests,
        // no testable logic; covered by backend integration tests instead
        'src/api/**',
        // Vite/test infra
        'src/test/**',
        'src/main.jsx',
        '**/*.config.*',
        '**/node_modules/**',
      ],
      thresholds: {
        lines: 90,
        statements: 90,
        functions: 85,
        branches: 80,
      },
    },
  },
})
