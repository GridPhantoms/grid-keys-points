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
// @ts-expect-error Node's strip-types test runner imports the TypeScript source directly.
import { mapWithConcurrency, readResponseBuffer } from '../app/api/_lib/bounded-response.ts';
// @ts-expect-error Node's strip-types test runner imports the TypeScript source directly.
import { decodeAbiString, parseMetadataUri } from '../app/api/_lib/ethereum-nft-metadata.ts';
import { buildCitizenHolderStats } from '../lib/citizen-holders.mjs';
import { buildOriginalS1Distinctions, originalS1AuditRowsDigest } from '../lib/citizen-lineage.mjs';
import { isLineageSnapshotCurrent, LINEAGE_MAX_AGE_MS } from '../lib/citizen-lineage-freshness.mjs';

const transfer = (tokenId: string, from: string, to: string, txHash: string, blockNumber: number) => ({ tokenId, from, to, txHash, blockNumber });

const ZERO = '0x0000000000000000000000000000000000000000';
const LEGACY_S1 = '0xb668beb1fa440f6cf2da0399f8c28cab993bdd65';
const V2_S1 = '0xB9951B43802dCF3ef5b14567cb17adF367ed1c0F';
const STAKER = '0x67e1eCFA9232E27EAf3133B968A33A9a0dCa9e16';
const ALICE = '0x17553AE6eE2c014f340BD89cf120572A5AbA4fb2';
const BOB = '0x18ED928719A8951729fBD4dbf617B7968D940c7B';
test('original S1 distinctions require original components and keep wallet continuity nested', () => {
  const componentTransfers = {
    identity: [
      transfer('1', ZERO, ALICE, '0xmint-i1', 10), transfer('1', ALICE, LEGACY_S1, '0xupload-101', 20),
      transfer('2', ZERO, ALICE, '0xmint-i2', 10), transfer('2', ALICE, LEGACY_S1, '0xupload-102', 21),
      transfer('3', ZERO, ALICE, '0xmint-i3', 10), transfer('3', ALICE, LEGACY_S1, '0xupload-103', 22),
      transfer('4', ZERO, ALICE, '0xmint-i4', 10), transfer('4', ALICE, LEGACY_S1, '0xupload-104', 23),
    ],
    vault: [
      transfer('11', ZERO, ALICE, '0xmint-v11', 11), transfer('11', ALICE, LEGACY_S1, '0xupload-101', 20),
      transfer('12', ZERO, ALICE, '0xmint-v12', 11), transfer('12', ALICE, LEGACY_S1, '0xupload-102', 21),
      transfer('13', ZERO, ALICE, '0xmint-v13', 11), transfer('13', ALICE, LEGACY_S1, '0xupload-103', 22),
    ],
    item: [
      transfer('21', ZERO, ALICE, '0xmint-it21', 12), transfer('21', ALICE, LEGACY_S1, '0xupload-101', 20),
      transfer('22', ZERO, ALICE, '0xmint-it22', 12), transfer('22', ALICE, LEGACY_S1, '0xupload-102', 21),
      transfer('23', ZERO, ALICE, '0xmint-it23', 12), transfer('23', ALICE, LEGACY_S1, '0xupload-103', 22),
      transfer('24', ZERO, ALICE, '0xmint-it24', 12), transfer('24', ALICE, LEGACY_S1, '0xupload-104', 23),
    ],
    land: [
      transfer('31', ZERO, ALICE, '0xmint-l31', 13), transfer('31', ALICE, LEGACY_S1, '0xupload-101', 20),
      transfer('32', ZERO, ALICE, '0xmint-l32', 13), transfer('32', ALICE, LEGACY_S1, '0xupload-102', 21),
      transfer('33', ZERO, ALICE, '0xlate-l33', 20), transfer('33', ALICE, LEGACY_S1, '0xupload-103', 22),
      transfer('34', ZERO, ALICE, '0xmint-l34', 13), transfer('34', ALICE, LEGACY_S1, '0xupload-104', 23),
    ],
  };
  const legacyCitizenTransfers = [
    transfer('101', ZERO, ALICE, '0xupload-101', 20),
    transfer('101', ALICE, V2_S1, '0xmigrate-101', 30),
    transfer('102', ZERO, ALICE, '0xupload-102', 21),
    transfer('102', ALICE, BOB, '0xsale-102', 25),
    transfer('102', BOB, ALICE, '0xreturn-102', 26),
    transfer('103', ZERO, ALICE, '0xupload-103', 22),
    transfer('104', ZERO, ALICE, '0xupload-104', 23),
    transfer('104', ALICE, ZERO, '0xdisassemble-104', 26),
  ];
  const v2CitizenTransfers = [
    transfer('101', ZERO, ALICE, '0xmigrate-101', 30),
    transfer('101', ALICE, STAKER, '0xstake-101', 40),
  ];
  const result = buildOriginalS1Distinctions({
    componentTransfers,
    legacyCitizenTransfers,
    v2CitizenTransfers,
    currentV2Owners: new Map([['101', STAKER]]),
    currentStakedOwners: new Map([['101', ALICE]]),
    legacyCitizenContract: LEGACY_S1,
    v2CitizenContract: V2_S1,
    stakingContract: STAKER,
    expectedComponentCohorts: {
      identity: { count: 4, mintEndBlock: 19, tokenIds: ['1', '2', '3', '4'] }, vault: { count: 3, mintEndBlock: 19, tokenIds: ['11', '12', '13'] },
      item: { count: 4, mintEndBlock: 19, tokenIds: ['21', '22', '23', '24'] }, land: { count: 3, mintEndBlock: 19, tokenIds: ['31', '32', '34'] },
    },
  });

  assert.equal(result.originalComponentUploads, 3);
  assert.equal(result.originalUpload.citizens, 2);
  assert.deepEqual(result.originalUpload.tokenIds, ['101', '102']);
  assert.equal(result.originalWallet.citizens, 1);
  assert.equal(result.originalWallet.uniqueWallets, 1);
  assert.deepEqual(result.originalWallet.tokenIds, ['101']);
  assert.deepEqual(result.originalUpload.locations, { legacy: 1, v2: 0, staked: 1 });
  assert.deepEqual(result.originalWallet.locations, { legacy: 0, v2: 0, staked: 1 });
});

