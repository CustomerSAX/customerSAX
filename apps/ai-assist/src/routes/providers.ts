import { Router } from "express";
import { getCommercePlatform } from "../commerce/platform.js";
import { getConfiguredProvider, listProviders } from "../llm/index.js";

export const providersRouter = Router();

providersRouter.get("/providers", (_request, response) => {
  response.json({
    commercePlatform: getCommercePlatform(),
    defaultProvider: getConfiguredProvider(),
    providers: listProviders()
  });
});
