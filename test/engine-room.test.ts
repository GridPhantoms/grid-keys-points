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

test('Engine Room uses the terminal-family hero and five-section hierarchy', async () => {
  const ui = await read('../app/engine/EngineRoom.tsx');

  assert.match(ui, /className="engine-page"/);
  assert.match(ui, /className="engine-topline"/);
  assert.match(ui, /className="engine-hero"/);
  assert.match(ui, /GRID PHANTOMS OPERATIONAL INTELLIGENCE/);
  assert.match(ui, /<span>Engine<\/span><em>Room<\/em>/);
  assert.match(ui, /Track the vault\. Verify the rewards\. Read the rebellion\./);
  assert.match(ui, /VAULT SNAPSHOT/);
  assert.match(ui, /MIXED-SOURCE STATUS/);
  assert.doesNotMatch(ui, /Snapshot captured \{LAST_SNAPSHOT\}|FRESH|ONLINE|LIVE SNAPSHOT/);

  const sections = [
    '01 / VAULT SNAPSHOT',
    '02 / PHANTOM REWARD HISTORY',
    '03 / REWARD VALUE SIMULATOR',
    '04 / REBELLION VITALS',
    '05 / NFT HOLDINGS',
  ];
  sections.forEach((label) => assert.match(ui, new RegExp(label.replace('/', '\\/'))));
  sections.slice(1).forEach((label, index) => {
    assert.ok(ui.indexOf(sections[index]) < ui.indexOf(label));
  });
});

