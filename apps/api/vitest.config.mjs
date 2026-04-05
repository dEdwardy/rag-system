import { defineConfig } from "vitest/config";

const junitOutput = process.env.VITEST_JUNIT_OUTPUT;

export default defineConfig({
  test: {
    environment: "node",
    globals: true,
    include: ["test/*.test.js"],
    fileParallelism: false,
    isolate: true,
    setupFiles: ["./test/support/vitest.setup.cjs"],
    reporters: junitOutput ? ["default", "junit"] : ["default"],
    outputFile: junitOutput
      ? {
          junit: junitOutput
        }
      : undefined,
    pool: "threads",
    poolOptions: {
      threads: { singleThread: true }
    },
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
