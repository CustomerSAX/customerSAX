// Load .env before anything else — dotenv won't override vars already in process.env
import { config as loadEnv } from "dotenv";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
loadEnv({ path: resolve(__dirname, "..", ".env") });

import express from "express";
import cors from "cors";
import { routes } from "./routes/index.js";

const app = express();
const host = process.env.HOST ?? (process.env.K_SERVICE ? "0.0.0.0" : "127.0.0.1");
const port = Number(process.env.AI_ASSIST_PORT ?? process.env.PORT ?? 8080);

const corsOrigin = process.env.CORS_ORIGIN ?? "http://localhost:3000";

app.use(cors({
  origin: corsOrigin,
  methods: ["GET", "POST", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
  credentials: true
}));

app.use(express.json({ limit: "2mb" }));
app.use(routes);

app.use(
  (
    error: Error,
    _request: express.Request,
    response: express.Response,
    _next: express.NextFunction
  ) => {
    console.error("[ai-assist] Unhandled error:", error);
    response.status(500).json({
      error: error.message,
      service: "ai-assist"
    });
  }
);

app.listen(port, host, () => {
  console.log(`CSA AI Assist listening on ${host}:${port}`);
  console.log(`  Commerce platform : ${process.env.AI_COMMERCE_PLATFORM ?? "not set"}`);
  console.log(`  LLM provider      : ${process.env.DEFAULT_LLM_PROVIDER ?? "openai"}`);
  console.log(`  Tickets MCP       : ${process.env.TICKETS_MCP_URL ? "configured" : "not configured"}`);
});
