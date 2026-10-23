import { Router } from "express";
import { aiStatsRouter } from "./ai-stats.js";
import { assistRouter } from "./assist.js";
import { chatRouter } from "./chat.js";
import { healthRouter } from "./health.js";
import { providersRouter } from "./providers.js";
import { quoteReviewRouter } from "./quote-review.js";
import { ticketReviewRouter } from "./ticket-review.js";

export const routes = Router();

routes.use(healthRouter);
routes.use(providersRouter);
routes.use(assistRouter);
routes.use(chatRouter);
routes.use(ticketReviewRouter);
routes.use(quoteReviewRouter);
routes.use(aiStatsRouter);
