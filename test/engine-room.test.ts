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
  assert.match(ui, /matchMedia\('\(prefers-reduced-motion: reduce\)'\)\.matches/);
  assert.match(css, /@media\(prefers-reduced-motion:reduce\)/);
  assert.match(css, /\.engine-snapshot-stamp small\{[^}]*color:#7a8b91/);
  assert.match(css, /\.engine-source-note\{[^}]*color:#849197/);
  assert.match(css, /\.engine-vitals-grid small\{[^}]*color:#7c8a90/);
});

test('Engine Room exposes verified reward proofs and keeps supporting copy responsive', async () => {
  const [ui, css] = await Promise.all([
    read('../app/engine/EngineRoom.tsx'),
    read('../app/engine/engine.css'),
  ]);

  const proofHashes = [
    '0x65674cb20d3980ef4bf9e93eeeb0560a746030dc6aa1a48390c4cc6d4bf66efd',
    '0x1a00539906d2e1c7508a1c1aef64b0a7e66a2b55d15cc6f3361b74b8da36202d',
    '0xb6ed9da83476ef32e88d689ddc10e49380f8b699a874e97c88996da7c713e3c7',
    '0x7b95b4deb03f983eba105efdcb08cec4e58fb1189bfbbf02dbb633d16aee4573',
    '0x908d318eca4005fb12d3cf91140322c5370a256cc58fe5bb66f7561edf5602c7',
    '0x2e45a309833dabe4163941e1530ea3fa18a8eb8a8eb616914bbced25ae9e8d94',
    '0x760a3b5e043bff9551994ec06da51ff1a19ee6318824c30fbe20a0e8ee819411',
    '0xd870fe7d53f3c4eff2070a33e32615e876044347ae2d0eae02506446f618f5d8',
    '0xa21fece7a8c8515e759e491303c2a544f30b9e0e57807febac072c07229b2d38',
    '0x87264ae2abd230923efe3cc53236f5669040529c6a74c62b4672af0131871d21',
  ];

  proofHashes.forEach((hash) => assert.match(ui, new RegExp(hash)));
  assert.match(ui, /<details className="engine-proof-shelf">/);
  assert.match(ui, /VIEW 9 EARLIER PROOFS/);
  assert.match(ui, /REWARD ENTRIES/);
  assert.doesNotMatch(ui, /ELIGIBLE DISTRIBUTION ROWS/);
  assert.match(css, /@media\(min-width:1100px\)\{\.engine-disclaimer\{[^}]*max-width:none[^}]*white-space:nowrap/);
  assert.match(css, /\.engine-proof-shelf\{/);
  assert.match(css, /\.engine-proof-archive\{/);
  assert.match(css, /\.engine-proof-archive>a:last-child:nth-child\(odd\)\{grid-column:1\/-1\}/);
});
