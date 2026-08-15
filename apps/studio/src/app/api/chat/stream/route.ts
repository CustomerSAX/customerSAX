import { NextRequest, NextResponse } from 'next/server';
import { applyCsaHeaders } from '@csa/headers';
import { getCurrentUser } from '@/lib/get-current-user';
import { requestLogger } from '@/lib/request-logger';

// Streaming SSE proxy — never statically optimized, always dynamic.
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const AI_ASSIST_URL = process.env.AI_ASSIST_URL ?? 'http://localhost:8080';

/**
 * Identity / ACL keys that must NEVER be trusted from the browser body.
 *
 * Before this route existed the browser POSTed the chat stream directly to
 * ai-assist with its own identity + permission flags in the request body —
 * ai-assist trusted the client for its own identity (tenant impersonation,
 * privilege escalation, IDOR on chat history). This proxy derives identity
 * server-side from the httpOnly session and forwards it as trusted x-csa-*
 * headers; ai-assist ignores the body for identity/ACL. We additionally strip
 * these keys from the forwarded body context as defence-in-depth so a rogue
 * client that goes *through* the proxy still can't smuggle them.
 */
const UNTRUSTED_CONTEXT_KEYS = new Set([
  'userEmail',
  'userRole',
  'projectKey',
  'clientId',
  'canViewTickets',
  'canCreateTickets',
  'canUpdateTickets',
  'canViewOrders',
  'canCreateOrders',
  'canUpdateOrders',
  'canViewCustomers',
  'canCreateCustomers',
  'canUpdateCustomers',
  'canViewCarts',
  'canCreateCarts',
  'canUpdateCarts',
  'canViewProducts',
]);

/**
 * POST /api/chat/stream
 *
 * Same-origin streaming proxy for the CSA Assistant chat. The browser talks to
 * this route (cookies flow automatically); this route:
 *   1. Resolves the authenticated user server-side (401 if none).
 *   2. Derives identity — userEmail, role, projectKey, clientId — from the
 *      trusted session and forwards it to ai-assist as x-csa-* headers. The
 *      role→ACL mapping lives in ai-assist, keyed on the trusted role header.
 *   3. Forwards messages/sessionId/(benign presentation context) in the body.
 *   4. PIPES ai-assist's SSE response straight back to the browser without
 *      buffering, preserving content-type and the x-session-id passthrough.
 */
export async function POST(request: NextRequest): Promise<Response> {
  const { log, requestId } = requestLogger(request, 'api/chat/stream');

  const user = await getCurrentUser();
  if (!user?.email) {
    return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
  }

  let incoming: Record<string, unknown>;
  try {
    incoming = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: 'invalid request body' }, { status: 400 });
  }

  // Keep only benign, non-identity presentation context (pageContext,
  // businessType, proactiveHint, vipThreshold). Identity + ACL are supplied by
  // the trusted headers below and ignored from the body by ai-assist.
  const rawContext = (incoming.context ?? {}) as Record<string, unknown>;
  const safeContext: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(rawContext)) {
    if (!UNTRUSTED_CONTEXT_KEYS.has(key)) safeContext[key] = value;
  }

  const forwardBody = {
    messages: incoming.messages ?? [],
    sessionId: incoming.sessionId,
    provider: incoming.provider,
    context: safeContext,
  };

  const headers = new Headers({ 'content-type': 'application/json' });
  // Trusted, server-derived identity. Only present fields are written. The raw
  // role is forwarded so ai-assist can derive the ACL from it (single source of
  // truth for role→permission mapping).
  applyCsaHeaders(headers, {
    userEmail: user.email,
    userRole: user.role,
    projectKey: user.activeProjectKey,
    clientId: user.activeClientId,
    requestId,
  });

  let upstream: Response;
  try {
    upstream = await fetch(`${AI_ASSIST_URL}/chat`, {
      method: 'POST',
      headers,
      body: JSON.stringify(forwardBody),
      cache: 'no-store',
    });
  } catch (err) {
    log.error('ai-assist unreachable', err);
    return NextResponse.json({ error: 'assistant unavailable' }, { status: 502 });
  }

  // Pipe the SSE stream straight back — DO NOT buffer/await the whole body.
  const responseHeaders = new Headers();
  const contentType = upstream.headers.get('content-type');
  if (contentType) responseHeaders.set('content-type', contentType);

  // Preserve the x-session-id passthrough the client relies on.
  const sessionId = upstream.headers.get('x-session-id');
  if (sessionId) {
    responseHeaders.set('x-session-id', sessionId);
    responseHeaders.set('Access-Control-Expose-Headers', 'x-session-id');
  }

  // Preserve the AI SDK UI-message-stream marker if present, and keep proxies
  // from buffering the SSE.
  const uiStreamMarker = upstream.headers.get('x-vercel-ai-ui-message-stream');
  if (uiStreamMarker) responseHeaders.set('x-vercel-ai-ui-message-stream', uiStreamMarker);
  responseHeaders.set('Cache-Control', 'no-store, no-transform');

  return new Response(upstream.body, {
    status: upstream.status,
    headers: responseHeaders,
  });
}
