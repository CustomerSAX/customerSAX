import { Router } from "express";
import { getCommercePlatform } from "../commerce/platform.js";
import { completeWithLlm } from "../llm/index.js";

export const assistRouter = Router();

assistRouter.post("/assist", async (request, response, next) => {
  const message = String(request.body?.message ?? "hello");
  const provider = request.body?.provider;

  try {
    const result = await completeWithLlm({
      message,
      provider: typeof provider === "string" ? provider : undefined
    });

    response.json({
      commercePlatform: getCommercePlatform(),
      input: message,
      ...result
    });
  } catch (error) {
    next(error);
  }
});
