import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { defineConfig } from "vite";

// Development only: lets /eval save each finished run to data/eval/results/.
// Not part of the hosted build.
function evalResults() {
  return {
    name: "stet-eval-results",
    apply: "serve",
    configureServer(server) {
      server.middlewares.use("/__eval-results", (req, res) => {
        const name = new URL(req.url, "http://localhost").searchParams.get("name") ?? "";
        if (req.method !== "POST" || !/^[a-z]+-(laptop|cloud)-[0-9TZ-]+\.json$/.test(name)) {
          res.statusCode = 400;
          return res.end("bad request");
        }
        let body = "";
        req.on("data", (chunk) => {
          body += chunk;
          if (body.length > 5_000_000) req.destroy();
        });
        req.on("end", () => {
          try {
            JSON.parse(body);
            const dir = resolve(import.meta.dirname, "data/eval/results");
            mkdirSync(dir, { recursive: true });
            writeFileSync(resolve(dir, name), body);
            res.end("ok");
          } catch {
            res.statusCode = 400;
            res.end("not json");
          }
        });
      });
    },
  };
}

export default defineConfig({
  plugins: [evalResults()],
  server: { host: "127.0.0.1", port: 5173, strictPort: true },
  build: {
    rollupOptions: {
      input: {
        main: resolve(import.meta.dirname, "index.html"),
        check: resolve(import.meta.dirname, "check/index.html"),
        sample: resolve(import.meta.dirname, "sample/index.html"),
        review: resolve(import.meta.dirname, "review/index.html"),
        files: resolve(import.meta.dirname, "files/index.html"),
      },
    },
  },
});
