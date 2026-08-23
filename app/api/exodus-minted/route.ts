import { NextResponse } from 'next/server';
import { alchemyRpc } from '../_lib/alchemy-server';

const EXODUS_CONTRACT = '0xddf1d5f3a79ccba74e284fd5b9ee0faddb8993aa';
const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';
const MAX_PAGES = 20;

type AssetTransfer = {
  rawContract?: { address?: string; tokenId?: string };
  from?: string;
  to?: string;
  erc721TokenId?: string;
  tokenId?: string;
  hash?: string;
};

type AssetTransfersResult = {
  transfers?: AssetTransfer[];
  pageKey?: string;
};

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const minted = new Set<string>();
    let pageKey: string | undefined;
    let pageCount = 0;

    do {
      pageCount += 1;
      if (pageCount > MAX_PAGES) throw new Error('Page limit exceeded');

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

      const result = await alchemyRpc<AssetTransfersResult>(
        'alchemy_getAssetTransfers',
        [request],
      );

      for (const transfer of Array.isArray(result.transfers) ? result.transfers : []) {
        const contract = (transfer.rawContract?.address || '').toLowerCase();
        const from = (transfer.from || '').toLowerCase();
        const to = (transfer.to || '').toLowerCase();
        const tokenId = transfer.erc721TokenId || transfer.tokenId || transfer.rawContract?.tokenId;

        if (contract !== EXODUS_CONTRACT || from !== ZERO_ADDRESS || !to || to === ZERO_ADDRESS || !tokenId) {
          continue;
        }

        minted.add(`${transfer.hash || ''}:${tokenId}:${to}`);
      }

      pageKey = typeof result.pageKey === 'string' ? result.pageKey : undefined;
    } while (pageKey);

    return NextResponse.json(
      {
        minted: minted.size,
        source: 'alchemy_getAssetTransfers_zero_address_mints',
        readAt: new Date().toISOString(),
      },
      { headers: { 'cache-control': 'no-store' } },
    );
  } catch {
    console.error('Exodus minted count lookup failed');
    return NextResponse.json(
      { error: 'Unable to load Exodus minted count right now.' },
      { status: 502, headers: { 'cache-control': 'no-store' } },
    );
  }
}
