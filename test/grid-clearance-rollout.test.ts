import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import { GRID_CLEARANCE_LEVELS, getGridClearance } from '../lib/grid-clearance.ts';

const read = (relativePath: string) => readFile(new URL(relativePath, import.meta.url), 'utf8');

test('Grid Clearance applies the approved active thresholds and Hazard Support schedule', () => {
  assert.deepEqual(
    GRID_CLEARANCE_LEVELS.map(({ level, minimumPoints, hazardSupport }) => [level, minimumPoints, hazardSupport]),
    [[0, 0, 0], [1, 5_000, 3], [2, 10_000, 6], [3, 25_000, 10], [4, 100_000, 15]],
  );

  assert.equal(getGridClearance(4_999).level, 0);
  assert.equal(getGridClearance(5_000).level, 1);
  assert.equal(getGridClearance(9_999).level, 1);
  assert.equal(getGridClearance(10_000).level, 2);
  assert.equal(getGridClearance(24_999).level, 2);
  assert.equal(getGridClearance(25_000).level, 3);
  assert.equal(getGridClearance(99_999).level, 3);
  assert.equal(getGridClearance(100_000).level, 4);
});

test('Load Keys exposes current Clearance, progress, and properly qualified Hazard Support language', async () => {
  const source = await read('../app/components/KeyholderConsole.tsx');

  assert.match(source, /getGridClearance/);
  assert.match(source, /GRID CLEARANCE/);
  assert.match(source, /CURRENT HAZARD SUPPORT SCHEDULE/);
  assert.match(source, /POINTS TO LEVEL/);
  assert.match(source, /LEVEL 5 \/\/ CLASSIFIED/);
  assert.match(source, /Points determine Clearance\. Participation activates it\./);
  assert.match(source, /discretionary potential Phantom Reward distribution/);
  assert.match(source, /href="\/trait-charts"/);
});

test('Trait Intelligence Archive publishes the approved mechanics, categories, schedule, and classified teaser', async () => {
  const [page, layout, nav] = await Promise.all([
    read('../app/trait-charts/page.tsx'),
    read('../app/trait-charts/layout.tsx'),
    read('../app/components/SiteNav.tsx'),
  ]);

  assert.match(page, /Trait Intelligence Archive/);
  assert.match(page, /Points determine Clearance\. Participation activates it\./);
  assert.match(page, /Current Hazard Support Schedule/);
  assert.match(page, /1,000–4,999/);
  assert.match(page, /effective until superseded for a future Grid Cycle/i);
  assert.match(page, /LEVEL 5 \/\/ CLASSIFIED/);
  assert.match(page, /Grid Dominion/);
  assert.match(page, /Cloaking Power/);
  assert.match(page, /Code Stratagem/);
  assert.match(page, /Veil Assault/);
  assert.match(page, /Pulse Fortitude/);
  assert.match(page, /Aerial Domain/);
  assert.match(page, /Grid Speed/);
  assert.match(page, /Exodus Sovereignty/);
  assert.match(page, /Veiled Power/);
  assert.match(page, /Phantom Weapon/);
  assert.match(page, /href="\/#keyholder-console"/);
  assert.match(layout, /Trait Intelligence Archive \| Grid Phantoms/);
  assert.match(nav, /label: 'Trait Intelligence'/);
});

test('Engine Room publishes the verified August vote and distribution without converting Hazard Support into per-Key history', async () => {
  const [engine, manifest] = await Promise.all([
    read('../app/engine/EngineRoom.tsx'),
    read('../lib/phantom-reward-files.ts'),
  ]);

  assert.match(manifest, /\/airdrops\/2026-08Airdrop\.csv/);
  assert.match(manifest, /2026-09-06T22:56:53Z/);
  assert.match(engine, /cycle: 'August 2026', genesis: 1\.5, exodus: 1\.25/);
  assert.match(engine, /0x831b49fea0931019c04575f82a292072c9da831dc9bcf48d78189f4c8cd71931/);
  assert.match(engine, /Full-Spectrum Vault/);
  assert.match(engine, /286 GP/);
  assert.match(engine, /36 PARTICIPATING WALLETS/);
  assert.match(engine, /754 GP/);
  assert.match(engine, /baseBytes: '1,019\.25'/);
  assert.match(engine, /hazardBytes: '217'/);
  assert.match(engine, /totalBytes: '1,236\.25'/);
  assert.match(engine, /FIRST HAZARD SUPPORT/);
  assert.match(engine, /30 WALLETS RECEIVED POSITIVE SUPPORT/);
  assert.match(engine, /ACROSS 11 CYCLES/);
  assert.match(engine, /Hazard Support is wallet-level and is not included in the per-Key simulator/);
});
