import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
// @ts-expect-error Node's strip-types test runner imports the TypeScript source directly.
import { calculateStakingPoints, getStakingBytesCap } from '../lib/citizen-terminal.ts';
// @ts-expect-error Node's strip-types test runner imports the TypeScript source directly.
import { extractOpenSeaEstimatedRank } from '../lib/opensea-rarity.ts';
// @ts-expect-error Node's strip-types test runner imports the TypeScript source directly.
import { calculateCitizenSupply, calculateComponentSupply, calculateImpliedValuation, NEO_TOKYO_SUPPLY_CONFIG } from '../lib/citizen-valuation.ts';
// @ts-expect-error Node's strip-types test runner imports the TypeScript source directly.
import { buildBytes2BytesSummary, normalizeCitizenPosition } from '../lib/bytes-to-bytes.ts';

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

test('S1 and S2 Citizen acquisition prices are independently editable with live-floor defaults', async () => {
  const ui = await readFile(new URL('../app/citizen/CitizenTerminal.tsx', import.meta.url), 'utf8');

  assert.match(ui, /const \[s1CitizenPriceEth, setS1CitizenPriceEth\] = useState<string \| null>\(null\)/);
  assert.match(ui, /const \[s2CitizenPriceEth, setS2CitizenPriceEth\] = useState<string \| null>\(null\)/);
  assert.match(ui, /CITIZEN PRICE \(ETH\)/);
  assert.match(ui, /CUSTOM PRICE/);
  assert.match(ui, /USE LIVE FLOOR/);
  assert.match(ui, /citizenPriceEth \* market\.ethUsd \+ points\.bytesStaked \* bytesPrice/);
  assert.match(ui, /Historical ETH purchases use today&apos;s ETH\/USD/);
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
  assert.match(ui, /useState\('3099'\)/);
  assert.match(ui, /value === 's1' \? '3099' : '1033'/);
  assert.match(ui, /group === 'S1' \? 'NEO TOKYO CITY' : 'OUTERLANDS'/);
  assert.match(ui, /<span>\{group\} FLOORS<\/span>/);
  assert.doesNotMatch(ui, /INNER CITY|OUTER CITY/);
});

