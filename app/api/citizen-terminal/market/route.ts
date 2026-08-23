import { Contract, JsonRpcProvider } from 'ethers';
import { unstable_cache } from 'next/cache';
import { NextResponse } from 'next/server';
import { CITIZEN_COLLECTIONS } from '@/lib/citizen-terminal';
import { calculateCitizenSupply, calculateComponentSupply, NEO_TOKYO_SUPPLY_CONFIG } from '@/lib/citizen-valuation';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const OPEN_SEA_UA = 'Mozilla/5.0 (compatible; GridPhantomsCitizenTerminal/1.0)';
const OPEN_SEA_ITEMS_HASH = '33a4c321d0c7bc7775c92efcf80e2ae3738322e8427401448eaecd4d09b90454';
const ERC721_SUPPLY_ABI = ['function totalSupply() view returns (uint256)', 'function balanceOf(address) view returns (uint256)'];
const LISTINGS_REVALIDATE_SECONDS = 300;
const OFFERS_REVALIDATE_SECONDS = 900;
const RANKINGS_REVALIDATE_SECONDS = 3_600;
const SUPPLY_REVALIDATE_SECONDS = 3_600;
const MARKET_CACHE_CONTROL = 'public, s-maxage=300, stale-while-revalidate=900';

function splitSetCookies(value: string) {
  return value.split(/,(?=\s*[^;,=]+=[^;,]+)/g).map((cookie) => cookie.trim());
}

async function ntHeaders() {
  const response = await fetch('https://neotokyo.codes/api/auth/get-csrf-token', {
    headers: { accept: 'application/json', 'user-agent': 'GridPhantomsCitizenTerminal/1.0' },
    cache: 'no-store', signal: AbortSignal.timeout(8_000),
  });
  const getSetCookie = (response.headers as Headers & { getSetCookie?: () => string[] }).getSetCookie;
  const setCookies = getSetCookie ? getSetCookie.call(response.headers) : splitSetCookies(response.headers.get('set-cookie') ?? '');
  const cookies = setCookies.map((cookie) => cookie.split(';', 1)[0]).filter((cookie) => cookie && cookie.slice(cookie.indexOf('=') + 1).length > 0);
  const csrf = cookies.find((cookie) => cookie.includes('_sAntiCsrfToken='))?.split('=', 2)[1];
  const publicToken = cookies.find((cookie) => cookie.includes('_sPublicDataToken='))?.split('=', 2)[1];
  if (!csrf || !publicToken) throw new Error('Neo Tokyo rank session unavailable');
  return {
    'content-type': 'application/json', accept: 'application/json', origin: 'https://neotokyo.codes',
    referer: 'https://neotokyo.codes/assembler', 'user-agent': 'GridPhantomsCitizenTerminal/1.0',
    'anti-csrf': csrf, 'public-data-token': publicToken, cookie: cookies.join('; '),
  };
}

async function s1Rankings() {
  const headers = await ntHeaders();
  const response = await fetch('https://neotokyo.codes/api/rpc/getRankings', {
    method: 'POST', headers, body: JSON.stringify({ params: {} }), cache: 'no-store', signal: AbortSignal.timeout(10_000),
  });
  const payload = await response.json() as { result?: { rankings?: Array<{ tokenId: string; rarityMonRank: number; rarityMonScore: number }> } };
  if (!response.ok || !payload.result?.rankings) throw new Error('Neo Tokyo rankings unavailable');
  return payload.result.rankings;
}