test('original upload supports a vaultless first upload and rejects disassembly even after reassembly', () => {
  const componentTransfers = {
    identity: [transfer('1', ZERO, ALICE, '0xmi', 10), transfer('1', ALICE, LEGACY_S1, '0xu1', 20), transfer('1', LEGACY_S1, ALICE, '0xd1', 30), transfer('1', ALICE, LEGACY_S1, '0xu2', 31)],
    vault: [],
    item: [transfer('2', ZERO, ALICE, '0xit', 11), transfer('2', ALICE, LEGACY_S1, '0xu1', 20), transfer('2', LEGACY_S1, ALICE, '0xd1', 30), transfer('2', ALICE, LEGACY_S1, '0xu2', 31)],
    land: [transfer('3', ZERO, ALICE, '0xla', 12), transfer('3', ALICE, LEGACY_S1, '0xu1', 20), transfer('3', LEGACY_S1, ALICE, '0xd1', 30), transfer('3', ALICE, LEGACY_S1, '0xu2', 31)],
  };
  const result = buildOriginalS1Distinctions({
    componentTransfers,
    legacyCitizenTransfers: [transfer('101', ZERO, ALICE, '0xu1', 20), transfer('101', ALICE, ZERO, '0xd1', 30), transfer('102', ZERO, ALICE, '0xu2', 31)],
    v2CitizenTransfers: [], currentV2Owners: new Map(), currentStakedOwners: new Map(),
    legacyCitizenContract: LEGACY_S1, v2CitizenContract: V2_S1, stakingContract: STAKER,
    expectedComponentCohorts: {
      identity: { count: 1, mintEndBlock: 12, tokenIds: ['1'] }, vault: { count: 0, mintEndBlock: 12, tokenIds: [] },
      item: { count: 1, mintEndBlock: 12, tokenIds: ['2'] }, land: { count: 1, mintEndBlock: 12, tokenIds: ['3'] },
    },
  });
  assert.equal(result.originalComponentUploads, 1);
  assert.equal(result.originalUpload.citizens, 0);
  assert.equal(result.exclusions.disassembledOrReassembled, 1);
});

