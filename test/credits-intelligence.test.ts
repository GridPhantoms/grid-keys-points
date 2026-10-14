import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import {
  compareBuildAndBuyValue,
  filterCreditListings,
  matchingCreditListings,
  normalizeOfficialCreditSnapshot,
  normalizeOpenSeaStatementMetadata,
  parseValueQuery,
  reconcileFreshCreditListings,
  rankStatementListings,
  summarizeStatementSupply,
} from '../lib/credits-intelligence.ts';
import { createEthUsdQuoteResolver } from '../lib/eth-usd.ts';

const currentCheckedAt = new Date().toISOString();
const creditUrl = (id: number) => `https://opensea.io/assets/ethereum/0x97630aa70ab14ed9883b41dafccbc11349723043/${id}`;

const officialItem = (overrides: Record<string, unknown> = {}) => ({
  id: 12,
  listed: true,
  price: '0.12',
  currency: 'ETH',
  url: 'https://opensea.io/assets/ethereum/0x97630aa70ab14ed9883b41dafccbc11349723043/12',
  checkedAt: currentCheckedAt,
  score: 800,
  rank: 120,
  ...overrides,
});

test('official snapshot normalization exposes only complete rated ETH listings', () => {
  const result = normalizeOfficialCreditSnapshot({
    complete: true,
    updatedAt: 1_760_268_000_000,
    nextRefresh: 1_760_268_300_000,
    items: [officialItem()],
  }, 2500);

  assert.equal(result.items.length, 1);
  assert.deepEqual(result.items[0], {
    tokenId: 12,
    creditRating: 800,
    officialRank: 120,
    priceEth: 0.12,
    priceUsd: 300,
    ethPer1kCr: 0.15,
    checkedAt: currentCheckedAt,
    url: 'https://opensea.io/assets/ethereum/0x97630aa70ab14ed9883b41dafccbc11349723043/12',
  });
});

test('ETH-USD quote resolver falls back from Coinbase to Kraken', async () => {
  const requested: string[] = [];
  const resolveQuote = createEthUsdQuoteResolver({
    now: () => new Date('2026-10-14T08:00:00.000Z'),
    fetcher: async (input) => {
      const url = String(input);
      requested.push(url);
      if (url.includes('coinbase')) return new Response(null, { status: 503 });
      return Response.json({ error: [], result: { XETHZUSD: { c: ['2510.42', '1.0'] } } });
    },
  });

  const quote = await resolveQuote();
  assert.equal(quote.price, 2510.42);
  assert.equal(quote.provider, 'kraken');
  assert.equal(quote.cached, false);
  assert.equal(requested.length, 2);
});

test('ETH-USD quote resolver uses a successful quote for up to one hour when both providers fail', async () => {
  let now = new Date('2026-10-14T08:00:00.000Z');
  let providersAvailable = true;
  const resolveQuote = createEthUsdQuoteResolver({
    now: () => now,
    fetcher: async (input) => {
      if (!providersAvailable) throw new Error('network unavailable');
      if (String(input).includes('coinbase')) {
        return Response.json({ price: '2508.90', time: '2026-10-14T07:59:30.000Z' });
      }
      throw new Error('unexpected backup request');
    },
  });

  const live = await resolveQuote();
  providersAvailable = false;
  now = new Date('2026-10-14T08:59:29.000Z');
  const cached = await resolveQuote();

  assert.equal(live.provider, 'coinbase');
  assert.equal(cached.price, 2508.9);
  assert.equal(cached.provider, 'coinbase');
  assert.equal(cached.cached, true);
  now = new Date('2026-10-14T09:00:01.000Z');
  await assert.rejects(resolveQuote(), /unavailable/i);
});

