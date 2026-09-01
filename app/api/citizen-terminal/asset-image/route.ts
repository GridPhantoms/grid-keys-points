import { NextRequest, NextResponse } from 'next/server';
import { CITIZEN_COLLECTIONS } from '@/lib/citizen-terminal';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const ALLOWED_IMAGE_HOSTS = new Set([
  'res.cloudinary.com',
  'nft-cdn.alchemy.com',
  'nft2-cdn.alchemy.com',
  'nft3-cdn.alchemy.com',
]);

async function fetchWithTimeout(url: string, timeoutMs = 8_000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { cache: 'no-store', signal: controller.signal, headers: { accept: 'application/json' } });
  } finally {
    clearTimeout(timer);
  }
}

export async function GET(request: NextRequest) {
  const collectionKey = request.nextUrl.searchParams.get('collection')?.trim() ?? '';
  const tokenId = request.nextUrl.searchParams.get('tokenId')?.trim() ?? '';
  const collection = CITIZEN_COLLECTIONS.find((item) => item.key === collectionKey);
  if (!collection || !/^\d{1,78}$/.test(tokenId)) return NextResponse.json({ error: 'Invalid Citizen asset.' }, { status: 400 });
  const apiKey = process.env.ALCHEMY_API_KEY?.trim();
  if (!apiKey) return NextResponse.json({ error: 'Asset image provider is not configured.' }, { status: 503 });

  try {
    const params = new URLSearchParams({ contractAddress: collection.contract, tokenId, refreshCache: 'false' });
    const response = await fetchWithTimeout(`https://eth-mainnet.g.alchemy.com/nft/v3/${apiKey}/getNFTMetadata?${params}`);
    if (!response.ok) throw new Error('Metadata unavailable');
    const metadata = await response.json() as {
      image?: { pngUrl?: string | null; cachedUrl?: string | null; thumbnailUrl?: string | null; originalUrl?: string | null };
    };
    const remote = metadata.image?.pngUrl ?? metadata.image?.cachedUrl ?? metadata.image?.thumbnailUrl;
    if (remote) {
      const parsed = new URL(remote);
      if (parsed.protocol !== 'https:' || !ALLOWED_IMAGE_HOSTS.has(parsed.hostname)) throw new Error('Unexpected image source');
      return NextResponse.redirect(parsed, 307);
    }
    const original = metadata.image?.originalUrl ?? '';
    const match = /^data:image\/(svg\+xml|png|jpeg|webp);base64,([A-Za-z0-9+/=]+)$/.exec(original);
    if (!match) throw new Error('Image unavailable');
    const bytes = Buffer.from(match[2], 'base64');
    if (bytes.length === 0 || bytes.length > 2_000_000) throw new Error('Unexpected image size');
    const contentType = match[1] === 'svg+xml' ? 'image/svg+xml; charset=utf-8' : `image/${match[1]}`;
    return new Response(bytes, {
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=86400, s-maxage=604800, stale-while-revalidate=2592000',
        'Content-Security-Policy': "default-src 'none'; img-src data: https:; style-src 'unsafe-inline'",
        'X-Content-Type-Options': 'nosniff',
      },
    });
  } catch {
    return NextResponse.json({ error: 'Citizen asset image unavailable.' }, { status: 404 });
  }
}