test('original component cohort manifests fail closed on count or token-ID drift', () => {
  const base = {
    componentTransfers: {
      identity: [transfer('1', ZERO, ALICE, '0xmi', 1)],
      vault: [],
      item: [transfer('2', ZERO, ALICE, '0xit', 2)],
      land: [transfer('3', ZERO, ALICE, '0xla', 3)],
    },
    legacyCitizenTransfers: [], v2CitizenTransfers: [],
    currentV2Owners: new Map(), currentStakedOwners: new Map(),
    legacyCitizenContract: LEGACY_S1, v2CitizenContract: V2_S1, stakingContract: STAKER,
  };
  const cohorts = {
    identity: { count: 1, mintEndBlock: 1, tokenIds: ['1'] }, vault: { count: 0, mintEndBlock: 1, tokenIds: [] },
    item: { count: 1, mintEndBlock: 2, tokenIds: ['2'] }, land: { count: 1, mintEndBlock: 3, tokenIds: ['3'] },
  };
  assert.throws(() => buildOriginalS1Distinctions({
    ...base,
    expectedComponentCohorts: { ...cohorts, identity: { count: 2, mintEndBlock: 1, tokenIds: ['1'] } },
  }), /exact immutable token-ID manifest/i);
  assert.throws(() => buildOriginalS1Distinctions({
    ...base,
    expectedComponentCohorts: { ...cohorts, land: { count: 1, mintEndBlock: 3, tokenIds: ['3'], digestSha256: '00' } },
  }), /immutable original-distribution cohort/i);
});

function buildSingleOriginalLineage({ v2After = [], currentOwner = ALICE, stakedOwner, migrationMintTo = ALICE }: {
  v2After?: ReturnType<typeof transfer>[]; currentOwner?: string; stakedOwner?: string; migrationMintTo?: string;
}) {
  const uploadTx = '0xupload';
  return buildOriginalS1Distinctions({
    componentTransfers: {
      identity: [transfer('1', ZERO, ALICE, '0xmi', 1), transfer('1', ALICE, LEGACY_S1, uploadTx, 10)],
      vault: [transfer('2', ZERO, ALICE, '0xmv', 2), transfer('2', ALICE, LEGACY_S1, uploadTx, 10)],
      item: [transfer('3', ZERO, ALICE, '0xmit', 3), transfer('3', ALICE, LEGACY_S1, uploadTx, 10)],
      land: [transfer('4', ZERO, ALICE, '0xml', 4), transfer('4', ALICE, LEGACY_S1, uploadTx, 10)],
    },
    legacyCitizenTransfers: [transfer('101', ZERO, ALICE, uploadTx, 10), transfer('101', ALICE, V2_S1, '0xmigrate', 20)],
    v2CitizenTransfers: [transfer('101', ZERO, migrationMintTo, '0xmigrate', 20), ...v2After],
    currentV2Owners: new Map([['101', currentOwner]]),
    currentStakedOwners: stakedOwner ? new Map([['101', stakedOwner]]) : new Map(),
    legacyCitizenContract: LEGACY_S1,
    v2CitizenContract: V2_S1,
    stakingContract: STAKER,
    expectedComponentCohorts: {
      identity: { count: 1, mintEndBlock: 1, tokenIds: ['1'] },
      vault: { count: 1, mintEndBlock: 2, tokenIds: ['2'] },
      item: { count: 1, mintEndBlock: 3, tokenIds: ['3'] },
      land: { count: 1, mintEndBlock: 4, tokenIds: ['4'] },
    },
  });
}

