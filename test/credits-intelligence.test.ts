import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
// @ts-expect-error Node's strip-types test runner imports the TypeScript source directly.
import {
  filterCreditListings,
  matchingCreditListings,
  normalizeOfficialCreditSnapshot,
  parseValueQuery,
  reconcileFreshCreditListings,
  rankStatementListings,
} from '../lib/credits-intelligence.ts';

const officialItem = (overrides: Record<string, unknown> = {}) => ({
  id: 12,
  listed: true,
  price: '0.12',
  currency: 'ETH',
  url: 'https://opensea.io/assets/ethereum/0xcredits/12',
  checkedAt: '2026-10-12T12:00:00.000Z',
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
    checkedAt: '2026-10-12T12:00:00.000Z',
    url: 'https://opensea.io/assets/ethereum/0xcredits/12',
  });
});

test('official snapshot fails closed when incomplete or rating coverage is missing', () => {
  assert.throws(() => normalizeOfficialCreditSnapshot({ complete: false, items: [officialItem()] }, 2500), /incomplete/i);
  assert.throws(() => normalizeOfficialCreditSnapshot({ complete: true, items: [officialItem({ score: null })] }, 2500), /coverage/i);
  assert.throws(() => normalizeOfficialCreditSnapshot({ complete: true, items: [] }, 2500), /coverage/i);
});

test('credit filters and sorts use deterministic token ID tie breaks', () => {
  const source = normalizeOfficialCreditSnapshot({
    complete: true,
    updatedAt: 1,
    nextRefresh: 2,
    items: [
      officialItem({ id: 9, score: 900, price: '0.09', rank: 9, url: 'https://opensea.io/9' }),
      officialItem({ id: 2, score: 900, price: '0.09', rank: 2, url: 'https://opensea.io/2' }),
      officialItem({ id: 3, score: 700, price: '0.05', rank: 3, url: 'https://opensea.io/3' }),
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
      url: `https://opensea.io/${index + 1}`,
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
      officialItem({ id: 1, score: 800, price: '0.02', rank: 1, url: 'https://opensea.io/1' }),
      officialItem({ id: 2, score: 500, price: '0.03', rank: 2, url: 'https://opensea.io/2' }),
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

test('CREDITS Intelligence stays off the main Grid Phantoms navigation', async () => {
  const [nav, home, overview, finder, css] = await Promise.all([
    readFile(new URL('../app/components/SiteNav.tsx', import.meta.url), 'utf8'),
    readFile(new URL('../app/components/GridHome.tsx', import.meta.url), 'utf8'),
    readFile(new URL('../app/credits/page.tsx', import.meta.url), 'utf8'),
    readFile(new URL('../app/credits/value/ValueFinder.tsx', import.meta.url), 'utf8'),
    readFile(new URL('../app/credits/credits.css', import.meta.url), 'utf8'),
  ]);
  assert.doesNotMatch(nav, /href: '\/credits'/);
  assert.doesNotMatch(home, /\/credits/);
  assert.doesNotMatch(overview, /why it surfaced/i);
  assert.doesNotMatch(overview, /Rating coverage/i);
  assert.match(overview, /CREDITS Burn Progress/);
  assert.match(overview, /Burned\/In Statements/);
  assert.match(overview, /Building from loose CREDITS was cheaper/);
  assert.match(overview, /Market Intelligence by GridPhantoms/);
  assert.match(overview, /cr-supply-marker/);
  assert.doesNotMatch(overview, /cr-supply-marker[^>]*style=/);
  assert.match(overview, /The Statement Market/);
  assert.match(overview, /Compare ETH per 1K CR/);
  assert.match(overview, /className="cr-primary"[^>]*>See current values/);
  assert.doesNotMatch(finder, /why it surfaced/i);
  assert.match(finder, /Refresh listings/);
  assert.match(finder, /forceFresh/);
  assert.match(finder, /5 \* 60 \* 1000/);
  assert.match(finder, /OpenSea listings and prices may change before purchase|data\.caution/);
  assert.match(css, /@media\(max-width:760px\)/);
  assert.match(css, /\.cr-table-wrap\{display:none\}/);
  assert.match(css, /\.cr-card-list\{display:grid/);
});
