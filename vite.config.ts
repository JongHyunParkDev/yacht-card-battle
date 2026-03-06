import { defineConfig } from "vite";

export default defineConfig({
  base: "./", // Important for Capacitor and Electron build
  build: {
    outDir: "dist",
    emptyOutDir: true,
  },
  server: {
    port: 5173,
    strictPort: true,
  },
});