test('Original Wallet fails permanently on V2 transfer-out/return and wrong staking beneficiary', () => {
  const returned = buildSingleOriginalLineage({
    v2After: [transfer('101', ALICE, BOB, '0xout', 30), transfer('101', BOB, ALICE, '0xback', 31)],
  });
  assert.equal(returned.originalUpload.citizens, 1);
  assert.equal(returned.originalWallet.citizens, 0);

  const wrongBeneficiary = buildSingleOriginalLineage({
    v2After: [transfer('101', ALICE, STAKER, '0xstake', 30)], currentOwner: STAKER, stakedOwner: BOB,
  });
  assert.equal(wrongBeneficiary.originalUpload.citizens, 1);
  assert.equal(wrongBeneficiary.originalWallet.citizens, 0);
});

test('Original Wallet preserves same-wallet staking withdrawal/restake and rejects malformed migration', () => {
  const restaked = buildSingleOriginalLineage({
    v2After: [
      transfer('101', ALICE, STAKER, '0xstake1', 30),
      transfer('101', STAKER, ALICE, '0xwithdraw', 31),
      transfer('101', ALICE, STAKER, '0xstake2', 32),
    ],
    currentOwner: STAKER,
    stakedOwner: ALICE,
  });
  assert.equal(restaked.originalWallet.citizens, 1);

  const malformed = buildSingleOriginalLineage({ migrationMintTo: BOB, currentOwner: BOB });
  assert.equal(malformed.originalUpload.citizens, 0);
  assert.equal(malformed.exclusions.inactiveOrUnresolved, 1);
});

test('lineage snapshot freshness fails closed after 36 hours', () => {
  const generatedAt = '2026-09-08T00:00:00.000Z';
  const generatedMs = Date.parse(generatedAt);
  assert.equal(isLineageSnapshotCurrent(generatedAt, generatedMs + LINEAGE_MAX_AGE_MS), true);
  assert.equal(isLineageSnapshotCurrent(generatedAt, generatedMs + LINEAGE_MAX_AGE_MS + 1), false);
  assert.equal(isLineageSnapshotCurrent('invalid', generatedMs), false);
  assert.equal(isLineageSnapshotCurrent(generatedAt, generatedMs - 1), false);
});

test('Citizen holders replace staking custody with wallet-level positions and deduplicate overlap', () => {
  const staker = '0x67e1eCFA9232E27EAf3133B968A33A9a0dCa9e16';
  const alice = '0x17553AE6eE2c014f340BD89cf120572A5AbA4fb2';
  const bob = '0x18ED928719A8951729fBD4dbf617B7968D940c7B';
  const directOwners = new Map([
    ['1', alice],
    ['2', staker],
    ['3', bob],
    ['4', staker],
  ]);
  const stakedOwners = new Map([['2', alice], ['4', bob]]);
  const stats = buildCitizenHolderStats({ directOwners, stakedOwners, stakingContract: staker, supply: 4 });

  assert.equal(stats.uniqueOwners, 2);
  assert.equal(stats.ownerPercentage, 50);
  assert.equal(stats.directHolderWallets, 2);
  assert.equal(stats.activeStakerWallets, 2);
  assert.equal(stats.directAndStakedOverlap, 2);
  assert.equal(stats.directTokens, 2);
  assert.equal(stats.stakedTokens, 2);
  assert.deepEqual(stats.top.map((row: { count: number; held: number; staked: number }) => [row.count, row.held, row.staked]), [[2, 1, 1], [2, 1, 1]]);
});

test('Citizen holder calculation fails closed when staking custody IDs diverge', () => {
  assert.throws(() => buildCitizenHolderStats({
    directOwners: new Map([['1', '0x67e1eCFA9232E27EAf3133B968A33A9a0dCa9e16']]),
    stakedOwners: new Map([['2', '0x17553AE6eE2c014f340BD89cf120572A5AbA4fb2']]),
    stakingContract: '0x67e1eCFA9232E27EAf3133B968A33A9a0dCa9e16',
    supply: 1,
  }), /custody token IDs/);
});

test('Citizen image buffering rejects declared and streamed responses above the cap', async () => {
  const declared = new Response('small', { headers: { 'content-length': '6' } });
  await assert.rejects(() => readResponseBuffer(declared, 5), /exceeds limit/);

  const streamed = new Response(new ReadableStream({
    start(controller) {
      controller.enqueue(new Uint8Array([1, 2, 3]));
      controller.enqueue(new Uint8Array([4, 5, 6]));
      controller.close();
    },
  }));
  await assert.rejects(() => readResponseBuffer(streamed, 5), /exceeds limit/);
});

