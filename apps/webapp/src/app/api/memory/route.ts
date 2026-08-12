import { NextRequest, NextResponse } from 'next/server';

/**
 * GET /api/memory
 *
 * Returns working + episodic memory for the current agent session.
 * Real memory service is not yet implemented — return empty payload so the AI
 * does not receive stale/hardcoded context that contaminates every conversation.
 */
export async function GET(_request: NextRequest) {
  const payload = {
    workingMemory: null,
    episodicMemory: [],
  };

  return NextResponse.json(payload, { headers: { 'Cache-Control': 'no-store' } });
}
