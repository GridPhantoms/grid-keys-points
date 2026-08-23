import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';

const routeUrl = new URL('../app/api/bytes-metrics/route.ts', import.meta.url);
const dashboardUrl = new URL('../app/bytes/BytesDashboard.tsx', import.meta.url);
const dashboardCssUrl = new URL('../app/bytes/bytes.css', import.meta.url);
const pageUrl = new URL('../app/bytes/page.tsx', import.meta.url);
const contractUrl = new URL('../docs/bytes-terminal-metric-contract.md', import.meta.url);
const participantGeneratorUrl = new URL('../scripts/generate-bytes-staking-participants.mjs', import.meta.url);
const holderGeneratorUrl = new URL('../scripts/generate-bytes-holder-snapshot.mjs', import.meta.url);

test('route source retains Avalanche, Uniswap factory, oracle, and reorg identity gates', async () => {
  const source = await readFile(routeUrl, 'utf8');
  for (const pattern of [
    /provider\.send\('eth_chainId', \[\]\).*Avalanche RPC chain verification/,
    /AVALANCHE_RPC_URLS = \[[\s\S]*api\.avax\.network[\s\S]*avalanche-c-chain-rpc\.publicnode\.com/,
    /for \(const rpcUrl of AVALANCHE_RPC_URLS\)/,
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
    /unstable_cache/,
    /\['bytes-lightweight-snapshot-v3', BYTES_PARTICIPANT_SNAPSHOT_DIGEST, holderSnapshot\.crossChain\.addressesSha256\]/,
    /revalidate: LIGHTWEIGHT_SNAPSHOT_SECONDS/,
    /\['bytes-pending-rewards-v1', BYTES_PARTICIPANT_SNAPSHOT_DIGEST\]/,
    /revalidate: PENDING_SNAPSHOT_SECONDS/,
    /readCachedPendingRewardsSnapshot\(\)/,
    /pendingRewardsSnapshot: pendingRewardsSource/,
  ]) assert.match(source, pattern);
  assert.ok(
    source.lastIndexOf('secondaryProvider.getBlock(block.number)') > source.indexOf('readMarketMetrics(secondaryProvider'),
    'secondary provider must reconfirm the attributed block after all token and market reads',
  );
  const getIndex = source.indexOf('export async function GET(request: Request)');
  const pendingCacheCallIndex = source.indexOf('readCachedPendingRewardsSnapshot()', getIndex);
  assert.ok(getIndex > 0 && pendingCacheCallIndex > getIndex, 'pending cache must be read at the top-level request boundary');
  assert.equal(
    source.slice(0, getIndex).includes('readCachedPendingRewardsSnapshot()'),
    false,
    'pending cache must never be called from inside the lightweight cache callback',
  );
  assert.match(source.slice(getIndex), /Promise\.allSettled\(\[\s*readCachedBytesMetricsPayload\(\),\s*readCachedPendingRewardsSnapshot\(\)/);
});

test('participant refresh indexes through the selected finalized source block', async () => {
  const source = await readFile(participantGeneratorUrl, 'utf8');
  assert.match(source, /getBlock\(refresh \? 'finalized' : BYTES_PARTICIPANT_SNAPSHOT_BLOCK\)/);
  const collectorCall = source.match(
    /collectParticipantEvidence\(\s*provider,\s*BYTES_STAKING_DEPLOYMENT_BLOCK,\s*([^,]+),\s*\)/,
  );
  assert.equal(collectorCall?.[1].trim(), 'sourceBlock.number');
});

test('holder refresh validates chain-local ledgers before calculating the cross-chain union', async () => {
  const source = await readFile(holderGeneratorUrl, 'utf8');
  for (const pattern of [
    /collectEthereumHolders\(ethereum, ethereumBlock\.number\)/,
    /collectAvalancheHolders\(\)/,
    /assertNoAvalancheTransferGap/,
    /assertSupplyParity\('Ethereum'/,
    /assertSupplyParity\('Avalanche'/,
    /const union = new Set/,
    /wallet lists are not published/,
  ]) assert.match(source, pattern);
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

test('dashboard and metric contract use corrected valuation and reference-model language', async () => {
  const [dashboard, dashboardCss, contract] = await Promise.all([
    readFile(dashboardUrl, 'utf8'),
    readFile(dashboardCssUrl, 'utf8'),
    readFile(contractUrl, 'utf8'),
  ]);
  for (const label of ['Market cap\\*', 'Ethereum chain-local total supply', 'Avalanche chain-local BYTES supply']) {
    assert.match(dashboard, new RegExp(label, 'i'));
  }
  assert.match(dashboard, /dextools\.io\/app\/en\/ether\/pair-explorer\/0xfeb09c7e130a4b87b27ebd648ec485657b688b34/i);
  assert.match(dashboard, /sourceBlock=\{avalancheSourceBlock\}/);
  assert.match(dashboard, /@0xSanSSerif/);
  assert.match(dashboard, /https:\/\/x\.com\/0xSanSSerif/);
  assert.match(dashboard, /OG Citizen/);
  assert.match(dashboard, /paving the way for the concept of this terminal/i);
  assert.match(dashboard, /database was compromised/i);
  assert.match(dashboard, /His original database was compromised/i);
  assert.match(dashboard, /Transparent by design/i);
  assert.match(dashboard, /In plain English/i);
  assert.match(dashboard, /https:\/\/coinmarketcap\.com\/currencies\/neo-tokyo\//);
  assert.match(dashboard, /35\.53%|stakingPercentage/);
  assert.doesNotMatch(dashboard, /pendingRewardsPercentage|relative to current Ethereum total supply/);
  for (const pattern of [
    /first-party view of \$BYTES emissions/i,
    /Ethereum holders/,
    /Avalanche holders/,
    /Cross-chain unique holders/,
    /S1 Citizens staked/,
    /S2 Outer Citizens staked/,
  ]) assert.match(dashboard, pattern);
  assert.doesNotMatch(dashboard, /Citizen Yield Pool mechanics/);
  assert.match(dashboard, /function EmissionsSummaryCard/);
  assert.match(dashboard, /function ProjectedIssuanceCard/);
  assert.match(dashboard, /function GenesisEpochCard/);
  assert.match(dashboard, /function StakedBytesCard/);
  assert.match(dashboard, /function HolderSummaryCard/);
  assert.match(dashboard, /Current daily emissions/i);
  assert.match(dashboard, /Modeled reference rate/i);
  assert.match(dashboard, /Configured vs\. modeled/i);
  assert.match(dashboard, /Configured emissions currently match the modeled rate from \{roundedOffsetWeeks\} weeks ago/);
  assert.match(dashboard, /week \{alignedReferenceWeek\} vs\. week \{modelWeek\} today/);
  assert.match(dashboard, /A manual administrator adjustment is expected\./);
  assert.match(dashboard, /of the steady scenario.{0,80}total remaining issuance is projected to be emitted within the next 365 days/i);
  assert.doesNotMatch(dashboard, /className="bytes-lede"/);
  assert.match(dashboard, /<strong>The Premise\.<\/strong> A first-party view of \$BYTES emissions, decay, supply, staking, holders, and valuation, separated by evidence class and backed by visible provenance\./);
  assert.match(dashboard, /<strong>Staying Power\.<\/strong> Born in 2021\. Still held across 8,808 wallets, with 35\.5% staked and a market cap well above \$1 million\. \$BYTES is the ticker\./);
  const premiseIndex = dashboard.indexOf('<div className="bytes-notice"><strong>The Premise.</strong>');
  const stayingPowerIndex = dashboard.indexOf('<div className="bytes-notice"><strong>Staying Power.</strong>');
  const observedFirstIndex = dashboard.indexOf('<div className="bytes-notice"><strong>Observed First.</strong>');
  const headlineStatsIndex = dashboard.indexOf('<section className="bytes-stats bytes-headline-stats"');
  assert.ok(premiseIndex >= 0 && stayingPowerIndex > premiseIndex && observedFirstIndex > stayingPowerIndex && headlineStatsIndex > observedFirstIndex);
  assert.match(dashboard, /<strong>Community Groundwork\.<\/strong>/);
  const primaryIndex = dashboard.indexOf('<div className="bytes-primary">');
  const communityIndex = dashboard.indexOf('<div className="bytes-notice bytes-community-credit"><strong>Community Groundwork.</strong>');
  const emissionsChartIndex = dashboard.indexOf('<section className="bytes-panel bytes-chart-panel"');
  assert.ok(primaryIndex >= 0 && communityIndex > primaryIndex && emissionsChartIndex > communityIndex);
  assert.match(dashboard, /Since BYTES 2\.0 Genesis epoch/i);
  assert.match(dashboard, /Ethereum BYTES 2\.0.{0,40}canonical/i);
  assert.match(dashboard, /Matching addresses across both chains are counted once/i);
  assert.doesNotMatch(dashboard, /Modeled S1 Citizen Yield Pool|Modeled S2 Outer Citizen Yield Pool/);
  assert.match(dashboard, /positive variance means configured daily emissions are above/i);
  assert.match(dashboard, /Remaining Issuance Scenarios/);
  assert.match(dashboard, /title="Steady Scenario"/);
  assert.match(dashboard, /title="Max Staking Scenario"/);
  for (const heading of ['In Plain English', 'Supply &amp; Valuation', 'Staking Status', 'Methodology Ledger']) {
    assert.match(dashboard, new RegExp(heading));
  }
  assert.match(dashboard, /If staking participation stays around the steady level represented by this model/i);
  assert.match(dashboard, /If Community Staking Incentives were at maximum participation from here forward/i);
  assert.doesNotMatch(dashboard, /historical reference scenario begins|historical all-pool model ceiling/i);
  assert.match(dashboard, /contract does not execute automatically/i);
  assert.match(dashboard, /Nearly five years after its 2021 origin, BYTES remains embedded in the Neo Tokyo economy/i);
  assert.match(dashboard, /crossChainUniqueHolderCount/);
  assert.match(dashboard, /more than two-thirds of S1 Citizens and nearly half of S2 Outer Citizens are staked/i);
  assert.match(dashboard, /Distribution is another strength/);
  assert.match(dashboard, /100% allocated to the community/);
  assert.match(dashboard, /no team allocation or VC unlocks/);
  assert.match(dashboard, /original token was claimable only by full Citizens with Vault Cards/);
  assert.match(dashboard, /today&apos;s configured BYTES 2\.0 issuance flows through/);
  assert.match(dashboard, /community-held by design/);
  assert.match(dashboard, /supply entered through participation rather than an insider treasury or vesting schedule/);
  assert.match(dashboard, /2021 origin was unusually fair and broadly distributed, and the model remains difficult to match/);
  for (const postId of ['1916838058432848248', '1915466651421626829', '1451646106522243076', '1915466654546329649']) {
    assert.match(dashboard, new RegExp(`https://x\\.com/NeoTokyoCode/status/${postId}`));
  }
  assert.match(dashboard, /Those settings align with the reference model from/i);
  assert.match(dashboard, /projectedIssuanceShare/);
  assert.match(dashboard, /Those rewards are accrued but unclaimed and do not enter the current token supply unless they are claimed and minted/i);
  assert.match(dashboard, /<strong>so the current stream creates less new inventory for the market to absorb\.<\/strong>/i);
  assert.match(dashboard, /CoinMarketCap&apos;s ranked market snapshot places the <strong>\$1 million market-cap line around rank 1,917<\/strong>/i);
  assert.match(dashboard, /seven figures clears much of crypto&apos;s ranked long tail/i);
  assert.match(dashboard, /first-party onchain market cap still sits around/i);
  assert.match(dashboard, /showed \$1\.00 million through rank 1,917 and \$993,544\.79 at rank 1,918 when checked on August 23, 2026/i);
  assert.match(dashboard, /much larger tracked-token count includes assets without ranked market caps, so it is not used as the denominator/i);
  assert.doesNotMatch(dashboard, /CoinGecko|roughly one in seven/i);
  assert.match(dashboard, /It is still here, still staked, and still economically meaningful/i);
  for (const title of ['Valuation basis.', 'Market benchmark.', 'Issuance projection.', 'Staked and pending BYTES.', 'Holder counting.', 'Citizen staking denominators.', 'Not financial advice.']) {
    assert.match(dashboard, new RegExp(`<strong>${title.replace(/[.*+?^${}()|[\\]\\\\]/g, '\\\\$&')}<\\/strong>`));
  }
  assert.match(dashboard, /informational and educational purposes only/);
  assert.match(dashboard, /not financial, investment, legal, or tax advice/);
  assert.match(dashboard, /recommendation to buy, sell, hold, or stake any asset/);
  assert.match(dashboard, /Terminal&apos;s first-party onchain market cap, calculated from verified canonical supply/i);
  assert.doesNotMatch(dashboard, /not a conventional circulating market capitalization/i);
  assert.match(dashboard, /uses the remainder of the current decay week, and then applies weekly decay/i);
  assert.match(dashboard, /the separate DAO-tax aggregate is available in the metric details/i);
  assert.match(dashboard, /merges matching Ethereum and Avalanche addresses so each address is counted once/i);
  assert.match(dashboard, /divide live staked counts from the canonical V2 contracts by original collection supplies/i);
  assert.match(dashboard, /not an official BYTES rank or percentile/i);
  assert.doesNotMatch(dashboard, /PM Firestorm|community workbook|official Neo Tokyo reference graphics|current daily emissions × 365/i);
  assert.match(dashboardCss, /\.bytes-footnotes ol \{[^}]*list-style: decimal/);
  assert.match(dashboardCss, /\.bytes-footnotes li::marker \{[^}]*font-weight: 700/);
  for (const title of ['Live Participation', 'Community Distribution', 'Issuance Outlook', 'Pressure Profile', 'Market Context']) {
    assert.match(dashboard, new RegExp(`<h3>${title}<\\/h3>`));
  }
  assert.match(dashboardCss, /\.bytes-human-section \{[^}]*container-type: inline-size/);
  assert.match(dashboardCss, /@container \(min-width: 40rem\)/);
  assert.match(dashboardCss, /\.bytes-human-item--participation, \.bytes-human-item--pressure \{[^}]*grid-column: span 5/);
  assert.match(dashboardCss, /\.bytes-human-item--distribution, \.bytes-human-item--issuance \{[^}]*grid-column: span 7/);
  assert.match(dashboardCss, /\.bytes-human-item--context \{[^}]*grid-column: 1 \/ -1/);
  assert.doesNotMatch(dashboard, /Supply-side context:/i);
  assert.doesNotMatch(dashboard, /true bull market|points per Citizen combine|duration boost/i);
  assert.doesNotMatch(dashboard, /next 52-week boundary/i);
  assert.doesNotMatch(dashboard, /of Ethereum total supply|of Ethereum BYTES supply/i);
  assert.match(dashboard, /bytes-citizen-percentage/);
  assert.doesNotMatch(dashboard, /verified weekly decay|verified 5,875|next Genesis half-level/i);
  assert.match(dashboard, /label="Market Cap\*"[^>]*valuePrefix="\$"/);
  assert.match(dashboard, /label="BYTES spot price"[^>]*valuePrefix="\$"/);
  assert.doesNotMatch(dashboard, /<small>BYTES pool<\/small>|<small>LP pool<\/small>/i);
  assert.match(dashboard, /legacyEmissionTotal !== null && legacyEmissionTotal > 0/);
  assert.match(dashboard, /Additional nonzero contract reward-window configuration detected for BYTES\/LP asset indices/);
  assert.match(contract, /original S1 Citizen/);
  assert.match(contract, /Market Cap\*/i);
});

test('desktop dashboard keeps the human read in the independent primary stack', async () => {
  const dashboard = await readFile(dashboardUrl, 'utf8');
  assert.match(
    dashboard,
    /className="bytes-layout"[\s\S]*className="bytes-primary"[\s\S]*className="[^"]*bytes-chart-panel[^"]*"[\s\S]*className="bytes-human-section"[\s\S]*className="bytes-side"/,
  );
});
