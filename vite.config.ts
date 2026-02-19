import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

// vite.config.ts — لا top-level await هنا لأن esbuild يستورد هذا الملف
// الـ Replit plugins تُحمَّل فقط في وضع التطوير عبر server/vite.ts

export default defineConfig({
  plugins: [
    react(),
  ],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "client", "src"),
      "@shared": path.resolve(import.meta.dirname, "shared"),
      "@assets": path.resolve(import.meta.dirname, "attached_assets"),
    },
  },
  root: path.resolve(import.meta.dirname, "client"),
  build: {
    outDir: path.resolve(import.meta.dirname, "dist/public"),
    emptyOutDir: true,
  },
  server: {
    fs: {
      strict: true,
      deny: ["**/.*"],
    },
    hmr: {
      overlay: false,
    },
  },
});
