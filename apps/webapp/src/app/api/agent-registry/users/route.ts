import { NextResponse } from 'next/server';

const AGENTS = [
  { id: 'usr-1', name: 'Shivam Soni', email: 'shivam.soni@royalcyber.com', role: 'Support Admin' },
  { id: 'usr-2', name: 'Pooja Naik', email: 'pooja.n@royalcyber.com', role: 'Support Agent' },
  { id: 'usr-3', name: 'Pankaj Malviya', email: 'pankaj.malviya@royalcyber.com', role: 'Support Agent' },
  { id: 'usr-4', name: 'Sarah Agent', email: 'sarah.agent@csa.local', role: 'Lead Agent' },
];

export async function GET() {
  return NextResponse.json({ users: AGENTS, total: AGENTS.length });
}
