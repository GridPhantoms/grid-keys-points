import { NextResponse } from 'next/server';

const EXODUS_CONTRACT = '0xddf1d5f3a79ccba74e284fd5b9ee0faddb8993aa';
const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';

export const dynamic = 'force-dynamic';

async function alchemyRpc(apiKey: string, method: string, params: unknown[]) {
  const response = await fetch(`https://eth-mainnet.g.alchemy.com/v2/${apiKey}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      method,
      params,
    }),
    cache: 'no-store',
  });

  const data = await response.json();

  if (!response.ok || data.error) {
    throw new Error(data.error?.message || `Alchemy request failed with HTTP ${response.status}`);
  }

  return data.result;
}

export async function GET() {
  const apiKey = process.env.ALCHEMY_API_KEY || process.env.NEXT_PUBLIC_ALCHEMY_API_KEY;

  if (!apiKey) {
    return NextResponse.json(
      { error: 'Alchemy API key missing' },
      { status: 500, headers: { 'cache-control': 'no-store' } },
    );
  }

  try {
    const minted = new Set<string>();
    let pageKey: string | undefined;

    do {
      const request: Record<string, unknown> = {
        fromBlock: '0x0',
        toBlock: 'latest',
        fromAddress: ZERO_ADDRESS,
        contractAddresses: [EXODUS_CONTRACT],
        category: ['erc721'],
        withMetadata: false,
        excludeZeroValue: false,
        maxCount: '0x3e8',
      };

      if (pageKey) request.pageKey = pageKey;

      const result = await alchemyRpc(apiKey, 'alchemy_getAssetTransfers', [request]);

      for (const transfer of result.transfers || []) {
        const contract = (transfer.rawContract?.address || '').toLowerCase();
        const from = (transfer.from || '').toLowerCase();
        const to = (transfer.to || '').toLowerCase();
        const tokenId = transfer.erc721TokenId || transfer.tokenId || transfer.rawContract?.tokenId;

        if (contract !== EXODUS_CONTRACT || from !== ZERO_ADDRESS || !to || to === ZERO_ADDRESS || !tokenId) {
          continue;
        }

        minted.add(`${transfer.hash || ''}:${tokenId}:${to}`);
      }

      pageKey = result.pageKey;
    } while (pageKey);

    return NextResponse.json(
      {
        minted: minted.size,
        source: 'alchemy_getAssetTransfers_zero_address_mints',
        updatedAt: new Date().toISOString(),
      },
      { headers: { 'cache-control': 'no-store' } },
    );
  } catch (error) {
    console.error('Failed to fetch Exodus minted count:', error);

    return NextResponse.json(
      { error: 'Failed to fetch Exodus minted count' },
      { status: 502, headers: { 'cache-control': 'no-store' } },
    );
  }
}
