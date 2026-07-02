import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: [
      { find: /^react-native$/, replacement: path.resolve(__dirname, "./compat/react-native-web-compat.mjs") },
      { find: /^@\//, replacement: path.resolve(__dirname, "./") + "/" },
      { find: /^@env$/, replacement: path.resolve(__dirname, "./compat/env.ts") },
      { find: /^@react-native-community\/blur$/, replacement: path.resolve(__dirname, "./compat/empty-mock.js") },
      { find: /^react-native-linear-gradient$/, replacement: path.resolve(__dirname, "./compat/empty-mock.js") },
      { find: /^react-native-haptic-feedback$/, replacement: path.resolve(__dirname, "./compat/empty-mock.js") },
      { find: /^react-native-image-picker$/, replacement: path.resolve(__dirname, "./compat/image-picker.web.ts") },
      { find: /^react-native-keyboard-controller$/, replacement: path.resolve(__dirname, "./compat/empty-mock.js") },
    ],
    extensions: [
      ".web.tsx",
      ".web.ts",
      ".web.jsx",
      ".web.js",
      ".tsx",
      ".ts",
      ".jsx",
      ".js",
    ],
  },
  define: {
    global: "window",
    __DEV__: JSON.stringify(process.env.NODE_ENV !== "production"),
    "process.env.NODE_ENV": JSON.stringify(
      process.env.NODE_ENV || "development"
    ),
  },
  optimizeDeps: {
    esbuildOptions: {
      loader: {
        ".js": "jsx",
      },
      resolveExtensions: [
        ".web.tsx",
        ".web.ts",
        ".web.jsx",
        ".web.js",
        ".tsx",
        ".ts",
        ".jsx",
        ".js",
      ],
    },
  },
  server: {
    port: 5000,
    host: "0.0.0.0",
    allowedHosts: true,
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
  preview: {
    port: 5000,
    host: "0.0.0.0",
    allowedHosts: true,
  },
  build: {
    outDir: "dist",
    commonjsOptions: {
      transformMixedEsModules: true,
    },
  },
});