test('Engine Room renders a sanitized, extensible NFT portfolio as responsive linked tiles', async () => {
  const [ui, css, neoRoute, alchemy] = await Promise.all([
    read('../app/engine/EngineRoom.tsx'),
    read('../app/engine/engine.css'),
    read('../app/api/neo-vault-counts/route.ts'),
    read('../app/api/_lib/alchemy-server.ts'),
  ]);

  assert.match(ui, /type NftAsset = \{/);
  assert.match(ui, /assets: NftAsset\[\]/);
  assert.match(ui, /<h2 id="holdings-heading">NFTs held by Sakura&apos;s Vault<\/h2>/);
  assert.match(ui, /Various NFT assets held in Sakura&apos;s Vault\. Select any tile to inspect the asset on OpenSea\./);
  assert.match(ui, /className="engine-holdings-grid"/);
  assert.match(ui, /className="engine-holding-card"/);
  assert.match(ui, /alt=\{asset\.name\}/);
  assert.match(ui, /href=\{asset\.openseaUrl\}/);
  assert.doesNotMatch(ui, /<b>#\{asset\.tokenId\}<\/b>/);
  assert.match(ui, /NO NFT HOLDINGS FOUND/);
  assert.match(css, /\.engine-holdings-grid\{/);
  assert.match(css, /\.engine-holding-card\{/);
  assert.match(css, /\.engine-holding-art\{/);

  assert.match(neoRoute, /assets:/);
  assert.match(neoRoute, /s1: \{[^\n]+brand: 'NEO TOKYO S1'/);
  assert.match(neoRoute, /s2: \{[^\n]+brand: 'NEO TOKYO S2'/);
  assert.match(neoRoute, /items: \{[^\n]+brand: 'S1 ITEM CACHE'/);
  assert.match(neoRoute, /genesis: \{[^\n]+brand: 'GRID PHANTOMS'/);
  assert.match(neoRoute, /const COATTAIL_BROKERS = \{[^\n]+brand: 'COATTAIL BROKERS'/);
  assert.match(neoRoute, /COATTAIL_FALLBACK_TOKEN_IDS = \['1381', '1664'\]/);
  assert.match(neoRoute, /source: 'alchemy_eth_plus_blockscout_discovery_and_robinhood_rpc_verification'/);
  assert.match(neoRoute, /https:\/\/opensea\.io\/item\/robinhood\//);
  assert.match(neoRoute, /Genesis Key Card #\$\{tokenId\}/);
  assert.match(neoRoute, /const COLLECTION_ORDER = \{ s1: 0, s2: 1, items: 2, genesis: 3, coattail: 4 \}/);
  assert.match(neoRoute, /COLLECTION_ORDER\[a\.name\] - COLLECTION_ORDER\[b\.name\]/);
  assert.match(neoRoute, /const tokenId = cleanText\(nft\.tokenId\)/);
  assert.match(neoRoute, /collection: collection\.brand/);
  assert.match(neoRoute, /name: assetName\(name, tokenId, nft\.name\)/);
  assert.match(neoRoute, /\/api\/citizen-terminal\/image\?season=\$\{name\}&tokenId=/);
  assert.match(neoRoute, /: imageUrl\(nft\.image\)/);
  assert.match(neoRoute, /openseaUrl:/);
  assert.match(alchemy, /withMetadata/);
});

test('Engine Room preserves calculations and adopts responsive metric and simulator structure', async () => {
  const [ui, css, generator] = await Promise.all([
    read('../app/engine/EngineRoom.tsx'),
    read('../app/engine/engine.css'),
    read('../generate-vault-snapshot.js'),
  ]);

  assert.match(ui, /genesisCount \* \(snapshot\.grid_genesis_floor_usd \|\| 0\)/);
  assert.match(ui, /coattailCount \* \(snapshot\.coattail_brokers_floor_usd \|\| 0\)/);
  assert.match(ui, /const coattailWalletValue = snapshot\.coattail_broker_wallet_usd \|\| 0/);
  assert.match(ui, /const totalVaultValue = \(snapshot\.debank_portfolio_usd \|\| 0\) \+ nftValue \+ coattailWalletValue/);
  assert.match(ui, /Broker wallet tokenized stocks/);
  assert.match(generator, /grid_genesis_floor_usd: 'grid-phantoms-genesis-keys'/);
  assert.match(generator, /coattail_brokers_floor_usd: 'coattailbrokers'/);
  assert.match(generator, /const COATTAIL_BROKER_WALLET = '0x3ba0c547Ec6465ddB56A5A8144D6253756E67f7b'/);
  assert.match(generator, /https:\/\/api\.robinhood\.com\/rhj\/assets/);
  assert.match(generator, /https:\/\/api\.robinhood\.com\/rhj\/prices\//);
  assert.match(generator, /https:\/\/rpc\.mainnet\.chain\.robinhood\.com\//);
  assert.match(generator, /0xcA11bde05977b3631167028862bE2a173976CA11/);
  assert.match(generator, /encodeFunctionData\('aggregate3'/);
  assert.match(generator, /decodeFunctionResult\('aggregate3'/);
  assert.doesNotMatch(generator, /ROBINHOOD_BALANCE_BATCH_SIZE/);
  assert.match(generator, /balanceOf/);
  assert.match(generator, /currentMultiplier/);
  assert.match(generator, /\['grid_genesis_floor_usd', formatValue\(values\.grid_genesis_floor_usd, 2\)\]/);
  assert.match(generator, /\['coattail_brokers_floor_usd', formatValue\(values\.coattail_brokers_floor_usd, 2\)\]/);
  assert.match(generator, /\['coattail_broker_wallet_usd', formatValue\(values\.coattail_broker_wallet_usd, 2\)\]/);
  assert.match(generator, /\['coattail_broker_wallet_token_count', formatValue\(values\.coattail_broker_wallet_token_count, 0\)\]/);
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
    '0x831b49fea0931019c04575f82a292072c9da831dc9bcf48d78189f4c8cd71931',
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
  assert.match(ui, /VIEW \{EARLIER_REWARD_PROOFS\.length\} EARLIER PROOFS/);
  assert.match(ui, /TOTAL VOTES CAST/);
  assert.doesNotMatch(ui, /ELIGIBLE DISTRIBUTION ROWS/);
  assert.match(css, /\.engine-disclaimer\{[^}]*overflow-wrap:anywhere/);
  assert.match(css, /\.engine-proof-shelf\{/);
  assert.match(css, /\.engine-proof-archive\{/);
  assert.match(css, /\.engine-proof-archive>a:last-child:nth-child\(odd\)\{grid-column:1\/-1\}/);
});

test('Engine Room Phase 3 exposes a closed evidence and mixed-source status contract', async () => {
  const [ui, css, neoRoute, exodusRoute] = await Promise.all([
    read('../app/engine/EngineRoom.tsx'),
    read('../app/engine/engine.css'),
    read('../app/api/neo-vault-counts/route.ts'),
    read('../app/api/exodus-minted/route.ts'),
  ]);

  assert.match(ui, /type SourceStatus = 'loading' \| 'available' \| 'stale' \| 'unavailable'/);
  assert.match(ui, /type EvidenceClass = 'Observed' \| 'Calculated' \| 'Estimated' \| 'Projected'/);
  assert.match(ui, /const SOURCE_CLASS_COUNT = 5/);
  assert.match(ui, /MIXED-SOURCE STATUS/);
  assert.match(ui, /SOURCE CLASSES LOADED/);
  assert.match(ui, /PAGE-LOAD SNAPSHOT/);
  assert.match(ui, /Reload to request updated source reads\./);
  assert.match(ui, /VAULT REFERENCES/);
  assert.match(ui, /NFT HOLDINGS/);
  assert.match(ui, /KEY SUPPLY/);
  assert.match(ui, /HOLDER SNAPSHOT/);
  assert.match(ui, /REWARD ARCHIVE/);
  assert.match(ui, /vault-snapshot\.meta\.json/);
  assert.match(ui, /holders-snapshot\.meta\.json/);
  assert.match(ui, /2026-08-03T02:10:34Z/);
  assert.doesNotMatch(ui, /const LAST_SNAPSHOT/);

  for (const evidenceClass of ['Observed', 'Calculated', 'Estimated', 'Projected']) {
    assert.match(ui, new RegExp(`classification="${evidenceClass}"`));
  }

  assert.match(css, /\.engine-source-ledger\{/);
  assert.match(css, /\.engine-source-card\.is-stale\{/);
  assert.match(css, /\.engine-source-card\.is-unavailable\{/);
  assert.match(css, /\.engine-status-dot\.is-partial\{/);
  assert.match(css, /\.engine-metric-state\{/);
  assert.match(css, /\.engine-evidence\{/);
  assert.match(css, /\.engine-evidence-projected\{/);

  assert.match(neoRoute, /source: 'alchemy_eth_plus_blockscout_discovery_and_robinhood_rpc_verification'/);
  assert.match(neoRoute, /readAt: new Date\(\)\.toISOString\(\)/);
  assert.match(exodusRoute, /source: 'alchemy_getAssetTransfers_zero_address_mints'/);
  assert.match(exodusRoute, /readAt: new Date\(\)\.toISOString\(\)/);
});

test('Engine Room Phase 3 validates each source independently and fails metrics closed', async () => {
  const ui = await read('../app/engine/EngineRoom.tsx');

  assert.match(ui, /Promise\.all\(\[/);
  assert.match(ui, /const SOURCE_TIMEOUT_MS = 12_000/);
  assert.match(ui, /new AbortController\(\)/);
  assert.match(ui, /controller\.abort\(\)/);
  assert.match(ui, /loadSource\('vault'/);
  assert.match(ui, /loadSource\('nft'/);
  assert.match(ui, /loadSource\('supply'/);
  assert.match(ui, /loadSource\('holders'/);
  assert.match(ui, /loadSource\('rewards'/);
  assert.match(ui, /if \(!response\.ok\) throw new Error/);
  assert.match(ui, /LOADING…/);
  assert.match(ui, /STALE/);
  assert.match(ui, /UNAVAILABLE/);
  assert.match(ui, /combineSourceStatuses/);
  assert.match(ui, /staleAfterMs/);
  assert.match(ui, /isSourceUsable/);
  assert.doesNotMatch(ui, /return \{ s1: 0, s2: 0, items: 0, genesis: 0 \}/);
  assert.doesNotMatch(ui, /Snapshot captured \{LAST_SNAPSHOT\}/);
});

test('Engine Room delayed-review follow-up keeps provenance and wording literal', async () => {
  const [ui, neoRoute, exodusRoute, alchemy, holderGenerator, vaultGenerator, leaderboard, vaultMetaText, holderMetaText] = await Promise.all([
    read('../app/engine/EngineRoom.tsx'),
    read('../app/api/neo-vault-counts/route.ts'),
    read('../app/api/exodus-minted/route.ts'),
    read('../app/api/_lib/alchemy-server.ts'),
    read('../generate-holders-snapshot.js'),
    read('../generate-vault-snapshot.js'),
    read('../app/leaderboard/page.tsx'),
    read('../public/vault-snapshot.meta.json'),
    read('../public/holders-snapshot.meta.json'),
  ]);

  const vaultMetadata = JSON.parse(vaultMetaText);
  assert.deepEqual(Object.keys(vaultMetadata), ['capturedAt']);
  assert.match(vaultMetadata.capturedAt, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/);
  const holderMetadata = JSON.parse(holderMetaText);
  assert.deepEqual(Object.keys(holderMetadata), ['capturedAt']);
  assert.match(holderMetadata.capturedAt, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/);
  assert.match(ui, /fetchJson\('\/vault-snapshot\.meta\.json'\)/);
  assert.match(ui, /fetchJson\('\/holders-snapshot\.meta\.json'\)/);
  assert.doesNotMatch(ui, /const VAULT_SNAPSHOT_AT|const HOLDER_SNAPSHOT_AT/);

  assert.match(ui, /AVAILABLE ·/);
  assert.match(ui, /PARTIAL ·/);
  assert.match(ui, /UNAVAILABLE ·/);
  assert.match(ui, /timeKind="CAPTURED"/);
  assert.match(ui, /timeKind="CHECKED"/);
  assert.match(ui, /timeKind="OCCURRED"/);
  assert.match(ui, /ESTIMATED USD VALUE/);
  assert.match(ui, /Snapshot BYTES price:/);
  assert.match(ui, /LIBERATED SLAVES/);
  assert.match(ui, /AVG\. VOTER PARTICIPATION/);
  assert.match(ui, /VS CURRENT HOLDERS/);

  assert.equal((ui.match(/occurredAt: '202[5-6]-/g) || []).length, 11);
  assert.match(ui, /<time dateTime=\{proof\.occurredAt\}>/);

  assert.match(neoRoute, /readAt: new Date\(\)\.toISOString\(\)/);
  assert.match(exodusRoute, /readAt: new Date\(\)\.toISOString\(\)/);
  assert.doesNotMatch(neoRoute, /updatedAt:/);
  assert.doesNotMatch(exodusRoute, /updatedAt:/);
  assert.match(ui, /data\.readAt/);

  assert.match(alchemy, /pageKey\?: unknown/);
  assert.match(alchemy, /url\.searchParams\.set\('pageKey', pageKey\)/);
  assert.match(alchemy, /if \(!Array\.isArray\(data\.ownedNfts\)\) throw new AlchemyServerError\(\)/);
  assert.match(holderGenerator, /holders-snapshot\.meta\.json/);
  assert.match(holderGenerator, /capturedAt: new Date\(\)\.toISOString\(\)/);
  assert.match(vaultGenerator, /vault-snapshot\.meta\.json/);
  assert.match(vaultGenerator, /updateVaultSnapshotMetadata\(snapshotTime\)/);
  assert.doesNotMatch(vaultGenerator, /LAST_SNAPSHOT|app\/engine\/page\.tsx/);
  assert.match(leaderboard, /holders-snapshot\.meta\.json/);
});

test('Engine Room mobile copy stays compact and source details are optional', async () => {
  const ui = await read('../app/engine/EngineRoom.tsx');

  assert.match(ui, /<details className="engine-source-details">/);
  assert.match(ui, /VIEW SOURCE &amp; EVIDENCE DETAILS/);
  assert.match(ui, /<span>VALUE PER KEY<\/span><EvidenceBadge classification="Estimated"/);
  assert.match(ui, /<span>REWARDS DISTRIBUTED<\/span><EvidenceBadge classification="Calculated"/);
  assert.match(ui, /<span>ESTIMATED USD VALUE<\/span><EvidenceBadge classification="Estimated"/);
  assert.match(ui, /TOTAL BYTES × SNAPSHOT PRICE/);
  assert.match(ui, /<span>REWARDS PER KEY<\/span><EvidenceBadge classification="Calculated"/);
  assert.match(ui, /<span>VALUE PER KEY<\/span><EvidenceBadge classification="Projected"/);
  assert.match(ui, /<span>TOTAL VOTES CAST<\/span>/);
  assert.match(ui, /<span>AVG\. VOTER PARTICIPATION<\/span>/);

  assert.doesNotMatch(ui, /VAULT VALUE PER KEY/);
  assert.doesNotMatch(ui, /COMPLETED PHANTOM REWARDS/);
  assert.doesNotMatch(ui, /CAPTURED REFERENCE VALUE/);
  assert.doesNotMatch(ui, /HYPOTHETICAL VALUE PER KEY/);
  assert.doesNotMatch(ui, /COMPLETED REWARDS PER KEY/);
  assert.doesNotMatch(ui, /TOTAL REWARD ENTRIES/);
  assert.doesNotMatch(ui, /AVG\. REWARD-RECIPIENT RATE/);
});

test('Engine Room evidence pills stand apart from titles and preserve rebellion lore', async () => {
  const [ui, css] = await Promise.all([
    read('../app/engine/EngineRoom.tsx'),
    read('../app/engine/engine.css'),
  ]);

  assert.match(ui, /<article><span>LIBERATED SLAVES<\/span><EvidenceBadge classification="Observed"/);
  assert.match(ui, /<small>UNIQUE WALLETS<\/small>/);
  assert.doesNotMatch(ui, /SNAPSHOT KEY HOLDERS/);
  assert.match(css, /\.engine-metric-topline\{[^}]*display:flex[^}]*flex-direction:column[^}]*align-items:flex-start[^}]*gap:10px/);
  assert.match(css, /\.engine-metric-topline \.engine-evidence\{margin:0\}/);
  assert.doesNotMatch(css, /\.engine-metric-topline\{display:block/);
  assert.match(css, /\.engine-output-heading\{[^}]*margin-bottom:14px/);
  assert.match(css, /\.engine-output-total\{align-items:flex-start;flex-direction:column;gap:14px\}/);
  assert.match(ui, /DeBank portfolio, NFT floor values, Broker wallet tokenized stocks and the veBLACK position\./);
  assert.doesNotMatch(ui, /Neo Tokyo asset references/);
});

test('Engine Room keeps long disclaimer copy inside its panel', async () => {
  const css = await read('../app/engine/engine.css');

  assert.match(css, /\.engine-disclaimer\{[^}]*overflow-wrap:anywhere/);
  assert.doesNotMatch(css, /@media\(min-width:1100px\)\{\.engine-disclaimer\{[^}]*white-space:nowrap/);
});

test('Vault NFT route discovers current Coattail holdings instead of relying on one token id', async () => {
  const route = await read('../app/api/neo-vault-counts/route.ts');

  assert.match(route, /robinhoodchain\.blockscout\.com\/api\/v2\/addresses/);
  assert.match(route, /getOwnedCoattailTokenIds/);
  assert.match(route, /address_hash/);
  assert.doesNotMatch(route, /tokenIds: \['1381'\]/);
});