test('live Statement metadata reconciles burn progress and stage counts', () => {
  const result = summarizeStatementSupply([
    { tokenId: 1, format: 'Accrued', stage: 'BASE', credits: 80, layers: 1, creditRating: 1000 },
    { tokenId: 2, format: 'Accrued', stage: 'LAYERED', credits: 160, layers: 2, creditRating: 2000 },
    { tokenId: 3, format: 'Accrued', stage: 'INVERTED', credits: 640, layers: 8, creditRating: 3000 },
  ], 122_154);
  assert.deepEqual(result, {
    original: 122_154,
    loose: 121_274,
    burned: 880,
    burnedPct: 880 / 122_154 * 100,
    activeStatements: 3,
    stageCounts: { BASE: 1, LAYERED: 1, INVERTED: 1 },
  });
});

test('live Statement supply fails closed on duplicate or unreconciled metadata', () => {
  const item = { tokenId: 1, format: 'Accrued', stage: 'BASE', credits: 80, layers: 1, creditRating: 1000 };
  assert.throws(() => summarizeStatementSupply([item, item], 122_154), /duplicate/i);
  assert.throws(() => summarizeStatementSupply([{ ...item, credits: 160 }], 122_154), /reconcile/i);
});

test('official snapshot fails closed when incomplete or rating coverage is missing', () => {
  assert.throws(() => normalizeOfficialCreditSnapshot({ complete: false, items: [officialItem()] }, 2500), /incomplete/i);
  assert.throws(() => normalizeOfficialCreditSnapshot({ complete: true, items: [officialItem({ score: null })] }, 2500), /coverage/i);
  assert.throws(() => normalizeOfficialCreditSnapshot({ complete: true, items: [] }, 2500), /coverage/i);
});

test('official snapshot normalization rejects loose schema coercions and preserves null refresh times', () => {
  assert.throws(() => normalizeOfficialCreditSnapshot({ complete: 'false', items: [officialItem()] }, 2500), /incomplete/i);
  const current = Date.now();
  const normalized = normalizeOfficialCreditSnapshot({
    complete: true,
    updatedAt: current,
    nextRefresh: null,
    items: [officialItem({ checkedAt: new Date(current).toISOString() })],
  }, 2500);
  assert.equal(normalized.nextRefresh, null);
  assert.throws(() => normalizeOfficialCreditSnapshot({
    complete: true,
    updatedAt: current,
    items: [officialItem({ checkedAt: '2020-01-01T00:00:00.000Z' })],
  }, 2500), /coverage/i);
});

test('credit filters and sorts use deterministic token ID tie breaks', () => {
  const source = normalizeOfficialCreditSnapshot({
    complete: true,
    updatedAt: 1,
    nextRefresh: 2,
    items: [
      officialItem({ id: 9, score: 900, price: '0.09', rank: 9, url: creditUrl(9) }),
      officialItem({ id: 2, score: 900, price: '0.09', rank: 2, url: creditUrl(2) }),
      officialItem({ id: 3, score: 700, price: '0.05', rank: 3, url: creditUrl(3) }),
    ],
  }, 2000).items;

  assert.deepEqual(
    filterCreditListings(source, { minCr: 750, maxEth: 0.1, sort: 'best-value', limit: 50 }).map((row) => row.tokenId),
    [2, 9],
  );
  assert.deepEqual(
    filterCreditListings(source, { minCr: 0, maxEth: null, sort: 'lowest-price', limit: 50 }).map((row) => row.tokenId),
    [3, 2, 9],
  );
  assert.deepEqual(
    filterCreditListings(source, { minCr: 0, maxEth: null, sort: 'highest-cr', limit: 50 }).map((row) => row.tokenId),
    [2, 9, 3],
  );
});

test('query parsing validates values and bounds result limits to supported options', () => {
  assert.deepEqual(parseValueQuery(new URLSearchParams('minCr=750&maxEth=0.2&sort=highest-cr&limit=100')), {
    minCr: 750,
    maxEth: 0.2,
    sort: 'highest-cr',
    limit: 100,
  });
  assert.deepEqual(parseValueQuery(new URLSearchParams('minCr=-4&maxEth=nope&sort=random&limit=9999')), {
    minCr: 0,
    maxEth: null,
    sort: 'best-value',
    limit: 50,
  });
});

