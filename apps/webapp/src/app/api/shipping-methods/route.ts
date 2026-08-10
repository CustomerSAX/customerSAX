import { NextResponse } from 'next/server';

export async function GET() {
  const methods = [
    { id: 'express', name: 'Express Courier ($15.00)' },
    { id: 'standard', name: 'Standard Delivery ($5.00)' },
    { id: 'overnight', name: 'Overnight Air ($25.00)' },
  ];
  return NextResponse.json(methods, { headers: { 'Cache-Control': 'no-store' } });
}
