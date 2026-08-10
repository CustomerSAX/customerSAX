import type { IncomingMessage, ServerResponse } from "node:http";

export async function readJsonBody<TBody>(request: IncomingMessage): Promise<TBody> {
  const chunks: Buffer[] = [];

  for await (const chunk of request) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }

  const raw = Buffer.concat(chunks).toString("utf8").trim();

  if (!raw) {
    return {} as TBody;
  }

  return JSON.parse(raw) as TBody;
}

export function sendJson(response: ServerResponse, statusCode: number, body: unknown) {
  response.writeHead(statusCode, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store"
  });
  response.end(JSON.stringify(body));
}

export function sendNoContent(response: ServerResponse) {
  response.writeHead(204, {
    "cache-control": "no-store"
  });
  response.end();
}