test('query parsing keeps an explicit zero ETH cap', () => {
  assert.equal(parseValueQuery(new URLSearchParams({ maxEth: '0' })).maxEth, 0);
});

test('Statements return the top 10 current values with deterministic ties', () => {
  const metadata = Array.from({ length: 12 }, (_, index) => ({
    tokenId: index + 1,
    format: index === 0 ? 'Issued' : 'Consolidated',
    stage: 'BASE',
    credits: 80,
    layers: 1,
    creditRating: 1000,
  }));
  const listings = metadata.map((row) => ({
    tokenId: row.tokenId,
    priceEth: row.tokenId === 1 || row.tokenId === 2 ? 0.1 : row.tokenId / 10,
    url: `https://opensea.io/assets/ethereum/0xstatements/${row.tokenId}`,
  }));

  const ranked = rankStatementListings(metadata, listings, 2500);
  assert.equal(ranked.length, 10);
  assert.deepEqual(ranked.slice(0, 2).map((row) => row.tokenId), [1, 2]);
  assert.equal(ranked[0].priceUsd, 250);
  assert.equal(ranked[0].ethPer1kCr, 0.1);
});

test('Statement ranking fails closed when a live listing lacks metadata coverage', () => {
  assert.throws(
    () => rankStatementListings([], [{
      tokenId: 999,
      priceEth: 1,
      url: 'https://opensea.io/assets/ethereum/0x75edd94b7e49b3bd5c8047b91f165a5e265a069b/999',
    }], 2500),
    /metadata coverage is incomplete/,
  );
});

test('newly listed Statement metadata can be verified without waiting for the daily snapshot', () => {
  assert.deepEqual(normalizeOpenSeaStatementMetadata(205, { nft: { traits: [
    { trait_type: 'Format', value: 'Recorded' },
    { trait_type: 'Credits', value: '240' },
    { trait_type: 'Overprints', value: '2' },
    { trait_type: 'Credit Rating', value: '122887' },
  ] } }), {
    tokenId: 205,
    format: 'Recorded',
    stage: 'LAYERED',
    credits: 240,
    layers: 3,
    creditRating: 122887,
  });
});

test('live Statement metadata fails closed when Credits and layers do not reconcile', () => {
  assert.throws(() => normalizeOpenSeaStatementMetadata(205, { nft: { traits: [
    { trait_type: 'Format', value: 'Recorded' },
    { trait_type: 'Credits', value: '80' },
    { trait_type: 'Overprints', value: '2' },
    { trait_type: 'Credit Rating', value: '122887' },
  ] } }), /does not reconcile/);
});

test('credit result limits do not hide the matching count', () => {
  const source = normalizeOfficialCreditSnapshot({
    complete: true,
    updatedAt: 1,
    nextRefresh: 2,
    items: Array.from({ length: 30 }, (_, index) => officialItem({
      id: index + 1,
      score: 800 - index,
      price: '0.02',
      rank: index + 1,
      url: creditUrl(index + 1),
    })),
  }, 2000).items;
  const query = { minCr: 0, maxEth: null, sort: 'best-value' as const, limit: 25 as const };
  assert.equal(matchingCreditListings(source, query).length, 30);
  assert.equal(filterCreditListings(source, query).length, 25);
});

test('manual listing reconciliation removes sold rows and applies current OpenSea prices', () => {
  const source = normalizeOfficialCreditSnapshot({
    complete: true,
    updatedAt: 1,
    nextRefresh: 2,
    items: [
      officialItem({ id: 1, score: 800, price: '0.02', rank: 1, url: creditUrl(1) }),
      officialItem({ id: 2, score: 500, price: '0.03', rank: 2, url: creditUrl(2) }),
    ],
  }, 2000).items;

  const reconciled = reconcileFreshCreditListings(source, [
    { tokenId: 2, priceEth: 0.025 },
  ], 2000, '2026-10-13T09:00:00.000Z');

  assert.deepEqual(reconciled.map((row) => row.tokenId), [2]);
  assert.equal(reconciled[0].priceEth, 0.025);
  assert.equal(reconciled[0].priceUsd, 50);
  assert.equal(reconciled[0].ethPer1kCr, 0.05);
  assert.equal(reconciled[0].checkedAt, '2026-10-13T09:00:00.000Z');
});

