import { Router } from "express";
import { assistRouter } from "./assist.js";
import { healthRouter } from "./health.js";
import { providersRouter } from "./providers.js";

export const routes = Router();

routes.use(healthRouter);
routes.use(providersRouter);
routes.use(assistRouter);

