import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const read = (relativePath: string) => readFile(new URL(relativePath, import.meta.url), 'utf8');

test('Engine Room route provides metadata and shared terminal chrome', async () => {
  const page = await read('../app/engine/page.tsx');

  assert.match(page, /title: 'Engine Room \| Grid Phantoms'/);
  assert.match(page, /description: 'Vault intelligence, completed Phantom Reward history, scenario modeling, and Grid Phantoms participation metrics\.'/);
  assert.match(page, /<SiteNav active="engine" \/>/);
  assert.match(page, /<EngineRoom \/>/);
  assert.match(page, /<SiteFooter \/>/);
  assert.match(page, /import '\.\/engine\.css'/);
  assert.doesNotMatch(page, /'use client'/);
});

test('Engine Room uses the terminal-family hero and four-section hierarchy', async () => {
  const ui = await read('../app/engine/EngineRoom.tsx');

  assert.match(ui, /className="engine-page"/);
  assert.match(ui, /className="engine-topline"/);
  assert.match(ui, /className="engine-hero"/);
  assert.match(ui, /GRID PHANTOMS OPERATIONAL INTELLIGENCE/);
  assert.match(ui, /<span>Engine<\/span><em>Room<\/em>/);
  assert.match(ui, /Track the vault\. Verify the rewards\. Read the rebellion\./);
  assert.match(ui, /VAULT SNAPSHOT/);
  assert.match(ui, /Snapshot captured \{LAST_SNAPSHOT\}/);
  assert.doesNotMatch(ui, /FRESH|ONLINE|LIVE SNAPSHOT/);

  const sections = [
    '01 / VAULT SNAPSHOT',
    '02 / PHANTOM REWARD HISTORY',
    '03 / REWARD VALUE SIMULATOR',
    '04 / REBELLION VITALS',
  ];
  sections.forEach((label) => assert.match(ui, new RegExp(label.replace('/', '\\/'))));
  sections.slice(1).forEach((label, index) => {
    assert.ok(ui.indexOf(sections[index]) < ui.indexOf(label));
  });
});

test('Engine Room preserves calculations and adopts responsive metric and simulator structure', async () => {
  const [ui, css] = await Promise.all([
    read('../app/engine/EngineRoom.tsx'),
    read('../app/engine/engine.css'),
  ]);

  assert.match(ui, /const totalVaultValue = \(snapshot\.debank_portfolio_usd \|\| 0\) \+ neoValue/);
  assert.match(ui, /const vaultValuePerKey = TOTAL_KEYS > 0 \? totalVaultValue \/ TOTAL_KEYS : 0/);
  assert.match(ui, /const hypotheticalTotalValue = hypotheticalValuePerKey \* safeRewardKeyCount/);
  assert.match(ui, /aria-pressed=\{rewardKeyType === keyType\}/);
  assert.match(ui, /id="hypothetical-bytes-price"/);
  assert.match(ui, /id="reward-key-count"/);
  assert.match(ui, /className="engine-vault-grid"/);
  assert.match(ui, /className="engine-reward-grid"/);
  assert.match(ui, /className="engine-vitals-grid"/);
  assert.match(ui, /className="engine-simulator-grid"/);
  assert.doesNotMatch(ui, /<SiteNav|<SiteFooter/);

  assert.match(css, /\.engine-main\{[^}]*width:min\(1180px,calc\(100% - 32px\)\)/);
  assert.match(css, /\.engine-hero\{[^}]*grid-template-columns/);
  assert.match(css, /\.engine-panel\{/);
  assert.match(css, /\.engine-vault-grid\{/);
  assert.match(css, /\.engine-vitals-grid\{/);
  assert.match(css, /\.engine-disclaimer\{[^}]*font-size:10px[^}]*line-height:1\.65/);
  assert.match(css, /@media\(min-width:900px\)\{\.engine-disclaimer\{font-size:11px\}/);
  assert.match(css, /@media\(max-width:700px\)/);
  assert.match(css, /@media\(prefers-reduced-motion:reduce\)/);
});
