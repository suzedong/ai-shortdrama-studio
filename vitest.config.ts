import { defineConfig } from 'vitest/config'
import path from 'node:path'

export default defineConfig({
  test: {
    environment: 'jsdom',
    globals: true,
    // App 集成测试存在跨用例的异步定时器收尾，并发文件调度会触发竞态
    // （遗留 setTimeout 在后续测试 mount 时才回调）。串行执行保证稳定。
    fileParallelism: false,
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
  },
  resolve: {
    alias: {
      '@shared': path.resolve(__dirname, 'shared'),
      '@components': path.resolve(__dirname, 'src/components'),
    },
  },
})
