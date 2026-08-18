import { NextRequest, NextResponse } from 'next/server';
import { authServiceUrl, currentSessionToken } from '@/app/api/auth/shared';

const AUTH_SERVICE_URL = authServiceUrl();

function stringField(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

export async function POST(request: NextRequest) {
  try {
    const token = currentSessionToken();
    if (!token) {
      return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
    }

    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const tabId = stringField(body.tabId);

    if (!tabId) {
      return NextResponse.json({ error: 'tabId is required' }, { status: 400 });
    }

    const res = await fetch(`${AUTH_SERVICE_URL}/presence/heartbeat`, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${token}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        tabId,
        status: body.status === 'away' ? 'away' : 'online',
        activeRoute: stringField(body.activeRoute) || undefined,
        activeTicketId: stringField(body.activeTicketId) || undefined,
      }),
      cache: 'no-store',
    });

    if (!res.ok) {
      console.error(`[api/presence/heartbeat] auth returned ${res.status}`);
      return NextResponse.json({ ok: false }, { status: 502 });
    }

    return new NextResponse(null, { status: 204 });
  } catch (err) {
    console.error('[api/presence/heartbeat] failed:', err);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
