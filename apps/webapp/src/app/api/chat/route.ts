import { NextRequest, NextResponse } from 'next/server';

const MOCK_SESSION_MESSAGES: Record<string, Array<{ id: string; role: 'user' | 'assistant'; content: string; createdAt?: string }>> = {
  'sess-today-1': [
    {
      id: 'm-1',
      role: 'user',
      content: 'I need to check if Order #ORD-RC-715370 is eligible for a return.',
      createdAt: '2026-08-08T14:20:00Z',
    },
    {
      id: 'm-2',
      role: 'assistant',
      content: 'I looked up Order #ORD-RC-715370 for Shivam Soni. The order was delivered on 01 Aug 2026 (7 days ago), which is within our 30-day return window. The items are eligible for return. Would you like me to initiate the return process?',
      createdAt: '2026-08-08T14:20:05Z',
    },
    {
      id: 'm-3',
      role: 'user',
      content: 'Yes, please start the return for the Vacuum Sealer Bags Roll.',
      createdAt: '2026-08-08T14:21:00Z',
    },
    {
      id: 'm-4',
      role: 'assistant',
      content: 'I have prepared the return authorization for 1x Vacuum Sealer Bags Roll (SKU-BAG-ROLL-50). Please approve the return action using the approval button.',
      createdAt: '2026-08-08T14:21:08Z',
    },
  ],
  'sess-yesterday-1': [
    {
      id: 'm-10',
      role: 'user',
      content: 'Can you check the shipping status for Pooja Naik order #ORD-RC-884210?',
      createdAt: '2026-08-07T11:15:00Z',
    },
    {
      id: 'm-11',
      role: 'assistant',
      content: 'Order #ORD-RC-884210 for Pooja Naik is currently Shipped via Express Courier. Tracking ID: TRK-RC-99214. Estimated delivery is tomorrow by 5:00 PM.',
      createdAt: '2026-08-07T11:15:04Z',
    },
  ],
  'sess-week-1': [
    {
      id: 'm-20',
      role: 'user',
      content: 'What replacement parts are available for the Vacuum Sealer L10 machine?',
      createdAt: '2026-08-05T09:00:00Z',
    },
    {
      id: 'm-21',
      role: 'assistant',
      content: 'The available replacement parts for the L10 machine are:\n1. Replacement Heating Seal Bar (SKU-SEAL-BAR-REPL) - $18.99\n2. Vacuum Sealer Lids & Gaskets (SKU-GASKET-L10) - $12.50\n\nBoth items are currently in stock.',
      createdAt: '2026-08-05T09:00:06Z',
    },
  ],
};

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const sessionId = url.searchParams.get('sessionId') || 'sess-today-1';

  const messages = MOCK_SESSION_MESSAGES[sessionId] || MOCK_SESSION_MESSAGES['sess-today-1'];

  return NextResponse.json({ messages }, { headers: { 'Cache-Control': 'no-store' } });
}
