import { NextRequest, NextResponse } from 'next/server';
import { CITIZEN_CONTRACTS } from '@/lib/citizen-terminal';
import { getOnchainMetadataImage } from '@/app/api/_lib/ethereum-nft-metadata';
import { mapWithConcurrency, readResponseBuffer } from '@/app/api/_lib/bounded-response';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const ALLOWED_LAYER_ORIGIN = 'https://neotokyo.mypinata.cloud';
const FALLBACK_LAYER_ORIGIN = 'https://gateway.pinata.cloud';
const LAYER_FETCH_ATTEMPTS = 3;
const LAYER_FETCH_CONCURRENCY = 4;
const MAX_LAYER_BYTES = 2_000_000;

async function fetchWithTimeout(url: string, init: RequestInit = {}, timeoutMs = 8_000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { cache: 'no-store', ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

async function fetchCitizenLayer(layerUrl: string) {
  const parsed = new URL(layerUrl);
  const ipfsPath = parsed.pathname.slice('/ipfs/'.length);
  const candidates = [layerUrl, `${FALLBACK_LAYER_ORIGIN}/ipfs/${ipfsPath}`];
  for (let attempt = 0; attempt < LAYER_FETCH_ATTEMPTS; attempt += 1) {
    try {
      const response = await fetchWithTimeout(candidates[attempt % candidates.length], { headers: { accept: 'image/png,image/*' } }, 12_000);
      if (!response.ok) continue;
      const contentType = response.headers.get('content-type')?.split(';', 1)[0] ?? 'image/png';
      if (!contentType.startsWith('image/')) continue;
      const bytes = await readResponseBuffer(response, MAX_LAYER_BYTES);
      return `data:${contentType};base64,${bytes.toString('base64')}`;
    } catch {
      // Try the alternate allowlisted IPFS gateway.
    }
  }
  throw new Error('Image layer unavailable');
}

export async function GET(request: NextRequest) {
  const season = request.nextUrl.searchParams.get('season') ?? 's2';
  const tokenId = request.nextUrl.searchParams.get('tokenId')?.trim() ?? '';
  if (season !== 's1' && season !== 's2') return NextResponse.json({ error: 'Invalid Citizen season.' }, { status: 400 });
  if (!/^\d{1,8}$/.test(tokenId)) return NextResponse.json({ error: 'Invalid Citizen number.' }, { status: 400 });

  const apiKey = process.env.ALCHEMY_API_KEY;
  if (!apiKey) return NextResponse.json({ error: 'Citizen image provider is not configured.' }, { status: 503 });

  try {
    const retry = request.nextUrl.searchParams.has('retry');
    const params = new URLSearchParams({
      contractAddress: CITIZEN_CONTRACTS[season],
      tokenId,
      refreshCache: retry ? 'true' : 'false',
    });
    const metadataResponse = await fetchWithTimeout(`https://eth-mainnet.g.alchemy.com/nft/v3/${apiKey}/getNFTMetadata?${params}`, {
      headers: { accept: 'application/json' },
    });
    const metadata = metadataResponse.ok
      ? await metadataResponse.json() as { image?: { originalUrl?: string; pngUrl?: string; cachedUrl?: string } }
      : {};

    let original = metadata.image?.originalUrl ?? '';
    if (!original.startsWith('data:image/svg+xml;base64,')) {
      original = await getOnchainMetadataImage(CITIZEN_CONTRACTS[season], tokenId).catch(() => null) ?? original;
    }
    if (!original.startsWith('data:image/svg+xml;base64,')) {
      const fallback = metadata.image?.pngUrl ?? metadata.image?.cachedUrl;
      if (fallback) return NextResponse.redirect(fallback, 307);
      throw new Error('Composed image unavailable');
    }

    const svg = Buffer.from(original.slice('data:image/svg+xml;base64,'.length), 'base64').toString('utf8');
    const layerUrls = Array.from(svg.matchAll(/href="(https:[^"]+)"/g), (match) => match[1]);
    if (layerUrls.length === 0 || layerUrls.length > 24) throw new Error('Unexpected image layer count');
    for (const layerUrl of layerUrls) {
      const parsed = new URL(layerUrl);
      if (parsed.origin !== ALLOWED_LAYER_ORIGIN || !parsed.pathname.startsWith('/ipfs/')) throw new Error('Unexpected image layer source');
    }

    const embeddedLayers = await mapWithConcurrency(layerUrls, LAYER_FETCH_CONCURRENCY, fetchCitizenLayer);

    let selfContainedSvg = svg;
    layerUrls.forEach((layerUrl, index) => {
      selfContainedSvg = selfContainedSvg.replaceAll(layerUrl, embeddedLayers[index]);
    });

    return new Response(selfContainedSvg, {
      headers: {
        'Content-Type': 'image/svg+xml; charset=utf-8',
        'Cache-Control': 'public, max-age=86400, s-maxage=604800, stale-while-revalidate=2592000',
        'Content-Security-Policy': "default-src 'none'; img-src data:; style-src 'unsafe-inline'; sandbox",
        'Cross-Origin-Resource-Policy': 'same-origin',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  } catch {
    return NextResponse.json({ error: 'Citizen image unavailable.' }, { status: 502 });
  }
}
