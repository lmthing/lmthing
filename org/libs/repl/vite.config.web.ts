import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { resolve } from "path";

export default defineConfig({
  root: resolve(__dirname, "src/web"),
  plugins: [react()],
  build: {
    outDir: resolve(__dirname, "dist/web"),
    emptyOutDir: true,
  },
  server: {
    port: 3101,
    proxy: {
      "/ws": {
        target: "ws://localhost:3010",
        ws: true,
      },
    },
  },
});
