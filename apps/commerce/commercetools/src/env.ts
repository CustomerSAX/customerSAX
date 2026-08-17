// Side-effect module: load `.env` before anything that reads `process.env`.
// Imported first (as `import "./env.js"`) so it runs ahead of the mongodb/logger
// and project-context imports — replacing the former hand-rolled `load-env.ts`.
//
// Local monorepo development shares Mongo/session collections with Auth, so the
// shared `apps/auth/.env` is loaded after this app's own `.env`. Production still
// uses injected environment variables and never depends on these files.
import { fileURLToPath } from "node:url";

import { loadEnv } from "@csa/config";

loadEnv({
  extraPaths: [
    fileURLToPath(new URL("../.env", import.meta.url)),
    fileURLToPath(new URL("../../../auth/.env", import.meta.url)),
  ],
});
