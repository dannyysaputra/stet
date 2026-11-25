import { resolve } from "node:path";
import { defineConfig } from "vite";

export default defineConfig({
  server: { host: "127.0.0.1", port: 5173, strictPort: true },
  build: {
    rollupOptions: {
      input: {
        main: resolve(import.meta.dirname, "index.html"),
        check: resolve(import.meta.dirname, "check/index.html"),
      },
    },
  },
});
