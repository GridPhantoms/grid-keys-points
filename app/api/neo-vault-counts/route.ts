import { NextResponse } from 'next/server';
import { getNftsForOwner } from '../_lib/alchemy-server';

const NEO_VAULT_WALLET = '0x6a1bc919e847c12725904965e05971b818b47ad0';
const NEO_CONTRACTS = {
  s1: '0xb9951b43802dcf3ef5b14567cb17adf367ed1c0f',
  s2: '0x4481507cc228fa19d203bd42110d679571f7912e',
  items: '0xe7489ea1847395d7eead33e9c85fe327d513d249',
} as const;

type NeoCountName = keyof typeof NEO_CONTRACTS;

export const dynamic = 'force-dynamic';

function safeCount(value: number) {
  return Number.isFinite(value) && value >= 0 ? value : 0;
}

export async function GET() {
  try {
    const entries = await Promise.all(
      (Object.entries(NEO_CONTRACTS) as Array<[NeoCountName, string]>).map(
        async ([name, contractAddress]) => {
          const ownedNfts = await getNftsForOwner(NEO_VAULT_WALLET, contractAddress, 100);
          return [name, safeCount(ownedNfts.length)] as const;
        },
      ),
    );

    const counts = Object.fromEntries(entries) as Record<NeoCountName, number>;
    return NextResponse.json(
      {
        ...counts,
        source: 'alchemy_nft_owner_lookup',
        readAt: new Date().toISOString(),
      },
      { headers: { 'cache-control': 'no-store' } },
    );
  } catch {
    console.error('Neo Tokyo vault holdings lookup failed');
    return NextResponse.json(
      { error: 'Unable to load vault holdings right now.' },
      { status: 502, headers: { 'cache-control': 'no-store' } },
    );
  }
}
