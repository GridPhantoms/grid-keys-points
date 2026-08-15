import { NextResponse } from 'next/server';
import { getNftsForOwner } from '../_lib/alchemy-server';

const OWNER_PATTERN = /^0x[0-9a-fA-F]{40}$/;
const GENESIS_CONTRACT = '0xf26e168d053f6779f7172a1d0b0a6cd8d7446493';
const EXODUS_CONTRACT = '0xddf1d5f3a79ccba74e284fd5b9ee0faddb8993aa';
const CONTRACTS = [GENESIS_CONTRACT, EXODUS_CONTRACT] as const;

export const dynamic = 'force-dynamic';

function noStoreJson(body: unknown, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: { 'cache-control': 'no-store' },
  });
}

export async function GET(request: Request) {
  const owner = new URL(request.url).searchParams.get('owner')?.trim() ?? '';

  if (!OWNER_PATTERN.test(owner)) {
    return noStoreJson({ error: 'Enter a valid Ethereum wallet address.' }, 400);
  }

  try {
    const responses = await Promise.all(
      CONTRACTS.map(async (contractAddress) => {
        const ownedNfts = await getNftsForOwner(owner, contractAddress, 100);
        return ownedNfts.flatMap((nft) => {
          if (typeof nft.tokenId !== 'string' || nft.tokenId.length === 0) return [];
          return [{ tokenId: nft.tokenId, contract: { address: contractAddress } }];
        });
      }),
    );

    return noStoreJson({ ownedNfts: responses.flat() });
  } catch {
    console.error('Wallet Key lookup failed');
    return noStoreJson(
      { error: 'Unable to load wallet Keys right now. Please try again.' },
      502,
    );
  }
}