test('build versus buy compares normalized ETH per 1K CR rather than headline cost', () => {
  const comparison = compareBuildAndBuyValue({
    looseBasketEth: 0.620937129,
    looseBasketCr: 23863.7528,
    statementFloorEth: 0.709,
    statementFloorCr: 28581,
  });
  assert.equal(comparison.cheaperMarket, 'statement');
  assert.ok(Math.abs(comparison.looseEthPer1kCr - 0.0260200956) < 1e-10);
  assert.ok(Math.abs(comparison.statementEthPer1kCr - 0.0248066898) < 1e-10);
  assert.ok(Math.abs(comparison.savingsPct - 4.66334117) < 1e-8);
});

test('scheduled CREDITS protocol artifacts reconcile identity, supply, and Statement metadata', async () => {
  const [overview, statements] = await Promise.all([
    readFile(new URL('../data/credits-overview.json', import.meta.url), 'utf8').then(JSON.parse),
    readFile(new URL('../data/credits-statements.json', import.meta.url), 'utf8').then(JSON.parse),
  ]);
  const stageCounts = statements.items.reduce((counts: Record<string, number>, item: { stage: string }) => {
    counts[item.stage] = (counts[item.stage] || 0) + 1;
    return counts;
  }, {});
  const creditsInStatements = statements.items.reduce((sum: number, item: { credits: number }) => sum + item.credits, 0);

  assert.equal(overview.snapshotAsOf, statements.snapshotAsOf);
  assert.equal(overview.schemaVersion, 2);
  assert.equal(overview.provenance.cadence, 'scheduled');
  assert.equal(overview.provenance.snapshotId, statements.provenance.snapshotId);
  assert.equal(overview.artifactSetDigest, statements.artifactSetDigest);
  assert.equal(overview.supply.loose + overview.supply.burned, overview.supply.original);
  assert.equal(overview.supply.burned, creditsInStatements);
  assert.equal(overview.statements.active, statements.items.length);
  assert.deepEqual(overview.statements.stageCounts, stageCounts);
  assert.equal(overview.archivedReferences.executableNow, false);
  assert.equal(overview.archivedReferences.ethUsdClose, 2499.45);
});

