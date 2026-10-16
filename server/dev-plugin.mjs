import { mkdirSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import { loadEnv } from "vite";
import { handleAssistant } from "./logic.mjs";

const schema = `
  CREATE TABLE IF NOT EXISTS turnos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    fecha TEXT NOT NULL,
    hora TEXT NOT NULL,
    nombre TEXT NOT NULL,
    telefono TEXT NOT NULL,
    servicio TEXT NOT NULL,
    nota TEXT NOT NULL DEFAULT '',
    creado TEXT NOT NULL,
    UNIQUE (fecha, hora)
  );
`;

function localDatabase() {
  mkdirSync(".data", { recursive: true });
  const db = new DatabaseSync(".data/turnos.sqlite");
  db.exec(schema);
  return {
    prepare(sql) {
      const statement = db.prepare(sql);
      return {
        bind(...params) {
          return {
            async all() {
              return { results: statement.all(...params) };
            },
            async run() {
              statement.run(...params);
              return { success: true };
            },
          };
        },
      };
    },
  };
}

export function assistantDevPlugin() {
  const db = localDatabase();
  return {
    name: "assistant-dev",
    configureServer(server) {
      server.middlewares.use("/api/assistant", async (req, res) => {
        if (req.method !== "POST" && req.method !== "OPTIONS") {
          res.statusCode = 405;
          res.end("Método no permitido.");
          return;
        }

        const chunks = [];
        for await (const chunk of req) chunks.push(chunk);
        const env = {
          ...loadEnv(server.config.mode, process.cwd(), ""),
          ASSISTANT_DEV: "1",
          DB: db,
        };
        const request = new Request("http://127.0.0.1/api/assistant", {
          method: req.method,
          headers: {
            "content-type": req.headers["content-type"] || "application/json",
            origin: String(req.headers.origin || "http://127.0.0.1:5173"),
            "x-client-ip": req.socket.remoteAddress || "local",
          },
          body: req.method === "POST" ? Buffer.concat(chunks) : undefined,
        });
        const response = await handleAssistant(request, env);
        res.statusCode = response.status;
        response.headers.forEach((value, key) => res.setHeader(key, value));
        res.end(Buffer.from(await response.arrayBuffer()));
      });
    },
  };
}