test('Citizen image layer work is concurrency bounded and order preserving', async () => {
  let active = 0;
  let peak = 0;
  const result = await mapWithConcurrency([1, 2, 3, 4, 5], 2, async (value) => {
    active += 1;
    peak = Math.max(peak, active);
    await new Promise((resolve) => setTimeout(resolve, 2));
    active -= 1;
    return value * 2;
  });
  assert.deepEqual(result, [2, 4, 6, 8, 10]);
  assert.equal(peak, 2);
});

test('onchain Citizen metadata decodes ABI strings and image_data', () => {
  const tokenUri = `data:application/json;base64,${Buffer.from(JSON.stringify({ image_data: 'data:image/svg+xml;base64,PHN2Zy8+' })).toString('base64')}`;
  const value = Buffer.from(tokenUri);
  const offset = Buffer.alloc(32); offset[31] = 32;
  const length = Buffer.alloc(32); length.writeUInt32BE(value.length, 28);
  const padded = Buffer.concat([value, Buffer.alloc((32 - (value.length % 32)) % 32)]);
  const encoded = `0x${Buffer.concat([offset, length, padded]).toString('hex')}`;

  assert.equal(parseMetadataUri(decodeAbiString(encoded)), 'data:image/svg+xml;base64,PHN2Zy8+');
  assert.throws(() => decodeAbiString('0x00'), /Invalid tokenURI ABI string/);
});

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

