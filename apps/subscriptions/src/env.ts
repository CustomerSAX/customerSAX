import { fileURLToPath } from "node:url";
import { loadEnv } from "@csa/config";

loadEnv({
  extraPaths: [fileURLToPath(new URL("../.env", import.meta.url))]
});
