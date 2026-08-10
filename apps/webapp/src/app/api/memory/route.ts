import { NextRequest, NextResponse } from 'next/server';

export async function GET(_request: NextRequest) {
  const payload = {
    workingMemory: {
      activeGoal: 'Resolve return request for Order #ORD-RC-715370',
      currentIntent: 'ACTION',
      currentSentiment: 'Concerned',
      currentStrategy: 'Verify return eligibility and guide customer through return process.',
      nextSteps: ['Confirm line items to return', 'Generate return approval label', 'Process refund'],
      lastUpdated: 'Just now',
    },
    episodicMemory: [
      {
        id: 'mem-1',
        type: 'episodic',
        category: 'Order History',
        content: 'Customer requested express shipping on high-value equipment order.',
        timestamp: '01 Aug 2026',
        confidence: 0.95,
      },
      {
        id: 'mem-2',
        type: 'episodic',
        category: 'Customer Preference',
        content: 'VIP customer status verified — priority phone & chat response assigned.',
        timestamp: '28 Jul 2026',
        confidence: 0.92,
      },
      {
        id: 'mem-3',
        type: 'episodic',
        category: 'Support History',
        content: 'Previous inquiry regarding L10 Sealer heating bar replacement resolved smoothly.',
        timestamp: '15 Jul 2026',
        confidence: 0.89,
      },
    ],
  };

  return NextResponse.json(payload, { headers: { 'Cache-Control': 'no-store' } });
}