test('Citizen market sources use independent conservative refresh tiers', async () => {
  const [marketRoute, rewardRoute, ui, metricContract] = await Promise.all([
    readFile(new URL('../app/api/citizen-terminal/market/route.ts', import.meta.url), 'utf8'),
    readFile(new URL('../app/api/citizen-terminal/reward-rate/route.ts', import.meta.url), 'utf8'),
    readFile(new URL('../app/citizen/CitizenTerminal.tsx', import.meta.url), 'utf8'),
    readFile(new URL('../docs/citizen-terminal-metric-contract.md', import.meta.url), 'utf8'),
  ]);

  assert.match(marketRoute, /LISTINGS_REVALIDATE_SECONDS = 300/);
  assert.match(marketRoute, /OFFERS_REVALIDATE_SECONDS = 900/);
  assert.match(marketRoute, /RANKINGS_REVALIDATE_SECONDS = 3_600/);
  assert.match(marketRoute, /SUPPLY_REVALIDATE_SECONDS = 3_600/);
  assert.match(marketRoute, /s-maxage=300, stale-while-revalidate=900/);
  assert.match(marketRoute, /sourceTimes: \{/);
  assert.match(marketRoute, /listingsAsOf: listingSnapshot\.asOf/);
  assert.match(marketRoute, /offersAsOf: offerSnapshot\.asOf/);
  assert.match(marketRoute, /rankingsAsOf: rankingSnapshot\.asOf/);

  assert.match(rewardRoute, /REWARD_RATE_REVALIDATE_SECONDS = 3_600/);
  assert.match(rewardRoute, /cachedRewardRateSnapshot = unstable_cache/);
  assert.match(rewardRoute, /\['citizen-reward-rate-v2'\]/);
  assert.match(rewardRoute, /s-maxage=\$\{REWARD_RATE_REVALIDATE_SECONDS\}/);
  assert.match(rewardRoute, /stale-while-revalidate=\$\{REWARD_RATE_REVALIDATE_SECONDS \* 4\}/);
  assert.match(ui, /Listings [\s\S]* Offers [\s\S]* Ranks/);
  assert.match(metricContract, /Floors and Elite listing scan.*5 minutes/);
  assert.match(metricContract, /Current BYTES per point per day[\s\S]*1 hour/);
});

test('Citizen hero mirrors the BYTES Terminal hierarchy with an honest snapshot summary', async () => {
  const [ui, css, page, nav] = await Promise.all([
    readFile(new URL('../app/citizen/CitizenTerminal.tsx', import.meta.url), 'utf8'),
    readFile(new URL('../app/citizen/citizen.css', import.meta.url), 'utf8'),
    readFile(new URL('../app/citizen/page.tsx', import.meta.url), 'utf8'),
    readFile(new URL('../app/components/SiteNav.tsx', import.meta.url), 'utf8'),
  ]);

  assert.match(ui, /<div className="ct-hero-title">/);
  assert.match(ui, /<h1 id="citizen-title">Citizen <em>Interlink<\/em><\/h1>/);
  assert.match(ui, /Inspect the code\. Price the yield\. Read the market\./);
  assert.match(ui, /ct-snapshot-stamp/);
  assert.match(ui, /INTERLINK ACTIVE/);
  assert.match(ui, /ct-snapshot-stamp \$\{snapshotSourceTimes\.length === 6 \? 'is-complete' : ''\}/);
  assert.match(ui, /<strong><i aria-hidden="true" \/>/);
  assert.match(ui, /Latest source interlinked/);
  assert.match(ui, /Oldest source/);
  assert.match(ui, /5 min–1 hr refresh range/);
  assert.match(page, /title: 'Citizen Interlink \| Neo Tokyo Market Intelligence'/);
  assert.match(nav, /href: '\/citizen', label: 'Citizen Interlink'/);
  assert.doesNotMatch(ui, /Citizen <em>Terminal<\/em>|MULTI-SOURCE SNAPSHOT/);
  assert.doesNotMatch(page, /Citizen Terminal/);
  assert.doesNotMatch(nav, /label: 'Citizen Terminal'/);
  assert.doesNotMatch(ui, /<div className="ct-kicker"><span \/>/);
  assert.match(css, /\.ct-hero\{[^}]*grid-template-columns/);
  assert.match(css, /\.ct-kicker\{[^}]*justify-content:flex-start/);
  assert.match(css, /\.ct-snapshot-stamp\{/);
  assert.match(css, /\.ct-snapshot-stamp\.is-complete i\{/);
  assert.match(css, /\.ct-valuation-caveat\{[^}]*font-size:10px/);
  assert.match(css, /\.ct-valuation-source\{[^}]*font-size:9px/);
  assert.match(css, /\.ct-disclaimer\{[^}]*font-size:10px[^}]*line-height:1\.65/);
  assert.match(css, /\.ct-asof\{[^}]*font-size:9px[^}]*line-height:1\.65/);
  assert.match(css, /@media\(min-width:900px\)\{\.ct-valuation-caveat,.ct-disclaimer\{font-size:11px\}\.ct-valuation-source,.ct-asof\{font-size:10px\}/);
});

test('Citizen Interlink uses the universal Grid Phantoms footer', async () => {
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

test('both Citizen seasons use the cached first-party image route', async () => {
  const lookupRoute = await readFile(new URL('../app/api/citizen-terminal/lookup/route.ts', import.meta.url), 'utf8');
  const imageRoute = await readFile(new URL('../app/api/citizen-terminal/image/route.ts', import.meta.url), 'utf8');

  assert.match(lookupRoute, /image\?season=s1&tokenId=/);
  assert.match(lookupRoute, /image\?season=s2&tokenId=/);
  assert.match(imageRoute, /CITIZEN_CONTRACTS\[season\]/);
  assert.match(imageRoute, /s-maxage=604800/);
});

test('Bytes2Bytes normalizes staked Citizens and calculates the S1/S2 wallet summary', () => {
  const e18 = BigInt('1000000000000000000');
  const s1 = normalizeCitizenPosition('s1', {
    citizenId: BigInt(1467),
    stakedBytes: BigInt(2_000) * e18,
    timelockEndTime: BigInt(1_900_000_000),
    points: BigInt(1_200),
    stakedVaultId: BigInt(88),
    hasVault: true,
  });
  const s2 = normalizeCitizenPosition('s2', {
    citizenId: BigInt(3883),
    stakedBytes: BigInt(200) * e18,
    timelockEndTime: BigInt(0),
    points: BigInt(200),
  });
  assert.equal(s1.citizenId, '1467');
  assert.equal(s1.stakedBytes, 2_000);
  assert.equal(s1.vaultId, '88');
  assert.equal(s2.citizenId, '3883');
  assert.equal(s2.hasVault, null);

  const summary = buildBytes2BytesSummary({
    walletBalance: 3.35,
    pendingByPool: { s1: 4.5, s2: 2.33 },
    s1Citizens: [s1],
    s2Citizens: [s2],
  });
  assert.equal(summary.citizenBytesStaked, 2_200);
  assert.equal(summary.pendingRewards, 6.83);
  assert.equal(summary.totalBytes, 2_210.18);
  assert.equal(summary.citizenCount, 2);
});

test('Bytes2Bytes distinguishes component Vaults from separately staked Vault IDs', () => {
  const componentVault = normalizeCitizenPosition('s1', {
    citizenId: BigInt(3099),
    stakedBytes: BigInt(0),
    timelockEndTime: BigInt(0),
    points: BigInt(100),
    stakedVaultId: BigInt(0),
    hasVault: true,
  });
  assert.equal(componentVault.hasVault, true);
  assert.equal(componentVault.vaultId, null);
});

test('Citizen Interlink exposes Bytes2Bytes as a separate sub-tool and preserves the original project provenance', async () => {
  const [overview, page, api, subnav] = await Promise.all([
    readFile(new URL('../app/citizen/CitizenTerminal.tsx', import.meta.url), 'utf8'),
    readFile(new URL('../app/citizen/bytes2bytes/page.tsx', import.meta.url), 'utf8'),
    readFile(new URL('../app/api/citizen-terminal/bytes2bytes/route.ts', import.meta.url), 'utf8'),
    readFile(new URL('../app/citizen/CitizenSubnav.tsx', import.meta.url), 'utf8'),
  ]);
  assert.match(overview, /ENTER BYTES2BYTES/);
  assert.match(page, /\$BYTES to \$BYTES/);
  assert.match(page, /bytestobytes\.com/);
  assert.match(subnav, /\/citizen\/bytes2bytes/);
  assert.match(api, /getStakerPositions/);
  assert.match(api, /getPendingPoolReward/);
  assert.match(api, /private, no-store/);
});

test('Bytes2Bytes inventories pinned wallet-held Citizen assets and reveals component art on demand', async () => {
  const [api, imageRoute, ui, css] = await Promise.all([
    readFile(new URL('../app/api/citizen-terminal/bytes2bytes/route.ts', import.meta.url), 'utf8'),
    readFile(new URL('../app/api/citizen-terminal/asset-image/route.ts', import.meta.url), 'utf8'),
    readFile(new URL('../app/citizen/bytes2bytes/Bytes2Bytes.tsx', import.meta.url), 'utf8'),
    readFile(new URL('../app/citizen/bytes2bytes/bytes2bytes.css', import.meta.url), 'utf8'),
  ]);

  assert.match(api, /CITIZEN_COLLECTIONS\.map/);
  assert.match(api, /ownerOfInterface\.encodeFunctionData\('ownerOf'/);
  assert.match(api, /aggregate3\.staticCall\(calls, \{ blockTag: blockNumber \}\)/);
  assert.match(api, /directAssets/);
  assert.match(imageRoute, /getNFTMetadata/);
  assert.match(imageRoute, /ALLOWED_IMAGE_HOSTS/);
  assert.match(ui, /04 \/ UNSTAKED CITIZENS \/ COMPONENTS/);
  assert.match(ui, /Undeposited Assets/);
  assert.match(ui, /Other Neo Tokyo Citizen assets detected directly in this wallet but outside the active B\.O\.N\.T\. staking statement\./);
  assert.match(ui, /<details className="b2b-component-collection"/);
  assert.match(ui, /resultHeadRef\.current\?\.scrollIntoView/);
  assert.match(css, /\.b2b-tribute\{display:flex;flex-direction:column/);
});

test('Bytes2Bytes artwork never exposes native broken-image UI and supports clean retry states', async () => {
  const [ui, imageRoute, assetImageRoute, metadataHelper, css] = await Promise.all([
    readFile(new URL('../app/citizen/bytes2bytes/Bytes2Bytes.tsx', import.meta.url), 'utf8'),
    readFile(new URL('../app/api/citizen-terminal/image/route.ts', import.meta.url), 'utf8'),
    readFile(new URL('../app/api/citizen-terminal/asset-image/route.ts', import.meta.url), 'utf8'),
    readFile(new URL('../app/api/_lib/ethereum-nft-metadata.ts', import.meta.url), 'utf8'),
    readFile(new URL('../app/citizen/bytes2bytes/bytes2bytes.css', import.meta.url), 'utf8'),
  ]);

  assert.match(ui, /function AssetArtwork/);
  assert.match(ui, /LOADING ART/);
  assert.match(ui, /ART NOT AVAILABLE/);
  assert.match(ui, /RETRY ART/);
  assert.match(ui, /setAttempt\(\(value\) => value \+ 1\)/);
  assert.match(ui, /function ComponentCollection/);
  assert.match(ui, /open && <div className="b2b-component-grid">/);
  assert.match(ui, /function componentItemLabel/);
  assert.match(ui, /Vault Card/);
  assert.match(ui, /Item Cache/);
  assert.match(ui, /Land Deed/);
  assert.match(ui, /Outer Identity/);
  assert.match(ui, /<AssetArtwork src=/);
  assert.match(ui, /\/api\/citizen-terminal\/image\?season=\$\{collection\.season\.toLowerCase\(\)\}/);
  assert.match(imageRoute, /const LAYER_FETCH_ATTEMPTS = 3/);
  assert.match(imageRoute, /fetchCitizenLayer/);
  assert.match(imageRoute, /getOnchainMetadataImage/);
  assert.match(assetImageRoute, /const isComponent/);
  assert.match(assetImageRoute, /refreshCache: retry \? 'true' : 'false'/);
  assert.match(assetImageRoute, /fetchImageCandidate/);
  assert.match(assetImageRoute, /getOnchainMetadataImage/);
  assert.match(metadataHelper, /image_data/);
  assert.match(metadataHelper, /TOKEN_URI_SELECTOR/);
  assert.match(css, /\.b2b-art-retry/);
});
