import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import test from 'node:test';

const read = (relativePath: string) => readFile(new URL(relativePath, import.meta.url), 'utf8');

const legacyRoutes = ['bytes', 'leaderboard', 'raffle', 'mint-progress', 'trait-charts'];

test('Keyholder Console fails closed while traits or reward history are unavailable', async () => {
  const source = await read('../app/components/KeyholderConsole.tsx');

  assert.match(source, /type SupportDataState = 'loading' \| 'available' \| 'unavailable'/);
  assert.match(source, /traitDataState/);
  assert.match(source, /rewardDataState/);
  assert.match(source, /disabled=\{loading \|\| !address \|\| traitDataState === 'loading' \|\| rewardDataState === 'loading'\}/);
  assert.match(source, /Trait data is temporarily unavailable/);
  assert.match(source, /Key ownership can still be checked; Trait Points will be marked unavailable/);
  assert.match(source, /Lifetime Phantom Rewards unavailable/);
  assert.doesNotMatch(source, /const rewards = rewardsLookup\[normalizedWallet\] \|\| 0/);
});

test('Keyholder Console renders truthful errors and accessible form semantics', async () => {
  const source = await read('../app/components/KeyholderConsole.tsx');

  assert.match(source, /htmlFor="wallet-address"/);
  assert.match(source, /id="wallet-address"/);
  assert.match(source, /role="alert"/);
  assert.match(source, /\{error\}/);
  assert.match(source, /errorKind === 'empty'/);
  assert.doesNotMatch(source, /\{error && \([\s\S]{0,250}<p[^>]*>No Keys found in this wallet\.<\/p>/);
});

test('snapshot-driven pages separate loading, unavailable, and valid empty states', async () => {
  const [raffle, mint, leaderboard] = await Promise.all([
    read('../app/raffle/page.tsx'),
    read('../app/mint-progress/page.tsx'),
    read('../app/leaderboard/page.tsx'),
  ]);

  assert.match(raffle, /type RaffleEntrant/);
  assert.match(raffle, /raffleError/);
  assert.match(raffle, /if \(!res\.ok\)/);
  assert.match(raffle, /Raffle snapshot is temporarily unavailable/);
  assert.match(raffle, /loading \? /);

  assert.match(mint, /useState<number \| null>\(null\)/);
  assert.match(mint, /mintError/);
  assert.match(mint, /Mint count is temporarily unavailable/);
  assert.match(mint, /progress === null \? '—'/);
  assert.match(mint, /exodusMinted !== null \? `\$\{TOTAL_EXODUS_SUPPLY - exodusMinted\} remaining` : '—'/);

  assert.match(leaderboard, /errorBytes/);
  assert.match(leaderboard, /if \(!res\.ok\)/);
  assert.match(leaderboard, /Reward history is temporarily unavailable/);
  assert.match(leaderboard, /grid grid-cols-2 border-b/);
  assert.match(leaderboard, /min-w-0 px-2 sm:px-8/);
  assert.match(leaderboard, /text-4xl sm:text-5xl/);
  assert.match(leaderboard, /w-full min-w-0 max-w-7xl/);
});

test('all reward readers import one canonical archive manifest matching public CSVs', async () => {
  const manifest = await read('../lib/phantom-reward-files.ts');
  const readers = await Promise.all([
    read('../app/components/KeyholderConsole.tsx'),
    read('../app/leaderboard/page.tsx'),
    read('../app/engine/EngineRoom.tsx'),
    read('../app/api/phantom-rewards/route.ts'),
  ]);
  const publicFiles = (await readdir(new URL('../public/airdrops/', import.meta.url)))
    .filter((name) => name.endsWith('.csv'))
    .sort();
  const manifestFiles = [...manifest.matchAll(/\/airdrops\/([^']+\.csv)'/g)]
    .map((match) => match[1])
    .sort();

  assert.deepEqual(manifestFiles, publicFiles);
  for (const reader of readers) assert.match(reader, /phantom-reward-files/);
});

test('legacy routes use the shared footer and descriptive route metadata', async () => {
  for (const route of legacyRoutes) {
    const page = await read(`../app/${route}/page.tsx`);
    assert.match(page, /import SiteFooter from ['"]\.\.\/components\/SiteFooter['"]/);
    assert.match(page, /<SiteFooter \/>/);
    assert.doesNotMatch(page, /<footer/);

  }

  const bytes = await read('../app/bytes/page.tsx');
  assert.match(bytes, /export const metadata: Metadata/);

  for (const route of ['leaderboard', 'raffle', 'mint-progress', 'trait-charts']) {
    const layout = await read(`../app/${route}/layout.tsx`);
    assert.match(layout, /export const metadata: Metadata/);
    assert.match(layout, /title:/);
    assert.match(layout, /description:/);
  }
});

test('raffle has one H1 and Trait Charts provide semantic point data', async () => {
  const [raffle, traits] = await Promise.all([
    read('../app/raffle/page.tsx'),
    read('../app/trait-charts/page.tsx'),
  ]);

  assert.match(raffle, /<h1[^>]*>Grid Phantoms Raffle Tracker<\/h1>/);
  assert.match(traits, /<table/);
  assert.match(traits, /<caption/);
  assert.match(traits, /Trait category/);
  assert.match(traits, /Point value/);
  assert.match(traits, /Open full-resolution \{season\} chart/);
  assert.match(traits, /<Chart season="Genesis"/);
  assert.match(traits, /<Chart season="Exodus"/);
});
