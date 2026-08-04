import express from "express";
import { routes } from "./routes/index.js";

const app = express();
const host = process.env.HOST ?? (process.env.K_SERVICE ? "0.0.0.0" : "127.0.0.1");
const port = Number(process.env.AI_ASSIST_PORT ?? process.env.PORT ?? 8080);

app.use(express.json());
app.use(routes);

app.use(
  (
    error: Error,
    _request: express.Request,
    response: express.Response,
    _next: express.NextFunction
  ) => {
    response.status(400).json({
      error: error.message,
      service: "ai-assist"
    });
  }
);

app.listen(port, host, () => {
  console.log(`CSA AI Assist service listening on ${host}:${port}`);
});
