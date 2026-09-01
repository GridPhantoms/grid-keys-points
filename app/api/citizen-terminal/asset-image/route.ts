import { NextRequest, NextResponse } from 'next/server';
import { CITIZEN_COLLECTIONS } from '@/lib/citizen-terminal';
import { getOnchainMetadataImage } from '@/app/api/_lib/ethereum-nft-metadata';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const ALLOWED_IMAGE_HOSTS = new Set([
  'res.cloudinary.com',
  'nft-cdn.alchemy.com',
  'nft2-cdn.alchemy.com',
  'nft3-cdn.alchemy.com',
]);

async function fetchWithTimeout(url: string, accept: string, timeoutMs = 8_000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { cache: 'no-store', signal: controller.signal, headers: { accept } });
  } finally {
    clearTimeout(timer);
  }
}

const imageHeaders = (contentType: string) => ({
  'Content-Type': contentType,
  'Cache-Control': 'public, max-age=86400, s-maxage=604800, stale-while-revalidate=2592000',
  'Content-Security-Policy': "default-src 'none'; img-src data: https:; style-src 'unsafe-inline'",
  'X-Content-Type-Options': 'nosniff',
});

function embeddedImage(original: string) {
  const match = /^data:image\/(svg\+xml|png|jpeg|webp);base64,([A-Za-z0-9+/=]+)$/.exec(original);
  if (!match) return null;
  const bytes = Buffer.from(match[2], 'base64');
  if (bytes.length === 0 || bytes.length > 2_000_000) return null;
  const contentType = match[1] === 'svg+xml' ? 'image/svg+xml; charset=utf-8' : `image/${match[1]}`;
  return new Response(bytes, { headers: imageHeaders(contentType) });
}

async function fetchImageCandidate(remote: string) {
  const parsed = new URL(remote);
  if (parsed.protocol !== 'https:' || !ALLOWED_IMAGE_HOSTS.has(parsed.hostname)) return null;
  const response = await fetchWithTimeout(parsed.toString(), 'image/avif,image/webp,image/svg+xml,image/*,*/*;q=0.8');
  if (!response.ok) return null;
  const contentType = response.headers.get('content-type')?.split(';')[0]?.trim().toLowerCase() ?? '';
  if (!contentType.startsWith('image/')) return null;
  const bytes = Buffer.from(await response.arrayBuffer());
  if (bytes.length === 0 || bytes.length > 12_000_000) return null;
  return new Response(bytes, { headers: imageHeaders(contentType) });
}

export async function GET(request: NextRequest) {
  const collectionKey = request.nextUrl.searchParams.get('collection')?.trim() ?? '';
  const tokenId = request.nextUrl.searchParams.get('tokenId')?.trim() ?? '';
  const collection = CITIZEN_COLLECTIONS.find((item) => item.key === collectionKey);
  if (!collection || !/^\d{1,78}$/.test(tokenId)) return NextResponse.json({ error: 'Invalid Citizen asset.' }, { status: 400 });
  const retry = request.nextUrl.searchParams.has('retry');
  const isComponent = !collectionKey.endsWith('-citizens');
  const apiKey = process.env.ALCHEMY_API_KEY?.trim();
  if (!apiKey) return NextResponse.json({ error: 'Asset image provider is not configured.' }, { status: 503 });

  try {
    const params = new URLSearchParams({ contractAddress: collection.contract, tokenId, refreshCache: retry ? 'true' : 'false' });
    const response = await fetchWithTimeout(`https://eth-mainnet.g.alchemy.com/nft/v3/${apiKey}/getNFTMetadata?${params}`, 'application/json');
    const metadata = response.ok
      ? await response.json() as { image?: { pngUrl?: string | null; cachedUrl?: string | null; thumbnailUrl?: string | null; originalUrl?: string | null } }
      : {};
    let original = metadata.image?.originalUrl ?? '';
    const onchain = (!original || isComponent)
      ? await getOnchainMetadataImage(collection.contract, tokenId).catch(() => null) ?? ''
      : '';
    if (!original) original = onchain;
    if (isComponent) {
      const inline = embeddedImage(onchain || original);
      if (inline) return inline;
    }
    const candidates = [metadata.image?.pngUrl, metadata.image?.cachedUrl, metadata.image?.thumbnailUrl]
      .filter((value): value is string => Boolean(value));
    for (const candidate of candidates) {
      const fetched = await fetchImageCandidate(candidate).catch(() => null);
      if (fetched) return fetched;
    }
    const inline = embeddedImage(original);
    if (inline) return inline;
    throw new Error('Image unavailable');
  } catch {
    return NextResponse.json({ error: 'Citizen asset image unavailable.' }, { status: 404 });
  }
}
