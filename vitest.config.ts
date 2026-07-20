import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react-swc";
import path from "path";

export default defineConfig({
  plugins: [react()],
  test: {
    env: {
      // Tests must never inherit a real Supabase project from the developer or CI.
      VITE_SUPABASE_URL: "https://stock-sur-tests.invalid",
      VITE_SUPABASE_PUBLISHABLE_KEY: "test-public-placeholder-key",
    },
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/test/setup.ts"],
    include: ["src/**/*.{test,spec}.{ts,tsx}"],
  },
  resolve: {
    alias: { "@": path.resolve(__dirname, "./src") },
  },
});
