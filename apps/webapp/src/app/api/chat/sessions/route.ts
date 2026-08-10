import { NextResponse } from 'next/server';

const MOCK_SESSIONS = [
  {
    sessionId: 'sess-today-1',
    customerName: 'Shivam Soni',
    customerEmail: 'shivam.soni@royalcyber.com',
    topic: 'Return request for Order #ORD-RC-715370',
    updatedAt: new Date().toISOString(),
    messageCount: 6,
  },
  {
    sessionId: 'sess-yesterday-1',
    customerName: 'Pooja Naik',
    customerEmail: 'pooja.n@royalcyber.com',
    topic: 'Order status query #ORD-RC-884210',
    updatedAt: new Date(Date.now() - 86400000).toISOString(),
    messageCount: 4,
  },
  {
    sessionId: 'sess-week-1',
    customerName: 'Pankaj Malviya',
    customerEmail: 'pankaj.malviya@royalcyber.com',
    topic: 'Inquiry about vacuum sealer accessories',
    updatedAt: new Date(Date.now() - 3 * 86400000).toISOString(),
    messageCount: 8,
  },
];

export async function GET() {
  return NextResponse.json({ sessions: MOCK_SESSIONS, total: MOCK_SESSIONS.length });
}
