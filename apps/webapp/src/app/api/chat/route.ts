import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/get-current-user';
import { forwardRequestId, requestLogger } from '@/lib/request-logger';

const AI_ASSIST_URL = process.env.AI_ASSIST_URL ?? 'http://localhost:8080';

/**
 * GET /api/chat?sessionId=xxx
 *
 * Proxies to ai-assist GET /chat, scoped to the authenticated user.
 * Used by the ChatHistory panel to load the transcript for a past session.
 *
 * Returns { messages: StoredMessage[] } where each message has { id, role, content, createdAt }.
 */
export async function GET(request: NextRequest) {
  const { log, requestId } = requestLogger(request, 'api/chat');
  try {
    const user = await getCurrentUser();
    if (!user?.email) {
      return NextResponse.json({ messages: [] });
    }

    const { searchParams } = new URL(request.url);
    const sessionId = searchParams.get('sessionId')?.trim();
    if (!sessionId) {
      return NextResponse.json({ messages: [] });
    }

    const url = new URL(`${AI_ASSIST_URL}/chat`);
    url.searchParams.set('sessionId', sessionId);
    url.searchParams.set('userEmail', user.email);

    const res = await fetch(url.toString(), { cache: 'no-store', headers: forwardRequestId(requestId) });
    if (!res.ok) {
      log.error('ai-assist returned non-ok', undefined, { status: res.status });
      return NextResponse.json({ messages: [] });
    }

    const data = await res.json();
    return NextResponse.json(data, { headers: { 'Cache-Control': 'no-store' } });
  } catch (err) {
    log.error('GET failed', err);
    return NextResponse.json({ messages: [] });
  }
}
