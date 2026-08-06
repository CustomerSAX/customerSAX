import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const appEnvPath = fileURLToPath(new URL("../../.env", import.meta.url));
const cwdEnvPath = resolve(process.cwd(), ".env");

for (const envPath of Array.from(new Set([cwdEnvPath, appEnvPath]))) {
  loadEnvFile(envPath);
}

function loadEnvFile(envPath: string) {
  if (!existsSync(envPath)) {
    return;
  }

  const lines = readFileSync(envPath, "utf8").split(/\r?\n/);

  for (const line of lines) {
    const trimmed = line.trim();

    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }

    const separatorIndex = trimmed.indexOf("=");

    if (separatorIndex === -1) {
      continue;
    }

    const name = trimmed.slice(0, separatorIndex).trim();
    const value = normalizeEnvValue(trimmed.slice(separatorIndex + 1).trim());

    if (name && process.env[name] === undefined) {
      process.env[name] = value;
    }
  }
}

function normalizeEnvValue(value: string) {
  const quote = value[0];
  const last = value[value.length - 1];

  if ((quote === "\"" || quote === "'" || quote === "`") && last === quote) {
    return value.slice(1, -1).replace(/\\n/g, "\n");
  }

  return value;
}
