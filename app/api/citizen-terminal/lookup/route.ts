import { NextRequest, NextResponse } from 'next/server';
import { Contract, FetchRequest, JsonRpcProvider } from 'ethers';
import { CITIZEN_CONTRACTS, type CitizenSeason } from '@/lib/citizen-terminal';
import { ethereumRpcUrl } from '@/lib/bytes-api.mjs';
import { ETHEREUM_CHAIN_ID } from '@/lib/bytes-contracts';
import { fetchOpenSeaEstimatedRank } from '@/lib/opensea-rarity';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Attribute = { trait_type?: string; value?: string | number };

type ComponentRecord = Record<string, unknown> & {
  tokenId?: string;
  rarityMonRank?: number;
  rarityMonScore?: number;
  componentScore?: number;
  tokenMetadata?: { name?: string; image?: string; animation_url?: string; attributes?: Attribute[] };
};

const NT_ORIGIN = 'https://neotokyo.codes';
const NT_CSRF_URL = `${NT_ORIGIN}/api/auth/get-csrf-token`;
const RPC_ROUTES = {
  citizen: 'getCitizen',
  identity: 'getIdentity',
  vault: 'getVault',
  item: 'getItemCache',
  land: 'getLand',
} as const;
const S2_COMPONENT_ABI = [
  'function getIdentityIdOfTokenId(uint256 citizenId) view returns (uint256)',
  'function getItemCacheIdOfTokenId(uint256 citizenId) view returns (uint256)',
  'function getLandDeedIdOfTokenId(uint256 citizenId) view returns (uint256)',
] as const;

function splitSetCookies(value: string) {
  return value.split(/,(?=\s*[^;,=]+=[^;,]+)/g).map((cookie) => cookie.trim());
}

async function neoTokyoHeaders() {
  const response = await fetch(NT_CSRF_URL, {
    headers: { accept: 'application/json', 'user-agent': 'GridPhantomsCitizenTerminal/1.0' },
    cache: 'no-store',
  });
  if (response.status !== 400 && !response.ok) throw new Error(`Neo Tokyo session failed (${response.status})`);

  const getSetCookie = (response.headers as Headers & { getSetCookie?: () => string[] }).getSetCookie;
  const setCookies = getSetCookie ? getSetCookie.call(response.headers) : splitSetCookies(response.headers.get('set-cookie') ?? '');
  const cookies = setCookies
    .map((cookie) => cookie.split(';', 1)[0])
    .filter((cookie) => cookie && cookie.slice(cookie.indexOf('=') + 1).length > 0);
  const csrf = cookies.find((cookie) => cookie.includes('_sAntiCsrfToken='))?.split('=', 2)[1];
  const publicToken = cookies.find((cookie) => cookie.includes('_sPublicDataToken='))?.split('=', 2)[1];
  if (!csrf || !publicToken) throw new Error('Neo Tokyo anonymous session unavailable');

  return {
    'content-type': 'application/json',
    accept: 'application/json',
    origin: NT_ORIGIN,
    referer: `${NT_ORIGIN}/assembler`,
    'user-agent': 'GridPhantomsCitizenTerminal/1.0',
    'anti-csrf': csrf,
    'public-data-token': publicToken,
    cookie: cookies.join('; '),
  };
}

async function ntRpc<T>(route: string, params: Record<string, string>, headers: Record<string, string>) {
  const response = await fetch(`${NT_ORIGIN}/api/rpc/${route}`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ params }),
    cache: 'no-store',
  });
  const payload = await response.json().catch(() => null) as { result?: T; error?: { message?: string } } | null;
  if (!response.ok || !payload?.result) throw new Error(payload?.error?.message ?? `Neo Tokyo lookup failed (${response.status})`);
  return payload.result;
}

