import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const root = new URL("../../../", import.meta.url);
const read = (path: string) => readFileSync(new URL(path, root), "utf8");
type Manifest = {
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
};

function dependencies(manifestPath: string, includeDev: boolean): Set<string> {
  const found = new Set<string>();
  const visit = (path: string) => {
    const manifest = JSON.parse(read(path)) as Manifest;
    const entries = {
      ...manifest.dependencies,
      ...(includeDev ? manifest.devDependencies : {})
    };
    for (const [name, version] of Object.entries(entries)) {
      if (!version.startsWith("workspace:")) continue;
      const directory =
        name === "@csa/config-typescript"
          ? "configs/typescript"
          : `packages/${name.replace("@csa/", "")}`;
      if (found.has(directory)) continue;
      found.add(directory);
      visit(`${directory}/package.json`);
    }
  };
  visit(manifestPath);
  return found;
}

describe("Hub backend Docker dependency closure", () => {
  for (const service of ["admin", "crm", "ticketing"]) {
    it(`${service} installs, builds and ships its workspace dependencies`, () => {
      const dockerfile = read(`apps/${service}/Dockerfile`);
      const installAt = dockerfile.indexOf("RUN pnpm install");
      const buildAt = dockerfile.indexOf("RUN pnpm --filter");
      expect(installAt).toBeGreaterThan(0);
      expect(buildAt).toBeGreaterThan(installAt);
      const manifests = new Set(
        [...dockerfile.slice(0, installAt).matchAll(/^COPY (\S+\/package.json) /gm)].map(
          (match) => match[1]
        )
      );
      const sources = new Set(
        [...dockerfile.slice(0, buildAt).matchAll(/^COPY (\S+) /gm)].map(
          (match) => match[1]
        )
      );
      const shipped = new Set(
        [...dockerfile.matchAll(/^COPY --from=build \/app\/(\S+) /gm)].map(
          (match) => match[1]
        )
      );
      const manifest = `apps/${service}/package.json`;
      for (const directory of dependencies(manifest, true)) {
        const message = `${fileURLToPath(root)}apps/${service}/Dockerfile: ${directory}`;
        expect(manifests, `${message} missing at dependency installation`).toContain(
          `${directory}/package.json`
        );
        expect(sources, `${message} missing at compilation`).toContain(directory);
      }
      for (const directory of dependencies(manifest, false)) {
        expect(shipped, `${service}: ${directory} missing from runtime image`).toContain(
          directory
        );
      }
    });
  }
});
