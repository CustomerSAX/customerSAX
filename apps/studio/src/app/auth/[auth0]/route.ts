/**
 * Auth0 SDK catch-all route handler for /auth/[auth0].
 *
 * The middleware already intercepts GET requests to /auth/* and forwards them
 * to auth0.middleware(), which handles:
 *   /auth/login    → redirect to Auth0 Universal Login
 *   /auth/callback → exchange code for session cookie
 *   /auth/logout   → clear session + redirect
 *
 * This route exists as a safety net and for non-middleware deployments.
 */

import { auth0 } from '@/lib/auth0-client';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest): Promise<NextResponse> {
  return auth0.middleware(request) as Promise<NextResponse>;
}

export function HEAD(): NextResponse {
  return new NextResponse(null, { status: 200 });
}
