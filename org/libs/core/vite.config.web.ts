import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { resolve } from "path";

export default defineConfig({
  root: resolve(__dirname, "src/web"),
  plugins: [react()],
  resolve: {
    alias: {
      "@lmthing/ui": resolve(__dirname, "../ui/src"),
      "@lmthing/css": resolve(__dirname, "../css/src"),
      "@lmthing/repl": resolve(__dirname, "../repl/src"),
    },
  },
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
