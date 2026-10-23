import { Router } from "express";
import { readCsaContext } from "@csa/headers";
import { createLogger } from "@csa/logger";
import { reviewStats } from "../ticket-review/store.js";

const log = createLogger("ai-assist").child({ module: "ai-stats" });
export const aiStatsRouter = Router();

// GET /ai-stats — dashboard counts for the caller's own client project.
// Scope comes only from the trusted x-csa-* headers set by the studio proxy.
aiStatsRouter.get("/ai-stats", async (request, response) => {
  const { clientId, projectKey } = readCsaContext(request);
  if (!clientId?.trim() || !projectKey?.trim()) {
    response.status(400).json({ error: "A client project is required." });
    return;
  }
  try {
    response.json(await reviewStats({ clientId: clientId.trim(), projectKey: projectKey.trim() }));
  } catch (error) {
    log.warn("ai-stats unavailable", { error: error instanceof Error ? error.message : String(error) });
    response.status(503).json({ error: "AI activity data is unavailable right now." });
  }
});
