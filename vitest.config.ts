import { defineConfig } from "vitest/config";

// Unit tests mock blocksClient, so they prove UI logic only; org isolation,
// permissions and notifier delivery are verified against the real tenant
// (see SPEC1 §10).
export default defineConfig({
  esbuild: { jsx: "automatic" },
  test: {
    environment: "jsdom",
    include: ["tests/**/*.test.{ts,tsx}"],
    restoreMocks: true,
    setupFiles: ["tests/setup.ts"]
  }
});