async function alchemyMetadata(season: CitizenSeason, tokenId: string) {
  const apiKey = process.env.ALCHEMY_API_KEY;
  if (!apiKey) throw new Error('Citizen metadata provider is not configured');
  const params = new URLSearchParams({
    contractAddress: CITIZEN_CONTRACTS[season],
    tokenId,
    refreshCache: 'false',
  });
  const response = await fetch(`https://eth-mainnet.g.alchemy.com/nft/v3/${apiKey}/getNFTMetadata?${params}`, {
    next: { revalidate: 300 },
  });
  if (!response.ok) throw new Error(`Citizen metadata failed (${response.status})`);
  return response.json() as Promise<{
    name?: string;
    image?: { pngUrl?: string; cachedUrl?: string; thumbnailUrl?: string; originalUrl?: string };
    raw?: { metadata?: { attributes?: Attribute[] } };
  }>;
}

function traits(attributes: Attribute[] | undefined) {
  return (attributes ?? [])
    .filter((attribute) => attribute.trait_type && attribute.value !== undefined)
    .map((attribute) => ({ label: String(attribute.trait_type), value: String(attribute.value) }));
}

function component(label: string, value: ComponentRecord | null | undefined) {
  if (!value) return null;
  return {
    label,
    tokenId: value.tokenId ?? null,
    name: value.tokenMetadata?.name ?? `${label} #${value.tokenId ?? '—'}`,
    rank: value.rarityMonRank ?? null,
    rarityScore: value.rarityMonScore ?? null,
    componentScore: value.componentScore ?? null,
    imageUrl: value.tokenMetadata?.image ?? null,
    traits: traits(value.tokenMetadata?.attributes),
  };
}

async function lookupS1(tokenId: string) {
  const [headers, metadata] = await Promise.all([neoTokyoHeaders(), alchemyMetadata('s1', tokenId)]);
  const citizen = await ntRpc<ComponentRecord & {
    identityId?: string;
    vaultId?: string;
    itemCacheId?: string;
    landId?: string;
    rarityMonRank?: number;
    rarityMonScore?: number;
    rewardRate?: number;
  }>(RPC_ROUTES.citizen, { tokenId }, headers);

  const [identity, vault, item, land] = await Promise.all([
    citizen.identityId ? ntRpc<ComponentRecord>(RPC_ROUTES.identity, { tokenId: citizen.identityId }, headers) : null,
    citizen.vaultId ? ntRpc<ComponentRecord>(RPC_ROUTES.vault, { tokenId: citizen.vaultId }, headers) : null,
    citizen.itemCacheId ? ntRpc<ComponentRecord>(RPC_ROUTES.item, { tokenId: citizen.itemCacheId }, headers) : null,
    citizen.landId ? ntRpc<ComponentRecord>(RPC_ROUTES.land, { tokenId: citizen.landId }, headers) : null,
  ]);

  const citizenTraits = traits(metadata.raw?.metadata?.attributes);
  const creditYield = identity && typeof identity.creditYield === 'string' ? identity.creditYield : 'Low';
  const creditMultiplier = vault && typeof vault.creditMultiplier === 'string' ? vault.creditMultiplier : 'None';
  return {
    season: 's1' as const,
    tokenId,
    name: metadata.name ?? `Citizen #${tokenId}`,
    imageUrl: `/api/citizen-terminal/image?season=s1&tokenId=${encodeURIComponent(tokenId)}`,
    rank: citizen.rarityMonRank ?? null,
    rarityScore: citizen.rarityMonScore ?? null,
    elite: Number(citizen.rarityMonRank) > 0 && Number(citizen.rarityMonRank) <= 500,
    rewardRate: citizen.rewardRate ?? null,
    traits: citizenTraits,
    components: [component('Identity', identity), component('Vault Card', vault), component('Item Cache', item), component('Land Deed', land)].filter(Boolean),
    calculatorPreset: { creditYield, creditMultiplier },
    sources: ['NeoTokyo.codes Citizen data', 'Alchemy NFT metadata'],
  };
}

