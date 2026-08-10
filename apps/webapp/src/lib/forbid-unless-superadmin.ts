/**
 * Guard helper for /api/superadmin/* route handlers. Returns a 401/403
 * NextResponse when the caller shouldn't proceed, or null when they may.
 */

import { NextResponse } from 'next/server';
import type { CurrentUser } from './get-current-user';

export function forbidUnlessSuperadmin(user: CurrentUser | null): NextResponse | null {
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (user.role !== 'superadmin') {
    return NextResponse.json({ error: 'Forbidden — superadmin role required' }, { status: 403 });
  }
  return null;
}