async function openSeaListings(collectionSlug: string, limit: number) {
  const variables = { address: '0x0000000000000000000000000000000000000000', collectionSlug, limit, sort: { by: 'PRICE', direction: 'ASC' } };
  const extensions = { persistedQuery: { sha256Hash: OPEN_SEA_ITEMS_HASH, version: 1 } };
  const params = new URLSearchParams({ app_id: 'os2-web', operationName: 'CollectionItemsListQuery', variables: JSON.stringify(variables), extensions: JSON.stringify(extensions) });
  const response = await fetch(`https://gql.opensea.io/graphql?${params}`, {
    headers: { accept: 'application/json', 'user-agent': OPEN_SEA_UA, referer: `https://opensea.io/collection/${collectionSlug}`, origin: 'https://opensea.io' },
    cache: 'no-store', signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) throw new Error(`OpenSea listing feed unavailable (${response.status})`);
  const payload = await response.json() as {
    data?: { collectionItems?: { items?: Array<{
      tokenId?: string; name?: string; imageUrl?: string;
      bestListing?: { pricePerItem?: { usd?: number; token?: { unit?: number; symbol?: string } }; marketplace?: { identifier?: string } } | null;
      attributes?: Array<{ traitType?: string; value?: string }>;
    }> } };
  };
  return payload.data?.collectionItems?.items ?? [];
}

type OfferAggregate = {
  offer_price?: { usd_price?: string; token_unit?: number; symbol?: string; chain?: string };
  total_offers?: number;
  bidders?: Array<{ quantity?: number | string }>;
};

async function openSeaTopCollectionOffer(collectionSlug: string) {
  const apiKey = process.env.OPENSEA_API_KEY;
  if (!apiKey) return null;
  const response = await fetch(`https://api.opensea.io/api/v2/collections/${encodeURIComponent(collectionSlug)}/offer_aggregates`, {
    headers: { accept: 'application/json', 'x-api-key': apiKey, 'user-agent': OPEN_SEA_UA },
    cache: 'no-store', signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) throw new Error(`OpenSea offer feed unavailable (${response.status})`);
  const payload = await response.json() as { offer_aggregates?: OfferAggregate[] };
  const valid = (payload.offer_aggregates ?? []).filter((row) => {
    const price = row.offer_price;
    return price?.chain === 'ethereum' && ['WETH', 'ETH'].includes(price.symbol ?? '')
      && typeof price.token_unit === 'number' && Number.isFinite(price.token_unit) && price.token_unit > 0;
  });
  const top = valid.sort((a, b) => Number(b.offer_price?.token_unit) - Number(a.offer_price?.token_unit))[0];
  if (!top) return null;
  const bidderQuantity = (top.bidders ?? []).reduce((sum, bidder) => sum + Math.max(0, Number(bidder.quantity) || 0), 0);
  return {
    priceEth: top.offer_price!.token_unit!,
    priceUsd: Number.isFinite(Number(top.offer_price?.usd_price)) ? Number(top.offer_price?.usd_price) : null,
    quantity: bidderQuantity || Math.max(0, Number(top.total_offers) || 0) || null,
    offerCount: Math.max(0, Number(top.total_offers) || 0) || null,
    symbol: top.offer_price?.symbol ?? 'WETH',
  };
}

function ethereumProvider() {
  const rpcUrl = process.env.ETHEREUM_RPC_URL ?? (process.env.ALCHEMY_API_KEY ? `https://eth-mainnet.g.alchemy.com/v2/${process.env.ALCHEMY_API_KEY}` : null);
  if (!rpcUrl) throw new Error('Ethereum data source unavailable');
  return new JsonRpcProvider(rpcUrl, undefined, { batchMaxCount: 50, batchStallTime: 10 });
}

function safeNumber(value: bigint, label: string) {
  const number = Number(value);
  if (!Number.isSafeInteger(number) || number < 0) throw new Error(`${label} is outside the supported range`);
  return number;
}

async function supplySnapshot() {
  const provider = ethereumProvider();
  if (await provider.send('eth_chainId', []) !== '0x1') throw new Error('Ethereum source chain mismatch');
  const latest = await provider.getBlockNumber();
  const sourceBlock = Math.max(0, latest - 3);
  const block = await provider.getBlock(sourceBlock);
  if (!block?.hash) throw new Error('Ethereum source block unavailable');
  const call = (address: string) => new Contract(address.toLowerCase(), ERC721_SUPPLY_ABI, provider);

  const citizenRows = await Promise.all(NEO_TOKYO_SUPPLY_CONFIG.citizens.map(async (row) => {
    const legacy = call(row.legacy); const v2 = call(row.v2);
    const [legacyTotalRaw, legacyHeldRaw, v2TotalRaw] = await Promise.all([
      legacy.totalSupply({ blockTag: sourceBlock }), legacy.balanceOf(row.v2.toLowerCase(), { blockTag: sourceBlock }), v2.totalSupply({ blockTag: sourceBlock }),
    ]);
    const supply = calculateCitizenSupply({
      legacyTotal: safeNumber(legacyTotalRaw, `${row.key} legacy supply`),
      legacyHeldByV2: safeNumber(legacyHeldRaw, `${row.key} migration custody`),
      v2Total: safeNumber(v2TotalRaw, `${row.key} V2 supply`),
    });
    return { key: row.key, supply: supply.economicallyDistinct, breakdown: supply };
  }));

  const componentRows = await Promise.all(NEO_TOKYO_SUPPLY_CONFIG.components.map(async (row) => {
    const legacyReads = await Promise.all(row.legacy.map(async (address) => {
      const contract = call(address);
      const [total, citizenHeld, wrapperHeld] = await Promise.all([
        contract.totalSupply({ blockTag: sourceBlock }), contract.balanceOf(row.legacyCitizen.toLowerCase(), { blockTag: sourceBlock }), contract.balanceOf(row.v2.toLowerCase(), { blockTag: sourceBlock }),
      ]);
      return { total, citizenHeld, wrapperHeld };
    }));
    const v2 = call(row.v2);
    const [v2TotalRaw, v2CitizenHeldRaw] = await Promise.all([v2.totalSupply({ blockTag: sourceBlock }), v2.balanceOf(row.v2Citizen.toLowerCase(), { blockTag: sourceBlock })]);
    const supply = calculateComponentSupply({
      legacyTotal: safeNumber(legacyReads.reduce((sum, item) => sum + item.total, BigInt(0)), `${row.key} legacy supply`),
      legacyCitizenHeld: safeNumber(legacyReads.reduce((sum, item) => sum + item.citizenHeld, BigInt(0)), `${row.key} legacy assembly custody`),
      v2WrapperHeld: safeNumber(legacyReads.reduce((sum, item) => sum + item.wrapperHeld, BigInt(0)), `${row.key} migration custody`),
      v2Total: safeNumber(v2TotalRaw, `${row.key} V2 supply`),
      v2CitizenHeld: safeNumber(v2CitizenHeldRaw, `${row.key} V2 assembly custody`),
    });
    return { key: row.key, supply: supply.economicallyDistinct, breakdown: supply };
  }));

  return {
    sourceBlock, sourceBlockHash: block.hash, blockAsOf: new Date(block.timestamp * 1_000).toISOString(),
    rows: [...citizenRows, ...componentRows],
  };
}

const cachedListingSnapshot = unstable_cache(async () => {
  const rows = await Promise.all(CITIZEN_COLLECTIONS.map(async (collection) => ({
    collection,
    listings: await openSeaListings(collection.slug, collection.key === 's1-citizens' ? 50 : 20),
  })));
  return { asOf: new Date().toISOString(), rows };
}, ['citizen-market-listings-v2'], { revalidate: LISTINGS_REVALIDATE_SECONDS });

const cachedOfferSnapshot = unstable_cache(async () => {
  const settled = await Promise.allSettled(CITIZEN_COLLECTIONS.map((collection) => openSeaTopCollectionOffer(collection.slug)));
  if (settled.every((result) => result.status === 'rejected')) throw new Error('OpenSea offer snapshot unavailable');
  const rows = CITIZEN_COLLECTIONS.map((collection, index) => ({
    key: collection.key,
    offer: settled[index].status === 'fulfilled' ? settled[index].value : null,
  }));
  return { asOf: new Date().toISOString(), rows };
}, ['citizen-market-offers-v2'], { revalidate: OFFERS_REVALIDATE_SECONDS });

const cachedRankingSnapshot = unstable_cache(async () => {
  const rows = await s1Rankings();
  return { asOf: new Date().toISOString(), rows };
}, ['citizen-market-s1-rankings-v2'], { revalidate: RANKINGS_REVALIDATE_SECONDS });

const cachedSupplySnapshot = unstable_cache(async () => ({
  ...(await supplySnapshot()),
  capturedAt: new Date().toISOString(),
}), ['citizen-market-supply-v2'], { revalidate: SUPPLY_REVALIDATE_SECONDS });

export async function GET() {
  try {
    const [listingSnapshot, offerSnapshot, rankingSnapshot, supplies] = await Promise.all([
      cachedListingSnapshot(), cachedOfferSnapshot(), cachedRankingSnapshot(), cachedSupplySnapshot(),
    ]);
    const listingRows = listingSnapshot.rows;
    const listings = listingRows.find(({ collection }) => collection.key === 's1-citizens')?.listings ?? [];
    const offers = new Map(offerSnapshot.rows.map(({ key, offer }) => [key, offer]));
    const supplyByKey = new Map(supplies.rows.map((row) => [row.key, row]));
    const ranks = new Map(rankingSnapshot.rows.map((row) => [row.tokenId, row]));
    const activeListings = listings.filter((item) => item.tokenId && item.bestListing?.pricePerItem?.token?.unit != null);
    const eliteListings = activeListings.map((item) => {
      const rank = ranks.get(item.tokenId!);
      const rewardRate = item.attributes?.find((attribute) => attribute.traitType === 'Reward Rate')?.value ?? null;
      return rank && rank.rarityMonRank <= 500 ? {
        tokenId: item.tokenId, name: item.name ?? `Citizen #${item.tokenId}`, imageUrl: item.imageUrl ?? null,
        rank: rank.rarityMonRank, rarityScore: rank.rarityMonScore,
        priceEth: item.bestListing?.pricePerItem?.token?.unit ?? null, priceUsd: item.bestListing?.pricePerItem?.usd ?? null,
        marketplace: item.bestListing?.marketplace?.identifier ?? 'opensea', rewardRate,
        url: `https://opensea.io/item/ethereum/0xb9951b43802dcf3ef5b14567cb17adf367ed1c0f/${item.tokenId}`,
      } : null;
    }).filter((row): row is NonNullable<typeof row> => Boolean(row)).sort((a, b) => (a.priceEth ?? Infinity) - (b.priceEth ?? Infinity));

    const marketCollections = listingRows.map(({ collection, listings: collectionListings }) => {
      const listed = collectionListings.find((item) => item.bestListing?.pricePerItem?.token?.unit != null);
      const offer = offers.get(collection.key);
      const supply = supplyByKey.get(collection.key);
      return {
        ...collection, floorEth: listed?.bestListing?.pricePerItem?.token?.unit ?? null,
        floorSymbol: listed?.bestListing?.pricePerItem?.token?.symbol ?? 'ETH',
        topOfferEth: offer?.priceEth ?? null, topOfferUsd: offer?.priceUsd ?? null,
        offerQuantity: offer?.quantity ?? null, offerCount: offer?.offerCount ?? null, offerSymbol: offer?.symbol ?? 'WETH',
        economicallyDistinctSupply: supply?.supply ?? null, supplyBreakdown: supply?.breakdown ?? null,
        owners: null, sales24h: null, url: `https://opensea.io/collection/${collection.slug}`,
      };
    });
    const firstListing = listingRows.flatMap((row) => row.listings).find((item) => item.bestListing?.pricePerItem?.usd && item.bestListing?.pricePerItem?.token?.unit);
    const listingEthUsd = firstListing ? Number(firstListing.bestListing!.pricePerItem!.usd) / Number(firstListing.bestListing!.pricePerItem!.token!.unit) : null;
    const firstOffer = marketCollections.find((row) => row.topOfferEth && row.topOfferUsd);
    const ethUsd = listingEthUsd ?? (firstOffer ? Number(firstOffer.topOfferUsd) / Number(firstOffer.topOfferEth) : null);

    return NextResponse.json({
      asOf: listingSnapshot.asOf, ethUsd,
      sourceTimes: {
        listingsAsOf: listingSnapshot.asOf,
        offersAsOf: offerSnapshot.asOf,
        rankingsAsOf: rankingSnapshot.asOf,
        supplyAsOf: supplies.capturedAt,
      },
      collections: [
        ...marketCollections,
        { key: 's1-elite', season: 'S1', label: 'Elite Citizens', slug: 'neotokyo-citizens', contract: '0xB9951B43802dCF3ef5b14567cb17adF367ed1c0F', floorEth: eliteListings[0]?.priceEth ?? null, floorSymbol: 'ETH', owners: null, sales24h: null, url: 'https://opensea.io/collection/neotokyo-citizens' },
      ],
      valuation: {
        classification: 'estimated', sourceBlock: supplies.sourceBlock, sourceBlockHash: supplies.sourceBlockHash, blockAsOf: supplies.blockAsOf,
        totalCollections: marketCollections.length, rows: marketCollections.map(({ key, season, label, url, economicallyDistinctSupply, supplyBreakdown, floorEth, topOfferEth, offerQuantity, offerCount }) => ({ key, season, label, url, supply: economicallyDistinctSupply, supplyBreakdown, floorEth, offerEth: topOfferEth, offerQuantity, offerCount })),
        methodology: 'Active assembled Citizens plus economically distinct unassembled legacy and V2 components, with all supply and custody reads pinned to one Ethereum block.',
      },
      s1ListingCount: activeListings.length < 50 ? activeListings.length : '50+', eliteListings,
      notes: [
        'Elite means a current S1 rarity rank of 500 or better.',
        'Floors are the lowest executable OpenSea listings returned by the current price-sorted listing feed.',
        'Top offers are active OpenSea collection-wide offer aggregates; displayed quantity is limited offer depth, not collection-wide liquidity.',
        'Floor and offer data are live OpenSea references and can change before a transaction confirms.',
      ],
      sources: ['OpenSea current listing feed', 'OpenSea collection offer aggregates', 'Ethereum legacy and V2 Citizen/component contracts', 'NeoTokyo.codes Citizen rankings'],
    }, { headers: { 'Cache-Control': MARKET_CACHE_CONTROL } });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Citizen market data failed';
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