test('CREDITS Intelligence stays off the main Grid Phantoms navigation', async () => {
  const [nav, home, overview, overviewLoader, valueApi, ethUsdSource, valuePage, finder, css, overviewOg, valueOg] = await Promise.all([
    readFile(new URL('../app/components/SiteNav.tsx', import.meta.url), 'utf8'),
    readFile(new URL('../app/components/GridHome.tsx', import.meta.url), 'utf8'),
    readFile(new URL('../app/credits/page.tsx', import.meta.url), 'utf8'),
    readFile(new URL('../lib/credits-overview-live.ts', import.meta.url), 'utf8'),
    readFile(new URL('../app/api/credits/value/route.ts', import.meta.url), 'utf8'),
    readFile(new URL('../lib/eth-usd.ts', import.meta.url), 'utf8'),
    readFile(new URL('../app/credits/value/page.tsx', import.meta.url), 'utf8'),
    readFile(new URL('../app/credits/value/ValueFinder.tsx', import.meta.url), 'utf8'),
    readFile(new URL('../app/credits/credits.css', import.meta.url), 'utf8'),
    readFile(new URL('../app/credits/opengraph-image.tsx', import.meta.url), 'utf8'),
    readFile(new URL('../app/credits/value/opengraph-image.tsx', import.meta.url), 'utf8'),
  ]);
  assert.doesNotMatch(nav, /href: '\/credits'/);
  assert.doesNotMatch(home, /\/credits/);
  assert.doesNotMatch(overview, /why it surfaced/i);
  assert.doesNotMatch(overview, /Rating coverage/i);
  assert.match(overview, /CREDITS Burn Progress/);
  assert.match(overview, /Burned\/In Statements/);
  assert.match(overview, /Where does 1,000 CR cost less\?/);
  assert.match(overview, /sweeping the \{basket\.credits\} lowest-priced loose CREDITS found on the floor/);
  assert.match(overview, /snapshot comparison, not a live executable quote/);
  assert.match(overview, /Find more Credit Rating for less/);
  assert.match(overview, /View market stats/);
  assert.match(overview, /Market intelligence provided by GridPhantoms/);
  assert.match(overview, /cr-creditline/);
  assert.match(valuePage, /Market intelligence provided by GridPhantoms/);
  assert.match(valuePage, /cr-creditline/);
  assert.match(overview, /Public collector tools for understanding CREDITS supply/);
  assert.match(valuePage, /public collector tool for comparing CREDITS and Statements/);
  assert.match(overviewOg, /READ THE CREDITS/);
  assert.match(overviewOg, /PUBLIC COLLECTOR TOOLS/);
  assert.doesNotMatch(overviewOg, /KEYHOLDER GOVERNANCE/);
  assert.match(valueOg, /FIND MORE CREDIT/);
  assert.match(valueOg, /FREE · READ-ONLY/);
  assert.doesNotMatch(valueOg, /KEYHOLDER GOVERNANCE/);
  assert.doesNotMatch(overview, /Value preview/);
  assert.match(overview, /cr-supply-marker/);
  assert.doesNotMatch(overview, /cr-supply-marker[^>]*style=/);
  assert.match(overview, /The Statement Market/);
  assert.doesNotMatch(overview, /Verified snapshot reference/);
  assert.doesNotMatch(overview, /off the floor now/);
  assert.match(overview, /cr-build-copy/);
  assert.match(overview, /export const dynamic = 'force-dynamic'/);
  assert.doesNotMatch(overview, /export const revalidate/);
  assert.match(overviewLoader, /unstable_cache/);
  assert.match(overviewLoader, /REFRESH_SECONDS = 10 \* 60/);
  assert.match(overviewLoader, /credits-statement-orders-v2/);
  assert.match(overviewLoader, /fetchEthUsdQuote\(\)/);
  assert.match(valueApi, /fetchEthUsdQuote\(\)/);
  assert.match(valueApi, /ethUsdSource: ethUsdQuote\.provider/);
  assert.match(ethUsdSource, /api\.kraken\.com\/0\/public\/Ticker/);
  assert.match(ethUsdSource, /MAX_QUOTE_AGE_MS = 60 \* 60 \* 1000/);
  assert.match(ethUsdSource, /lastGoodQuote/);
  assert.doesNotMatch(overviewLoader, /credits-overview-live-v/);
  assert.match(overview, /last completed candidate snapshot/);
  assert.match(overview, /Historical prices are not shown as live/);
  assert.doesNotMatch(overview, /See current values/);
  assert.doesNotMatch(finder, /why it surfaced/i);
  assert.match(finder, /Recheck with OpenSea/);
  assert.match(finder, /refresh', mode/);
  assert.match(finder, /AbortController/);
  assert.match(finder, /visibilitychange/);
  assert.match(finder, /15 \* 60 \* 1000/);
  assert.doesNotMatch(finder, /five minutes/i);
  assert.match(finder, /OpenSea listings and prices may change before purchase|data\.caution/);
  assert.match(css, /@media\(max-width:760px\)/);
  assert.match(css, /@media\(max-width:760px\)[^{]*\{[\s\S]*\.cr-filterbar input,\.cr-filterbar select\{font-size:16px\}/);
  assert.match(css, /\.cr-table-wrap\{display:none\}/);
  assert.match(css, /\.cr-card-list\{display:grid/);
  assert.match(css, /\.cr-nav a\{[^}]*text-transform:uppercase/);
  assert.match(css, /\.cr-stat-grid \.cr-support-stat\{[^}]*font-size:14px/);
  assert.match(css, /\.cr-statement-details dd small\{[^}]*font-size:14px/);
});
