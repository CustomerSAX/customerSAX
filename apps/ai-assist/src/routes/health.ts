import { Router } from "express";
import { getCommercePlatform } from "../commerce/platform.js";
import { getConfiguredProvider, listProviders } from "../llm/index.js";

export const healthRouter = Router();

healthRouter.get("/health", (_request, response) => {
  response.json({
    commercePlatform: getCommercePlatform(),
    defaultProvider: getConfiguredProvider(),
    providers: listProviders(),
    service: "ai-assist",
    status: "ok"
  });
});
