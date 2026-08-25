import { NextRequest, NextResponse } from 'next/server';
import { clientsRepo, usersRepo } from '@csa/mongodb';

export interface SsoDiscoverClient {
  id: string;
  name: string;
  ssoProvider: 'oidc' | 'saml' | 'none';
}

export interface SsoDiscoverResponse {
  clients: SsoDiscoverClient[];
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  let body: { email?: string };
  try {
    body = (await request.json()) as { email?: string };
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const email = typeof body.email === 'string' ? body.email.toLowerCase().trim() : '';
  if (!email || !email.includes('@')) {
    return NextResponse.json({ error: 'Valid email is required' }, { status: 400 });
  }

  try {
    const user = await usersRepo.findUserByEmail(email);
    if (!user || !user.active) {
      const payload: SsoDiscoverResponse = { clients: [] };
      return NextResponse.json(payload);
    }

    const clientIds = new Set<string>();
    for (const p of user.projects ?? []) {
      const cid = p.clientId?.trim();
      if (cid) clientIds.add(cid);
    }

    const clients: SsoDiscoverClient[] = [];
    for (const cid of Array.from(clientIds)) {
      const c = await clientsRepo.findClientByIdRaw(cid);
      if (!c || c.status !== 'active') continue;
      const p = c.ssoConfig?.provider || 'none';
      clients.push({ id: c._id.toHexString(), name: c.name, ssoProvider: p as 'oidc' | 'saml' | 'none' });
    }

    return NextResponse.json({ clients } satisfies SsoDiscoverResponse);
  } catch (error) {
    console.error('[api/sso/discover]', error);
    return NextResponse.json({ error: 'Discovery failed' }, { status: 500 });
  }
}
