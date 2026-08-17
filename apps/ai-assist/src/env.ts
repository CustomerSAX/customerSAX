// Side-effect module: load `.env` before anything that reads `process.env`.
// Imported first (as `import "./env.js"`) so it runs ahead of `config.js` and the
// commerce client — replacing the former inline `dotenv` bootstrap in index.ts.
import { fileURLToPath } from "node:url";

import { loadEnv } from "@csa/config";

loadEnv({
  extraPaths: [fileURLToPath(new URL("../.env", import.meta.url))],
});
