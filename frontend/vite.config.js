import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

const config = ({ mode }) => {
  return defineConfig({
    plugins: [
      react(),

      VitePWA({
        registerType: "autoUpdate",
      }),
    ],

    base: "/",

    define: {
      "process.env.NODE_ENV": `"${mode}"`,
    },

    server: {
      host: "0.0.0.0",

      proxy: {
        "/api": {
          target: "http://127.0.0.1:8080",
          changeOrigin: true,
        },

        "/ws": {
          target: "ws://127.0.0.1:8080",
          ws: true,
          changeOrigin: true,
        },
      },
    },

    build: {
      outDir: "dist",

      emptyOutDir: true,

      rollupOptions: {
        output: {
          manualChunks: (id) => {
            return "vendor";
          },
        },
      },
    },
  });
};

export default config;
