import { NextRequest, NextResponse } from 'next/server';
import { applyCsaHeaders } from '@csa/headers';
import { getCurrentUser } from '@/lib/get-current-user';
import { forwardRequestId, requestLogger } from '@/lib/request-logger';

const AI_ASSIST_URL = process.env.AI_ASSIST_URL ?? 'http://localhost:8080';
const CT_PROJECT_KEY = process.env.NEXT_PUBLIC_CT_PROJECT_KEY ?? '';

/**
 * GET /api/chat/sessions
 *
 * Proxies to the ai-assist GET /sessions endpoint, scoped to the
 * authenticated user's email. The History panel consumes this to display
 * past conversations grouped by date.
 *
 * Query params forwarded: limit, skip
 */
export async function GET(request: NextRequest) {
  const { log, requestId } = requestLogger(request, 'api/chat/sessions');
  try {
    const user = await getCurrentUser();
    if (!user?.email) {
      return NextResponse.json({ sessions: [], total: 0 });
    }

    const { searchParams } = new URL(request.url);
    const limit = searchParams.get('limit') ?? '40';
    const skip = searchParams.get('skip') ?? '0';

    const url = new URL(`${AI_ASSIST_URL}/sessions`);
    url.searchParams.set('limit', limit);
    url.searchParams.set('skip', skip);

    // Identity (userEmail/projectKey) travels as trusted x-csa-* headers, not
    // query params — ai-assist scopes the session list to the header identity.
    const headers = applyCsaHeaders(forwardRequestId(requestId), {
      userEmail: user.email,
      projectKey: user.activeProjectKey || CT_PROJECT_KEY || undefined,
      clientId: user.activeClientId,
    });

    const res = await fetch(url.toString(), { cache: 'no-store', headers });
    if (!res.ok) {
      log.error('ai-assist returned non-ok', undefined, { status: res.status });
      return NextResponse.json({ sessions: [], total: 0 });
    }

    const data = await res.json();
    return NextResponse.json(data);
  } catch (err) {
    log.error('failed', err);
    return NextResponse.json({ sessions: [], total: 0 });
  }
}

/**
 * PATCH /api/chat/sessions
 *
 * Renames an existing chat session with server-side identity validation.
 * Body: { sessionId: string, title: string }
 */
export async function PATCH(request: NextRequest) {
  const { log, requestId } = requestLogger(request, 'api/chat/sessions:patch');
  try {
    const user = await getCurrentUser();
    if (!user?.email) {
      return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
    }

    const body = (await request.json().catch(() => ({}))) as { sessionId?: string; title?: string };
    const { searchParams } = new URL(request.url);
    const sessionId = (body.sessionId || searchParams.get('sessionId'))?.trim();
    const title = body.title?.trim();

    if (!sessionId || !title) {
      return NextResponse.json({ error: 'sessionId and title are required' }, { status: 400 });
    }

    const url = new URL(`${AI_ASSIST_URL}/sessions`);
    const headers = new Headers({ 'content-type': 'application/json' });
    applyCsaHeaders(headers, {
      userEmail: user.email,
      projectKey: user.activeProjectKey || CT_PROJECT_KEY || undefined,
      clientId: user.activeClientId,
      requestId,
    });

    const res = await fetch(url.toString(), {
      method: 'PATCH',
      headers,
      body: JSON.stringify({ sessionId, title }),
      cache: 'no-store',
    });

    const data = await res.json().catch(() => ({}));
    return NextResponse.json(data, { status: res.status });
  } catch (err) {
    log.error('rename session failed', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * DELETE /api/chat/sessions?sessionId=xxx
 *
 * Deletes an existing chat session with server-side identity validation.
 */
export async function DELETE(request: NextRequest) {
  const { log, requestId } = requestLogger(request, 'api/chat/sessions:delete');
  try {
    const user = await getCurrentUser();
    if (!user?.email) {
      return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    let sessionId = searchParams.get('sessionId')?.trim();
    if (!sessionId) {
      const body = (await request.json().catch(() => ({}))) as { sessionId?: string };
      sessionId = body.sessionId?.trim();
    }

    if (!sessionId) {
      return NextResponse.json({ error: 'sessionId is required' }, { status: 400 });
    }

    const url = new URL(`${AI_ASSIST_URL}/sessions`);
    url.searchParams.set('sessionId', sessionId);

    const headers = new Headers();
    applyCsaHeaders(headers, {
      userEmail: user.email,
      projectKey: user.activeProjectKey || CT_PROJECT_KEY || undefined,
      clientId: user.activeClientId,
      requestId,
    });

    const res = await fetch(url.toString(), {
      method: 'DELETE',
      headers,
      cache: 'no-store',
    });

    const data = await res.json().catch(() => ({}));
    return NextResponse.json(data, { status: res.status });
  } catch (err) {
    log.error('delete session failed', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