async function lookupS2(tokenId: string) {
  const url = ethereumRpcUrl(process.env);
  if (!url) throw new Error('Ethereum data provider is not configured');
  const request = new FetchRequest(url);
  request.timeout = 10_000;
  const provider = new JsonRpcProvider(request);
  const citizen = new Contract(CITIZEN_CONTRACTS.s2, S2_COMPONENT_ABI, provider);
  const [metadata, network, identityId, itemCacheId, landDeedId, openSeaRank] = await Promise.all([
    alchemyMetadata('s2', tokenId),
    provider.getNetwork(),
    citizen.getIdentityIdOfTokenId(tokenId) as Promise<bigint>,
    citizen.getItemCacheIdOfTokenId(tokenId) as Promise<bigint>,
    citizen.getLandDeedIdOfTokenId(tokenId) as Promise<bigint>,
    fetchOpenSeaEstimatedRank(CITIZEN_CONTRACTS.s2, tokenId),
  ]);
  if (network.chainId !== BigInt(ETHEREUM_CHAIN_ID)) throw new Error('Ethereum source verification failed');
  const allTraits = traits(metadata.raw?.metadata?.attributes);
  if (!metadata.name || allTraits.length === 0) throw new Error(`Outer Citizen #${tokenId} was not found`);
  const byLabels = (labels: string[]) => allTraits.filter((trait) => labels.includes(trait.label));
  return {
    season: 's2' as const,
    tokenId,
    name: metadata.name,
    imageUrl: `/api/citizen-terminal/image?season=s2&tokenId=${encodeURIComponent(tokenId)}`,
    rank: null,
    rarityScore: null,
    estimatedRank: openSeaRank.rank,
    estimatedRankStatus: openSeaRank.status,
    estimatedRankSource: openSeaRank.source,
    estimatedRankAsOf: openSeaRank.asOf,
    estimatedRankUrl: openSeaRank.sourceUrl,
    elite: false,
    rewardRate: null,
    traits: allTraits,
    components: [
      { label: 'Outer Identity', tokenId: identityId.toString(), name: `Outer Identity #${identityId}`, rank: null, rarityScore: null, componentScore: null, imageUrl: null, traits: byLabels(['Class', 'Race', 'Gender', 'Ability', 'Eyes', 'Strength', 'Intelligence', 'Attractiveness', 'Tech Skill', 'Cool', 'Allocation', 'Expression', 'Hair', 'Nose']) },
      { label: 'Outer Item Cache', tokenId: itemCacheId.toString(), name: `Outer Item Cache #${itemCacheId}`, rank: null, rarityScore: null, componentScore: null, imageUrl: null, traits: byLabels(['Weapon', 'Vehicle', 'Apparel', 'Helm']) },
      { label: 'Outer Land Deed', tokenId: landDeedId.toString(), name: `Outer Land Deed #${landDeedId}`, rank: null, rarityScore: null, componentScore: null, imageUrl: null, traits: byLabels(['Location']) },
    ],
    calculatorPreset: {},
    notices: [
      'S2 component token numbers are read from the Citizen contract.',
      openSeaRank.status === 'available'
        ? 'The displayed S2 rank is an OpenSea marketplace estimate. Neo Tokyo currently has not issued a canonical official S2 rarity rank.'
        : 'OpenSea did not provide an estimated rank at lookup time. Neo Tokyo currently has not issued a canonical official S2 rarity rank.',
    ],
    sources: ['S2 Outer Citizen contract', 'Alchemy NFT metadata', 'OpenSea OpenRarity'],
  };
}

export async function GET(request: NextRequest) {
  const season = request.nextUrl.searchParams.get('season');
  const tokenId = request.nextUrl.searchParams.get('tokenId')?.trim() ?? '';
  if ((season !== 's1' && season !== 's2') || !/^\d{1,8}$/.test(tokenId)) {
    return NextResponse.json({ error: 'Choose S1 or S2 and enter a valid Citizen number.' }, { status: 400 });
  }

  try {
    const result = season === 's1' ? await lookupS1(tokenId) : await lookupS2(tokenId);
    return NextResponse.json(result, { headers: { 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=900' } });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Citizen lookup failed';
    return NextResponse.json({ error: message }, { status: message.includes('not found') ? 404 : 502 });
  }
}
