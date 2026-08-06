import { Router } from "express";
import { getCommercePlatform, getCommerceServiceUrl } from "../commerce/platform.js";
import { getConfiguredProvider, listProviders } from "../llm/index.js";

export const providersRouter = Router();

providersRouter.get("/providers", (_request, response) => {
  response.json({
    commercePlatform: getCommercePlatform(),
    commerceServiceConfigured: Boolean(getCommerceServiceUrl()),
    defaultProvider: getConfiguredProvider(),
    providers: listProviders()
  });
});
