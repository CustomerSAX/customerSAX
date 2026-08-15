/**
 * Edge helpers that seed the request context and emit one access log per
 * request, for the three server shapes CSA uses:
 *   - `withHttpContext` — raw `node:http` handlers (the auth service);
 *   - `expressContext`  — Express middleware (ai-assist);
 *   - `apolloContext` + `apolloLoggingPlugin` — Apollo subgraphs / gateway.
 *
 * All three read an inbound `x-request-id` (or generate one), so a correlation
 * id set at the webapp/BFF edge flows through every downstream hop.
 */
import type { IncomingMessage, ServerResponse } from "node:http";
import { enterContext, newRequestId, runWithContext, type RequestContext } from "./context.js";
import type { Logger } from "./logger.js";

/** The header services echo/forward so a correlation id survives every hop. */
export const REQUEST_ID_HEADER = "x-request-id";

function headerValue(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function inboundRequestId(headers: IncomingMessage["headers"]): string {
  return headerValue(headers[REQUEST_ID_HEADER])?.trim() || newRequestId();
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
  const headers = req.headers;
  return {
    requestId: inboundRequestId(headers),
    projectKey: headerValue(headers["x-csa-project-key"]),
    clientId: headerValue(headers["x-csa-client-id"]),
    userRole: headerValue(headers["x-csa-user-role"]),
    userEmail: headerValue(headers["x-csa-user-email"]),
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
