import { NextRequest, NextResponse } from 'next/server';
import { applyCsaHeaders } from '@csa/headers';
import { getCurrentUser } from '@/lib/get-current-user';
import { forwardRequestId, requestLogger } from '@/lib/request-logger';

/**
 * GET /api/memory?sessionId=<id>&customerId=<id>&customerName=<name>&customerEmail=<email>
 *
 * Returns the two-tier memory state for the sidebar Memory tab:
 *   - workingMemory: Redis-backed active session context (goal/intent/sentiment)
 *   - episodicMemory: MongoDB-backed historical interaction summaries
 *
 * This route proxies through to ai-assist's GET /memory endpoint so the studio
 * never directly talks to Redis or MongoDB. Working memory is scoped to the
 * sessionId; episodic memory is scoped to the customerId and the authenticated
 * agent's email.
 *
 * Query params:
 *   sessionId     — active chat session ID (fetches Redis working memory)
 *   customerId    — CT customer UUID (fetches customer-scoped episodic entries)
 *   customerName  — customer display name (used for name-based fallback matching)
 *   customerEmail — customer email (used for email-based fallback matching)
 */

const AI_ASSIST_URL = process.env.AI_ASSIST_URL ?? 'http://localhost:8080';

export async function GET(request: NextRequest): Promise<NextResponse> {
  const { log, requestId } = requestLogger(request, 'api/memory');
  const { searchParams } = new URL(request.url);
  const sessionId     = searchParams.get('sessionId')?.trim()     ?? '';
  const customerId    = searchParams.get('customerId')?.trim()    ?? '';
  const customerName  = searchParams.get('customerName')?.trim()  ?? '';
  const customerEmail = searchParams.get('customerEmail')?.trim() ?? '';

  // Agent identity is derived server-side from the session and forwarded to
  // ai-assist as trusted x-csa-* headers — episodic memory is scoped to the
  // authenticated agent, never a client-supplied userEmail.
  const user = await getCurrentUser();
  const projectKey = user?.activeProjectKey || process.env.NEXT_PUBLIC_CT_PROJECT_KEY || '';

  // Nothing meaningful to look up — return empty state immediately.
  if (!sessionId && !customerId) {
    return NextResponse.json(
      { workingMemory: null, episodicMemory: [] },
      { headers: { 'Cache-Control': 'no-store' } }
    );
  }

  try {
    const upstream = new URL(`${AI_ASSIST_URL}/memory`);
    if (sessionId)     upstream.searchParams.set('sessionId',     sessionId);
    if (customerId)    upstream.searchParams.set('customerId',    customerId);
    if (customerName)  upstream.searchParams.set('customerName',  customerName);
    if (customerEmail) upstream.searchParams.set('customerEmail', customerEmail);

    // Identity (userEmail/projectKey) travels as trusted x-csa-* headers, not
    // query params — ai-assist scopes episodic memory to the header identity.
    const headers = applyCsaHeaders(
      forwardRequestId(requestId, { 'content-type': 'application/json' }),
      {
        userEmail: user?.email,
        projectKey: projectKey || undefined,
        clientId: user?.activeClientId,
      }
    );

    const res = await fetch(upstream.toString(), {
      method: 'GET',
      headers,
      // Short cache — memory should be fresh on every polling cycle.
      cache: 'no-store',
    });

    if (!res.ok) {
      log.warn('ai-assist returned non-ok — returning empty state', { status: res.status });
      return NextResponse.json(
        { workingMemory: null, episodicMemory: [] },
        { headers: { 'Cache-Control': 'no-store' } }
      );
    }

    const data = await res.json() as {
      workingMemory: unknown;
      episodicMemory: unknown[];
    };

    return NextResponse.json(data, { headers: { 'Cache-Control': 'no-store' } });
  } catch (err) {
    // ai-assist unreachable — degrade gracefully, same as Redis/MongoDB unavailable.
    log.warn('ai-assist unreachable (non-fatal)', { reason: (err as Error).message });
    return NextResponse.json(
      { workingMemory: null, episodicMemory: [] },
      { headers: { 'Cache-Control': 'no-store' } }
    );
  }
}
