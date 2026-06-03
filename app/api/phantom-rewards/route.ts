import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

const AIRDROP_FILES = [
  '2025-10Airdrop.csv',
  '2025-11Airdrop.csv',
  '2025-12Airdrop.csv',
  '2026-01Airdrop.csv',
  '2026-02Airdrop.csv',
  '2026-03Airdrop.csv',
  '2026-04Airdrop.csv',
  '2026-05Airdrop.csv',
];

function loadRewardsLookup(): Record<string, number> {
  const lookup: Record<string, number> = {};
  const airdropsDir = path.join(process.cwd(), 'public', 'airdrops');

  for (const file of AIRDROP_FILES) {
    const filePath = path.join(airdropsDir, file);
    if (!fs.existsSync(filePath)) continue;

    const text = fs.readFileSync(filePath, 'utf8');
    text.trim().split('\n').forEach((line) => {
      if (!line.trim()) return;
      const [walletRaw, amountRaw] = line.split(',');
      if (!walletRaw || !amountRaw) return;

      const wallet = walletRaw.trim().toLowerCase();
      const amount = Number.parseFloat(amountRaw.trim());
      if (!Number.isFinite(amount)) return;

      lookup[wallet] = (lookup[wallet] || 0) + amount;
    });
  }

  return lookup;
}

export async function GET(request: NextRequest) {
  const wallet = request.nextUrl.searchParams.get('wallet')?.toLowerCase();

  if (!wallet) {
    return NextResponse.json({ error: 'Wallet address required' }, { status: 400 });
  }

  const rewards = loadRewardsLookup()[wallet] || 0;

  return NextResponse.json({
    lifetimePhantomRewards: rewards,
    formatted: rewards.toLocaleString(),
  });
}
