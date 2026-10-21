import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/tests/integration/**/*.test.js"],
    globalSetup: ["src/tests/setup/globalSetup.js"],
    setupFiles: ["src/tests/setup/env.js"],
    testTimeout: 30000,
    hookTimeout: 120000,
    pool: "forks",
  },
});
