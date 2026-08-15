import { NextRequest, NextResponse } from 'next/server';
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
    url.searchParams.set('userEmail', user.email);
    url.searchParams.set('projectKey', CT_PROJECT_KEY);
    url.searchParams.set('limit', limit);
    url.searchParams.set('skip', skip);

    const res = await fetch(url.toString(), { cache: 'no-store', headers: forwardRequestId(requestId) });
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
