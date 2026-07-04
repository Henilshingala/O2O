import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  base: "/admin-assets/",
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },
  build: {
    outDir: "dist",
    emptyOutDir: true,
  },
  server: {
    port: 5173,
    proxy: {
      "/api": {
        target: "https://o2o-rphb.onrender.com",
        changeOrigin: true,
        secure: false,
      },
      "/uploads": {
        target: "https://o2o-rphb.onrender.com",
        changeOrigin: true,
        secure: false,
      },
    },
  },
});
