import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
    hmr: {
      overlay: false,
    },
  },
  plugins: [react()].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes("node_modules")) return;

          if (id.includes("react-dom") || id.includes("react/")) {
            return "vendor-react";
          }

          if (id.includes("react-router") || id.includes("@remix-run")) {
            return "vendor-router";
          }

          if (id.includes("@tanstack/react-query")) {
            return "vendor-query";
          }

          if (id.includes("@supabase/")) {
            return "vendor-supabase";
          }

          if (id.includes("@radix-ui/") || id.includes("cmdk") || id.includes("vaul")) {
            return "vendor-ui";
          }

          if (id.includes("xlsx")) return "vendor-xlsx";
          if (id.includes("pdfjs-dist")) return "vendor-pdf";
          if (id.includes("tesseract.js")) return "vendor-ocr";

          if (id.includes("date-fns") || id.includes("zod") || id.includes("clsx") || id.includes("tailwind-merge")) {
            return "vendor-utils";
          }
        },
      },
    },
  },
}));
