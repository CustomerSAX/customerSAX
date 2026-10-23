import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { expect, it } from "vitest";

const script = fileURLToPath(new URL("../../../scripts/cloudbuild-service-env.sh", import.meta.url));
function environment(service: string, overrides: Record<string, string> = {}) {
  return spawnSync("bash", ["-c", 'source "$1"; ai_review_service_env "$2"', "routing-test", script, service], {
    encoding: "utf8",
    env: { PATH: process.env.PATH, ENVIRONMENT: "production", BFF_URL: "https://gateway.example/", AI_ASSIST_URL: "https://ai.example/", AUTH_URL: "https://auth.example/", ...overrides }
  });
}

it("routes AI ticket queries through the federated GraphQL endpoint", () => {
  const result = environment("ai-assist");
  expect(result.status).toBe(0);
  const env = Object.fromEntries(result.stdout.trim().split(",").map(item => item.split("=")));
  expect(env.AI_COMMERCE_SERVICE_URL).toBe("https://gateway.example/graphql");
  expect(env.AUTH_SERVICE_URL).toBe("https://auth.example");
  expect(env.SERVICE_NAME).toBe("ai-assist");
});

it("routes ticket status requests to deployed AI Assist rather than localhost", () => {
  const result = environment("ticketing");
  expect(result.status).toBe(0);
  const env = Object.fromEntries(result.stdout.trim().split(",").map(item => item.split("=")));
  expect(`${env.AI_ASSIST_URL}/ticket-review/statuses`).toBe("https://ai.example/ticket-review/statuses");
  expect(env.SERVICE_NAME).toBe("ticketing");
});

it.each([['ai-assist', 'BFF_URL'], ['ticketing', 'AI_ASSIST_URL']])("fails deployment routing when %s is missing %s", (service, key) => {
  const result = environment(service, { [key]: "" });
  expect(result.status).not.toBe(0);
  expect(result.stderr).toContain(`${key} is required`);
  expect(result.stdout).toBe("");
});
