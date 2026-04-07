import { NextRequest, NextResponse } from 'next/server';

// Wallet address → Lifetime Phantom Rewards in $BYTES
// Add new entries or update amounts after each monthly airdrop
const REWARDS_LOOKUP: Record<string, number> = {
  "0x0b5bfb355f553a267460bb4cb1c768a8d4940687": 8507,   // Your wallet (example - update with real total)
  // Add more wallets here as needed, e.g.:
  // "0xanotherwallet...": 1245,
};

export async function GET(request: NextRequest) {
  const wallet = request.nextUrl.searchParams.get('wallet')?.toLowerCase();

  if (!wallet) {
    return NextResponse.json({ error: 'Wallet address required' }, { status: 400 });
  }

  const rewards = REWARDS_LOOKUP[wallet] || 0;

  return NextResponse.json({ 
    lifetimePhantomRewards: rewards,
    formatted: rewards.toLocaleString()
  });
}