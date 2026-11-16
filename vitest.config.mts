import { fileURLToPath } from "node:url";

import { defineConfig } from "vitest/config";

// Unit tests (lib/**/*.test.ts). Resolves the "@/…" path alias of tsconfig.json.
export default defineConfig({
  resolve: {
    alias: { "@": fileURLToPath(new URL(".", import.meta.url)) },
  },
  test: {
    include: ["lib/**/*.test.ts"],
  },
});
