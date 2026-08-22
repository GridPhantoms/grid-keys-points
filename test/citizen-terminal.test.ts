import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
// @ts-expect-error Node's strip-types test runner imports the TypeScript source directly.
import { calculateStakingPoints, getStakingBytesCap } from '../lib/citizen-terminal.ts';
// @ts-expect-error Node's strip-types test runner imports the TypeScript source directly.
import { extractOpenSeaEstimatedRank } from '../lib/opensea-rarity.ts';
// @ts-expect-error Node's strip-types test runner imports the TypeScript source directly.
import { calculateCitizenSupply, calculateComponentSupply, calculateImpliedValuation, NEO_TOKYO_SUPPLY_CONFIG } from '../lib/citizen-valuation.ts';

test('S2 accepts 200 BYTES and never calculates more than one BYTES point', () => {
  const atCap = calculateStakingPoints({ season: 's2', lockPeriod: '12 months', bytesStaked: 200 });
  const overCap = calculateStakingPoints({ season: 's2', lockPeriod: '12 months', bytesStaked: 999_999 });

  assert.equal(atCap.bytesStaked, 200);
  assert.equal(atCap.bytesPoints, 1);
  assert.equal(atCap.totalPoints, 2.75);
  assert.equal(atCap.wasClamped, false);
  assert.equal(overCap.bytesStaked, 200);
  assert.equal(overCap.bytesPoints, 1);
  assert.equal(overCap.totalPoints, 2.75);
  assert.equal(overCap.wasClamped, true);
});

test('vaultless S1 uses the same 200 BYTES cap', () => {
  const result = calculateStakingPoints({
    season: 's1',
    creditYield: 'High',
    vaultMultiplier: 'None',
    lockPeriod: '12 months',
    bytesStaked: 500,
    hasVault: false,
  });

  assert.equal(getStakingBytesCap('s1', false), 200);
  assert.equal(result.bytesStaked, 200);
  assert.equal(result.bytesPoints, 1);
  assert.equal(result.totalPoints, 7);
  assert.equal(result.wasClamped, true);
});

test('vaulted S1 retains the configured 2,000 BYTES cap', () => {
  const result = calculateStakingPoints({
    season: 's1',
    creditYield: 'Low',
    vaultMultiplier: 'Low',
    lockPeriod: '1 month',
    bytesStaked: 2_001,
    hasVault: true,
  });

  assert.equal(getStakingBytesCap('s1', true), 2_000);
  assert.equal(result.bytesStaked, 2_000);
  assert.equal(result.bytesPoints, 10);
  assert.equal(result.totalPoints, 11);
  assert.equal(result.wasClamped, true);
});

test('invalid and negative BYTES inputs contribute zero points', () => {
  assert.equal(calculateStakingPoints({ season: 's2', bytesStaked: Number.NaN }).bytesPoints, 0);
  assert.equal(calculateStakingPoints({ season: 's2', bytesStaked: -50 }).bytesPoints, 0);
});

test('OpenSea estimated rank parser validates the requested item', () => {
  const contract = '0x4481507cc228FA19D203BD42110d679571f7912E';
  const html = '<script>{"itemByIdentifier":{"contractAddress":"0x4481507cc228fa19d203bd42110d679571f7912e","tokenId":"739","rarity":{"rank":680,"category":"RARE"}}}</script>';
  assert.equal(extractOpenSeaEstimatedRank(html, contract, '739'), 680);
  assert.equal(extractOpenSeaEstimatedRank(html, contract, '740'), null);
  assert.equal(extractOpenSeaEstimatedRank(html.replace('"rarity":{"rank":680,"category":"RARE"}', '"rarity":null'), contract, '739'), null);
});

test('dual-version supply accounting excludes assembly and migration custody', () => {
  assert.deepEqual(calculateCitizenSupply({ legacyTotal: 2_081, legacyHeldByV2: 1_985, v2Total: 2_036 }), {
    legacyExternal: 96,
    v2Active: 2_036,
    economicallyDistinct: 2_132,
  });
  assert.deepEqual(calculateComponentSupply({ legacyTotal: 2_153, legacyCitizenHeld: 2_081, v2WrapperHeld: 55, v2Total: 344, v2CitizenHeld: 312 }), {
    legacyExternal: 17,
    v2External: 32,
    economicallyDistinct: 49,
  });
});

test('implied valuation supports floor-led fallback, offer-led depth, and fail-closed coverage', () => {
  const rows = [
    { key: 'a', supply: 10, floorEth: 2, offerEth: 1, offerQuantity: 3 },
    { key: 'b', supply: 5, floorEth: null, offerEth: 0.5, offerQuantity: 1 },
  ];
  const floorLed = calculateImpliedValuation(rows, 'floor', 2_000, 100_000);
  assert.equal(floorLed.complete, true);
  assert.equal(floorLed.nftEth, 22.5);
  assert.equal(floorLed.totalUsd, 145_000);
  assert.equal(floorLed.rows[1].method, 'bid-fallback');
  const offerLed = calculateImpliedValuation(rows, 'offer', 2_000, 100_000);
  assert.equal(offerLed.nftEth, 12.5);
  assert.equal(offerLed.rows[0].offerQuantity, 3);
  const incomplete = calculateImpliedValuation([...rows, { key: 'c', supply: 1, floorEth: null, offerEth: null, offerQuantity: null }], 'floor', 2_000, 100_000);
  assert.equal(incomplete.complete, false);
  assert.equal(incomplete.totalUsd, null);
  assert.equal(incomplete.coverage, 2);
});

test('live valuation source covers nine distinct rows and pins every custody read', async () => {
  const keys: string[] = [
    ...NEO_TOKYO_SUPPLY_CONFIG.citizens.map((row) => row.key),
    ...NEO_TOKYO_SUPPLY_CONFIG.components.map((row) => row.key),
  ];
  assert.equal(keys.length, 9);
  assert.equal(new Set(keys).size, 9);
  assert.equal(keys.includes('s1-elite'), false);

  const route = await readFile(new URL('../app/api/citizen-terminal/market/route.ts', import.meta.url), 'utf8');
  assert.match(route, /const sourceBlock = Math\.max\(0, latest - 3\)/);
  assert.ok((route.match(/blockTag: sourceBlock/g) ?? []).length >= 8);
  assert.match(route, /OpenSea collection offer aggregates/);
  assert.match(route, /totalCollections: marketCollections\.length/);

  const ui = await readFile(new URL('../app/citizen/CitizenTerminal.tsx', import.meta.url), 'utf8');
  assert.ok(ui.indexOf('className="ct-market-groups"') < ui.indexOf('className="ct-valuation-card"'));
  assert.match(ui, /https:\/\/nftpricefloor\.com\/brands/);
  assert.match(ui, /created in response to inaccuracies identified/);
});

test('Citizen Terminal uses the universal Grid Phantoms footer', async () => {
  const [page, footer] = await Promise.all([
    readFile(new URL('../app/citizen/page.tsx', import.meta.url), 'utf8'),
    readFile(new URL('../app/components/SiteFooter.tsx', import.meta.url), 'utf8'),
  ]);

  assert.match(page, /<SiteFooter\s*\/>/);
  for (const expected of [
    'https://discord.gg/gridphantoms',
    'https://x.com/GridPhantoms',
    'https://opensea.io/collection/grid-phantoms-genesis-keys',
    'https://snapshot.box/#/s:gridphantoms.eth',
    'https://manifold.xyz/@gridphantoms/id/4067746032',
    '© 2026 Grid Phantoms Ltd. All rights reserved.',
  ]) assert.ok(footer.includes(expected));
});
