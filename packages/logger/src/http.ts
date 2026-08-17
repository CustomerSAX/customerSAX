/**
 * Edge helpers that seed the request context and emit one access log per
 * request, for the three server shapes CSA uses:
 *   - `withHttpContext` — raw `node:http` handlers (the auth service);
 *   - `expressContext`  — Express middleware (ai-assist);
 *   - `apolloContext` + `apolloLoggingPlugin` — Apollo subgraphs / gateway.
 *
 * All three read an inbound `x-request-id` (or generate one), so a correlation
 * id set at the studio/BFF edge flows through every downstream hop.
 */
import type { IncomingMessage, ServerResponse } from "node:http";
import { CSA_HEADERS, readCsaContext } from "@csa/headers";
import { enterContext, newRequestId, runWithContext, type RequestContext } from "./context.js";
import type { Logger } from "./logger.js";

/**
 * The header services echo/forward so a correlation id survives every hop.
 * Re-exported from the shared `@csa/headers` contract so there is one source of
 * truth for the header name (kept here for backwards compatibility).
 */
export const REQUEST_ID_HEADER = CSA_HEADERS.requestId;

function inboundRequestId(headers: IncomingMessage["headers"]): string {
  return readCsaContext({ headers }).requestId?.trim() || newRequestId();
}

/**
 * Wraps a `node:http` handler: extracts/generates the request id, echoes it as
 * `X-Request-Id`, runs the handler inside the request context, and logs one
 * access line when the response finishes.
 */
export function withHttpContext(
  logger: Logger,
  handler: (req: IncomingMessage, res: ServerResponse) => void | Promise<void>
): (req: IncomingMessage, res: ServerResponse) => void {
  return (req, res) => {
    const requestId = inboundRequestId(req.headers);
    const method = req.method;
    const path = (req.url ?? "/").split("?")[0];
    res.setHeader("X-Request-Id", requestId);

    const context: RequestContext = { requestId, method, path };
    const start = Date.now();
    res.on("finish", () => {
      logger.info("request", { method, path, status: res.statusCode, durationMs: Date.now() - start });
    });

    runWithContext(context, () => {
      void Promise.resolve(handler(req, res)).catch((error) => {
        logger.error("unhandled request error", error, { method, path });
        if (!res.headersSent) {
          res.statusCode = 500;
          res.end();
        }
      });
    });
  };
}

/**
 * Express middleware equivalent of `withHttpContext`. Seeds the context, echoes
 * `X-Request-Id`, and logs one access line on response finish.
 */
export function expressContext(logger: Logger) {
  return (req: IncomingMessage & { url?: string }, res: ServerResponse, next: () => void) => {
    const requestId = inboundRequestId(req.headers);
    const method = req.method;
    const path = (req.url ?? "/").split("?")[0];
    res.setHeader("X-Request-Id", requestId);

    const start = Date.now();
    res.on("finish", () => {
      logger.info("request", { method, path, status: res.statusCode, durationMs: Date.now() - start });
    });

    runWithContext({ requestId, method, path }, () => next());
  };
}

/**
 * Builds a `RequestContext` from an inbound request's headers for use inside an
 * Apollo `context` factory. Reads the CSA identity headers plus `x-request-id`.
 * Callers should spread the result into their Apollo context and call
 * `enterContext` on it (or use `apolloLoggingPlugin`, which does so) so the
 * logger picks it up.
 */
export function apolloContext(req: { headers: IncomingMessage["headers"] }): RequestContext {
  const csa = readCsaContext(req);
  return {
    requestId: csa.requestId?.trim() || newRequestId(),
    projectKey: csa.projectKey,
    clientId: csa.clientId,
    userRole: csa.userRole,
    userEmail: csa.userEmail,
    method: "POST",
    path: "/graphql",
  };
}

type ApolloRequestContext = {
  contextValue?: Partial<RequestContext>;
  request?: { operationName?: string | null };
  operationName?: string | null;
};

/**
 * Apollo Server plugin that binds the per-request context (built by
 * `apolloContext` and stored on `contextValue`) to the operation's async chain
 * and logs one access line with the operation name and duration.
 */
export function apolloLoggingPlugin(logger: Logger) {
  return {
    async requestDidStart(requestContext: ApolloRequestContext) {
      const ctx = requestContext.contextValue;
      if (ctx?.requestId) enterContext(ctx as RequestContext);
      const start = Date.now();
      return {
        async willSendResponse(rc: ApolloRequestContext) {
          const operationName = rc.operationName ?? rc.request?.operationName ?? undefined;
          logger.info("graphql", { operationName: operationName ?? "anonymous", durationMs: Date.now() - start });
        },
      };
    },
  };
}
