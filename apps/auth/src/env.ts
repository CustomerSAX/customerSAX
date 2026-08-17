// Side-effect module: load `.env` before anything that reads `process.env`.
// Imported first (as `import "./env.js"`) so it runs ahead of the mongodb/logger
// imports — replacing the former hand-rolled `load-env.ts`.
import { fileURLToPath } from "node:url";

import { loadEnv } from "@csa/config";

loadEnv({
  extraPaths: [fileURLToPath(new URL("../.env", import.meta.url))],
});
