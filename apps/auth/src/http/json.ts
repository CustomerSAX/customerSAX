import type { IncomingMessage, ServerResponse } from "node:http";

/**
 * A request-attributable error the top-level handler maps to a specific HTTP
 * status (with a rep-safe message) instead of collapsing to a generic 500.
 */
export class HttpError extends Error {
  constructor(readonly statusCode: number, message: string) {
    super(message);
    this.name = "HttpError";
  }
}

export async function readJsonBody<TBody>(request: IncomingMessage): Promise<TBody> {
  const chunks: Buffer[] = [];

  for await (const chunk of request) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }

  const raw = Buffer.concat(chunks).toString("utf8").trim();

  if (!raw) {
    return {} as TBody;
  }

  try {
    return JSON.parse(raw) as TBody;
  } catch {
    // Malformed JSON is a client mistake, not a server fault — surface a 400
    // with a rep-safe message rather than throwing to the 500 handler.
    throw new HttpError(400, "invalid request body");
  }
}

export function sendJson(
  response: ServerResponse,
  statusCode: number,
  body: unknown,
  extraHeaders?: Record<string, string>
) {
  response.writeHead(statusCode, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
    ...extraHeaders
  });
  response.end(JSON.stringify(body));
}

export function sendNoContent(response: ServerResponse) {
  response.writeHead(204, {
    "cache-control": "no-store"
  });
  response.end();
}
