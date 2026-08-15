import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';

const routeUrl = new URL('../app/api/bytes-metrics/route.ts', import.meta.url);
const dashboardUrl = new URL('../app/bytes/BytesDashboard.tsx', import.meta.url);
const pageUrl = new URL('../app/bytes/page.tsx', import.meta.url);
const contractUrl = new URL('../docs/bytes-terminal-metric-contract.md', import.meta.url);

test('route source retains Avalanche, Uniswap factory, oracle, and reorg identity gates', async () => {
  const source = await readFile(routeUrl, 'utf8');
  for (const pattern of [
    /provider\.send\('eth_chainId', \[\]\).*Avalanche RPC chain verification/,
    /getStorage\(AVALANCHE_BYTES_TOKEN_CONTRACT, EIP1967_IMPLEMENTATION_SLOT/,
    /pool\.getToken/,
    /pool\.typeAndVersion/,
    /token\.hasRole\(minterRole, AVALANCHE_BYTES_CCIP_POOL/,
    /provider\.send\('eth_call'.*AVALANCHE_BURN_ZERO_CALL_DATA/s,
    /factory\.getPool\(BYTES_TOKEN_CONTRACT, WETH_CONTRACT, 10_000/,
    /getAddress\(factoryAddress\) !== UNISWAP_V3_FACTORY/,
    /round\.answeredInRound < round\.roundId/,
    /secondaryBlock\.hash !== block\.hash/,
    /Secondary Ethereum post-read source-block confirmation/,
    /postReadSecondaryBlock\.hash !== block\.hash/,
    /Avalanche source block changed/,
    /configuredS1S2Daily = configured\.value\.S1 \+ configured\.value\.S2/,
    /projectedIssuanceOverDays\(configuredS1S2Daily/,
  ]) assert.match(source, pattern);
  assert.ok(
    source.lastIndexOf('secondaryProvider.getBlock(block.number)') > source.indexOf('readMarketMetrics(secondaryProvider'),
    'secondary provider must reconfirm the attributed block after all token and market reads',
  );
});

test('BYTES page includes the universal Grid Phantoms footer', async () => {
  const page = await readFile(pageUrl, 'utf8');
  for (const expected of [
    'https://discord.gg/gridphantoms',
    'https://x.com/GridPhantoms',
    'https://opensea.io/collection/grid-phantoms-genesis-keys',
    'https://snapshot.box/#/s:gridphantoms.eth',
    'https://manifold.xyz/@gridphantoms/id/4067746032',
    '© 2026 Grid Phantoms Ltd. All rights reserved.',
  ]) assert.match(page, new RegExp(expected.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
});

test('dashboard and metric contract use corrected valuation labels', async () => {
  const [dashboard, contract] = await Promise.all([
    readFile(dashboardUrl, 'utf8'),
    readFile(contractUrl, 'utf8'),
  ]);
  for (const label of ['Market cap\\*', 'Ethereum chain-local total supply', 'Avalanche chain-local BYTES supply']) {
    assert.match(dashboard, new RegExp(label, 'i'));
  }
  assert.match(dashboard, /dextools\.io\/app\/en\/ether\/pair-explorer\/0xfeb09c7e130a4b87b27ebd648ec485657b688b34/i);
  assert.match(dashboard, /sourceBlock=\{avalancheSourceBlock\}/);
  assert.match(dashboard, /@0xSanSSerif/);
  assert.match(dashboard, /https:\/\/x\.com\/0xSanSSerif/);
  assert.match(dashboard, /database was compromised/i);
  assert.match(dashboard, /His original database was compromised/i);
  assert.match(dashboard, /Transparent by design/i);
  assert.match(dashboard, /In plain English/i);
  assert.match(dashboard, /https:\/\/coinmarketcap\.com\/currencies\/neo-tokyo\//);
  assert.match(dashboard, /35\.53%|stakingPercentage/);
  assert.match(dashboard, /pendingRewardsPercentage/);
  assert.match(dashboard, /Configured daily emissions/);
  assert.match(dashboard, /Modeled current daily rate/);
  assert.match(dashboard, /Configured vs\. modeled variance/);
  assert.match(dashboard, /positive variance means configured daily emissions are above/i);
  assert.match(dashboard, /week-zero daily allocation before decay/i);
  assert.match(dashboard, /potential emissions-driven sell pressure/i);
  assert.match(dashboard, /Emissions only become sell pressure when recipients sell/i);
  assert.match(dashboard, /label="Market Cap\*"[^>]*valuePrefix="\$"/);
  assert.match(dashboard, /label="BYTES spot price"[^>]*valuePrefix="\$"/);
  assert.doesNotMatch(dashboard, /<small>BYTES pool<\/small>|<small>LP pool<\/small>/i);
  assert.match(dashboard, /legacyEmissionTotal !== null && legacyEmissionTotal > 0/);
  assert.match(dashboard, /Additional configured legacy asset-type emissions/);
  assert.match(contract, /Market Cap\*/i);
});