test('S1 Elite listings keep the compact four-column market layout', async () => {
  const ui = await readFile(new URL('../app/citizen/CitizenTerminal.tsx', import.meta.url), 'utf8');

  assert.match(ui, /<th>Citizen<\/th><th>Listing<\/th><th>Rank<\/th><th>Reward Rate<\/th>/);
  assert.match(ui, /className="ct-listing-view"[^>]*aria-label={`View Citizen #\$\{item\.tokenId\} listing`}/);
  assert.doesNotMatch(ui, />VIEW ↗<\/a>/);
  assert.match(ui, /colSpan=\{4\}/);
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

test('Citizen Interlink overview presents a focused hub with honest snapshot context', async () => {
  const [overview, glance, ui, css, page, nav, subnav, labPage, holdersPage, marketPage, legacyRedirect] = await Promise.all([
    readFile(new URL('../app/citizen/CitizenOverview.tsx', import.meta.url), 'utf8'),
    readFile(new URL('../app/citizen/CitizenOverviewGlance.tsx', import.meta.url), 'utf8'),
    readFile(new URL('../app/citizen/CitizenTerminal.tsx', import.meta.url), 'utf8'),
    readFile(new URL('../app/citizen/citizen.css', import.meta.url), 'utf8'),
    readFile(new URL('../app/citizen/page.tsx', import.meta.url), 'utf8'),
    readFile(new URL('../app/components/SiteNav.tsx', import.meta.url), 'utf8'),
    readFile(new URL('../app/citizen/CitizenSubnav.tsx', import.meta.url), 'utf8'),
    readFile(new URL('../app/citizen/lab/page.tsx', import.meta.url), 'utf8'),
    readFile(new URL('../app/citizen/holders/page.tsx', import.meta.url), 'utf8'),
    readFile(new URL('../app/citizen/market/page.tsx', import.meta.url), 'utf8'),
    readFile(new URL('../app/citizen/CitizenLegacyHashRedirect.tsx', import.meta.url), 'utf8'),
  ]);

  assert.match(overview, /<div className="ct-hero-title">/);
  assert.match(overview, /<h1 id="citizen-title">Citizen <em>Interlink<\/em><\/h1>/);
  assert.match(overview, /Inspect the code\. Price the yield\. Read the market\./);
  assert.match(overview, /ONCHAIN SNAPSHOT INDEXED/);
  assert.match(overview, /Decode & Model/);
  assert.match(overview, /Holders & Provenance/);
  assert.match(overview, /Market Dashboard/);
  assert.match(glance, /\$BYTES SPOT/);
  assert.match(glance, /minimumFractionDigits: 3, maximumFractionDigits: 3/);
  assert.match(glance, /maximumFractionDigits: 3/);
  assert.match(glance, /ethUsd\?: number \| null/);
  assert.match(glance, /ethUsd: finiteValue\(payload\.ethUsd\)/);
  assert.match(glance, /formatFloorUsd\(references\.s1FloorEth, references\.ethUsd\)/);
  assert.match(glance, /formatFloorUsd\(references\.s1EliteFloorEth, references\.ethUsd\)/);
  assert.match(glance, /formatFloorUsd\(references\.s2FloorEth, references\.ethUsd\)/);
  assert.match(glance, /≈ \$\$\{Math\.round\(floorEth \* ethUsd\)\.toLocaleString\('en-US'\)\}/);
  assert.match(glance, /\$BYTES MCAP\*/);
  assert.match(glance, /S1 FLOOR/);
  assert.match(glance, /S1 ELITE FLOOR/);
  assert.match(glance, /S2 FLOOR/);
  assert.match(glance, /label: 'S2 FLOOR', value: formatEth\(references\.s2FloorEth\)/);
  assert.match(glance, /S1 \/ S2 FLOOR/);
  assert.match(glance, /formatFloorRatio\(references\.s1FloorEth, references\.s2FloorEth\)/);
  assert.match(glance, /HOLDER RATIO/);
  assert.match(glance, /s1HolderRatio\.toFixed\(1\)/);
  assert.match(glance, /s2HolderRatio\.toFixed\(1\)/);
  assert.match(glance, /OWNERSHIP <b>•<\/b> \$BYTES <b>•<\/b> FLOORS/);
  assert.match(overview, /s1HolderRatio=\{snapshot\.seasons\.s1\.ownerPercentage\}/);
  assert.match(overview, /s2HolderRatio=\{snapshot\.seasons\.s2\.ownerPercentage\}/);
  assert.match(glance, /\/api\/citizen-terminal\/market/);
  assert.match(glance, /\/api\/bytes-metrics/);
  assert.match(glance, /metric\?\.availability === 'available'/);
  assert.match(glance, /CANONICAL ETHEREUM SUPPLY × CURRENT \$BYTES\/USD SPOT/);
  assert.doesNotMatch(glance, /ORIGINAL UPLOAD|ORIGINAL WALLET/);
  assert.match(overview, /Ethereum snapshot block/);
  assert.match(overview, /One network\. Four focused workspaces\./);
  assert.match(overview, /\/citizen\/lab/);
  assert.match(overview, /\/citizen\/holders/);
  assert.match(overview, /\/citizen\/market/);
  assert.match(overview, /\/citizen\/bytes2bytes/);
  assert.match(ui, /ct-snapshot-stamp/);
  assert.match(ui, /MARKET INTERLINK ACTIVE/);
  assert.match(ui, /Latest source interlinked/);
  assert.match(ui, /Oldest source/);
  assert.match(page, /title: 'Citizen Interlink \| Neo Tokyo Market Intelligence'/);
  assert.match(nav, /href: '\/citizen', label: 'Citizen Interlink'/);
  assert.match(subnav, /citizen-subnav-mobile/);
  assert.match(subnav, /Holders & Provenance/);
  assert.match(labPage, /CitizenSubnav active="lab"/);
  assert.match(labPage, /CitizenTerminal view="lab"/);
  assert.match(holdersPage, /CitizenSubnav active="holders"/);
  assert.match(marketPage, /CitizenSubnav active="market"/);
  assert.match(marketPage, /CitizenTerminal view="market"/);
  assert.match(page, /<CitizenLegacyHashRedirect \/>/);
  assert.match(legacyRedirect, /'#holder-map': '\/citizen\/holders#holder-map'/);
  assert.match(legacyRedirect, /'#top-holders': '\/citizen\/holders#top-holders'/);
  assert.doesNotMatch(overview, /Citizen <em>Terminal<\/em>|MULTI-SOURCE SNAPSHOT/);
  assert.doesNotMatch(page, /Citizen Terminal/);
  assert.doesNotMatch(nav, /label: 'Citizen Terminal'/);
  assert.doesNotMatch(overview, /<div className="ct-kicker"><span \/>/);
  assert.match(css, /\.ct-hero\{[^}]*grid-template-columns/);
  assert.match(css, /\.ct-kicker\{[^}]*justify-content:flex-start/);
  assert.match(css, /\.ct-snapshot-stamp\{/);
  assert.match(css, /\.ct-snapshot-stamp\.is-complete i\{/);
  assert.match(css, /\.ct-overview-glance>header\{[^}]*flex-direction:column[^}]*align-items:flex-start/);
  assert.match(css, /\.ct-overview-glance article strong\{[^}]*white-space:nowrap/);
  assert.match(css, /\.ct-overview-glance article \.ct-overview-glance-ratio\{[^}]*color:var\(--cyan\)/);
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

test('Citizen Interlink renders staking-corrected owner cards and top-holder splits', async () => {
  const [holdersPage, holderMap, snapshot, publicSnapshot, lineageAudit, cohortManifest, metricContract] = await Promise.all([
    readFile(new URL('../app/citizen/holders/page.tsx', import.meta.url), 'utf8'),
    readFile(new URL('../app/citizen/CitizenHolderMap.tsx', import.meta.url), 'utf8'),
    readFile(new URL('../data/citizen-holder-snapshot.json', import.meta.url), 'utf8'),
    readFile(new URL('../data/citizen-holder-public.json', import.meta.url), 'utf8'),
    readFile(new URL('../data/citizen-s1-lineage-audit.json', import.meta.url), 'utf8'),
    readFile(new URL('../data/s1-original-component-cohorts.json', import.meta.url), 'utf8'),
    readFile(new URL('../docs/citizen-terminal-metric-contract.md', import.meta.url), 'utf8'),
  ]);
  const parsed = JSON.parse(snapshot);
  const publicParsed = JSON.parse(publicSnapshot);
  const audit = JSON.parse(lineageAudit);
  const manifest = JSON.parse(cohortManifest);
  assert.ok(holdersPage.indexOf('<CitizenHolderSummary />') < holdersPage.indexOf('<CitizenHolderLeaderboard />'));
  assert.match(holdersPage, /CitizenSubnav active="holders"/);
  assert.match(holderMap, /Owners \(Unique\)/);
  assert.match(holderMap, /HELD \+ STAKED/);
  assert.match(holderMap, /VIEW TOP HOLDERS/);
  assert.match(holderMap, /Current V2 collections only/);
  assert.match(holderMap, /ORIGINAL UPLOAD/);
  assert.match(holderMap, /Two nested onchain distinctions for S1 Citizens first uploaded from original 2021-distributed parts\./);
  assert.match(holderMap, /ORIGINAL WALLET/);
  assert.match(holderMap, /Never disassembled or reassembled/);
  assert.match(holderMap, /citizen-holder-public\.json/);
  assert.doesNotMatch(publicSnapshot, /lookupTokenIds|tokenIds/);
  assert.deepEqual(publicParsed.source, parsed.source);
  const distinctions = parsed.s1HistoricalDistinctions;
  assert.equal(parsed.schemaVersion, 3);
  assert.equal(distinctions.componentCohorts.identity.count, 2_018);
  assert.equal(distinctions.componentCohorts.vault.count, 2_500);
  assert.equal(distinctions.componentCohorts.item.count, 2_495);
  assert.equal(distinctions.componentCohorts.land.count, 1_985);
  assert.equal(Object.values(distinctions.originalUpload.locations).reduce((sum: number, count) => sum + Number(count), 0), distinctions.originalUpload.citizens);
  assert.equal(Object.values(distinctions.originalWallet.locations).reduce((sum: number, count) => sum + Number(count), 0), distinctions.originalWallet.citizens);
  assert.equal(audit.originalUploadRows.length, distinctions.originalUpload.citizens);
  assert.equal(audit.originalUploadRows.filter((row: { originalWallet: boolean }) => row.originalWallet).length, distinctions.originalWallet.citizens);
  assert.equal(audit.rowsDigestSha256, distinctions.rowsDigestSha256);
  assert.equal(originalS1AuditRowsDigest(audit.originalUploadRows), distinctions.rowsDigestSha256);
  assert.equal(parsed.verification.s1HistoricalDistinctions.componentManifestDigestSha256, manifest.manifestRowsDigestSha256);
  assert.equal(manifest.manifestRowsDigestSha256, '2fcbe574ba3343dae1294947ddcc67a6ebc28526b51d3d321a520f1e3de4c351');
  assert.equal(Object.values(manifest.components as Record<string, { mints: unknown[] }>).reduce((sum, component) => sum + component.mints.length, 0), 8_998);
  assert.ok(distinctions.originalWallet.tokenIds.every((tokenId: string) => distinctions.originalUpload.tokenIds.includes(tokenId)));
  assert.equal(parsed.verification.s1HistoricalDistinctions.componentMappingsVerified, distinctions.originalUpload.citizens * 4);
  for (const season of ['s1', 's2']) {
    const stats = parsed.seasons[season];
    const proof = parsed.verification[season];
    assert.ok(Number.isSafeInteger(stats.uniqueOwners) && stats.uniqueOwners > 0);
    assert.equal(stats.directHolderWallets + stats.activeStakerWallets - stats.directAndStakedOverlap, stats.uniqueOwners);
    assert.equal(stats.directTokens + stats.stakedTokens, stats.supply);
    assert.equal(proof.ownerOfVerified, stats.supply);
    assert.equal(proof.stakingCustody, proof.activePositions);
  }
  assert.match(metricContract, /staking contract's custody token-ID set to equal the active position token-ID set/);
});

test('S1 lookup exposes simple nested Original Upload and Original Wallet badges', async () => {
  const [lookupRoute, ui, css] = await Promise.all([
    readFile(new URL('../app/api/citizen-terminal/lookup/route.ts', import.meta.url), 'utf8'),
    readFile(new URL('../app/citizen/CitizenTerminal.tsx', import.meta.url), 'utf8'),
    readFile(new URL('../app/citizen/citizen.css', import.meta.url), 'utf8'),
  ]);
  assert.match(lookupRoute, /s1HistoricalDistinctions/);
  assert.match(lookupRoute, /originalUploadIds\.has\(tokenId\)/);
  assert.match(lookupRoute, /originalWalletIds\.has\(tokenId\)/);
  assert.match(lookupRoute, /BigInt\(rawTokenId\)\.toString\(\)/);
  assert.match(lookupRoute, /isLineageSnapshotCurrent\(holderSnapshotValue\.generatedAt\)/);
  assert.match(lookupRoute, /lineageCurrent && originalWalletIds\.has\(tokenId\)/);
  assert.match(lookupRoute, /season === 's1'[\s\S]*\? 'private, no-store'[\s\S]*: 'public, s-maxage=300, stale-while-revalidate=900'/);
  assert.match(ui, /ORIGINAL UPLOAD/);
  assert.match(ui, /ORIGINAL WALLET/);
  assert.match(ui, /ct-lineage-badge upload/);
  assert.match(ui, /ct-lineage-badge wallet/);
  assert.match(ui, /LINEAGE SNAPSHOT STALE/);
  assert.match(css, /\.ct-lineage-badge\.upload/);
  assert.match(css, /\.ct-lineage-badge\.wallet/);
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
    readFile(new URL('../app/citizen/CitizenOverview.tsx', import.meta.url), 'utf8'),
    readFile(new URL('../app/citizen/bytes2bytes/page.tsx', import.meta.url), 'utf8'),
    readFile(new URL('../app/api/citizen-terminal/bytes2bytes/route.ts', import.meta.url), 'utf8'),
    readFile(new URL('../app/citizen/CitizenSubnav.tsx', import.meta.url), 'utf8'),
  ]);
  assert.match(overview, /SCAN A WALLET/);
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
  assert.match(imageRoute, /const LAYER_FETCH_CONCURRENCY = 4/);
  assert.match(imageRoute, /readResponseBuffer/);
  assert.match(imageRoute, /mapWithConcurrency/);
  assert.match(imageRoute, /Content-Security-Policy/);
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
