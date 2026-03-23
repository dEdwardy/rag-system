import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    globals: true,
    include: ["test/*.test.js"],
    fileParallelism: false,
    isolate: true,
    setupFiles: ["./test/support/vitest.setup.cjs"]
  }
});
