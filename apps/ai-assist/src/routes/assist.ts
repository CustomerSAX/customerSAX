import { Router } from "express";
import { getCommerceContext } from "../commerce/client.js";
import { completeWithLlm } from "../llm/index.js";

export const assistRouter = Router();

assistRouter.post("/assist", async (request, response, next) => {
  const message = String(request.body?.message ?? "hello");
  const provider = request.body?.provider;

  try {
    const commerce = await getCommerceContext();
    const result = await completeWithLlm({
      message,
      provider: typeof provider === "string" ? provider : undefined
    });

    response.json({
      commerce,
      input: message,
      ...result
    });
  } catch (error) {
    next(error);
  }
});
