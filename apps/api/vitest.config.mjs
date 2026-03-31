import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    globals: true,
    include: ["test/*.test.js"],
    fileParallelism: false,
    isolate: true,
    setupFiles: ["./test/support/vitest.setup.cjs"],
    // 测试报告配置
    reporters: ["default", "junit"],
    outputFile: {
      junit: "./test-results/junit.xml"
    },
    // 测试重试配置
    retry: 2,
    pool: "threads",
    poolOptions: {
      threads: { singleThread: true }
    },
    // 测试覆盖率配置
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html"],
      reportsDirectory: "./test-results/coverage",
      thresholds: {
        lines: 80,
        functions: 80,
        branches: 75
      }
    }
  }
});
