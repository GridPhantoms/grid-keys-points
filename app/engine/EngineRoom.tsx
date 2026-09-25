'use client';

import { useState, useEffect, useRef, type ReactNode } from 'react';
import { PHANTOM_REWARD_ARCHIVE_AT, PHANTOM_REWARD_FILES } from '@/lib/phantom-reward-files';

type RewardKeyType = 'genesis' | 'exodus';
type SourceStatus = 'loading' | 'available' | 'stale' | 'unavailable';
type EvidenceClass = 'Observed' | 'Calculated' | 'Estimated' | 'Projected';

type SourceResult<T> = {
  status: SourceStatus;
  data: T | null;
  asOf: string | null;
};

type VaultSnapshot = Record<string, number>;
type EvmAsset = {
  assetId: string;
  symbol: string;
  displayName: string;
  assetType: 'native' | 'erc20';
  contractAddress: string | null;
  decimals: number;
  rawBalance: string;
  quantity: number;
  priceUsd: number;
  marketValueUsd: number;
  costBasisUsd: number;
  basisQuantity: number;
  averageEntryUsd: number | null;
  verificationStatus: 'independently-verified';
};
type EvmSnapshot = {
  walletAddress: string;
  directWalletTotalUsd: number;
  debankReferenceUsd: number;
  unattributedDeBankUsd: number;
  assets: EvmAsset[];
};
type SolanaAsset = {
  assetId: string;
  symbol: string;
  displayName: string;
  assetType: 'native' | 'spl';
  contractOrMint: string;
  quantity: number;
  priceUsd: number;
  marketValueUsd: number;
  costBasisUsd: number;
  basisQuantity: number;
  averageEntryUsd: number | null;
  verificationStatus: 'independently-verified';
};
type SolanaSnapshot = {
  walletAddress: string;
  totalUsd: number;
  assets: SolanaAsset[];
};
type HypercoreAsset = {
  assetId: string;
  symbol: string;
  displayName: string;
  assetType: 'spot';
  tokenIndex: number;
  quantity: number;
  hold: number;
  priceUsd: number;
  marketValueUsd: number;
  costBasisUsd: number;
  basisQuantity: number;
  averageEntryUsd: number | null;
  verificationStatus: 'independently-verified';
};
type HypercoreSnapshot = {
  walletAddress: string;
  totalUsd: number;
  assets: HypercoreAsset[];
};
type NftAsset = {
  tokenId: string;
  collection: string;
  name: string;
  image: string;
  openseaUrl: string;
};
type NftHoldings = { s1: number; s2: number; items: number; genesis: number; credits: number; coattail: number; assets: NftAsset[] };
type KeySupply = { exodusMinted: number };
type HolderSnapshot = { holderCount: number };
type RewardArchive = {
  totalRewards: number;
  totalEntries: number;
  uniqueRecipientsByCycle: number[];
};

type EngineSources = {
  vault: SourceResult<VaultSnapshot>;
  evm: SourceResult<EvmSnapshot>;
  solana: SourceResult<SolanaSnapshot>;
  hypercore: SourceResult<HypercoreSnapshot>;
  nft: SourceResult<NftHoldings>;
  supply: SourceResult<KeySupply>;
  holders: SourceResult<HolderSnapshot>;
  rewards: SourceResult<RewardArchive>;
};

const SOURCE_CLASS_COUNT = 8;
const SOURCE_TIMEOUT_MS = 12_000;
const SOURCE_HTTP_ATTEMPTS = 3;
const SOURCE_RETRY_DELAY_MS = 250;

const TOTAL_GENESIS_KEYS = 555;
const TOTAL_EXODUS_SUPPLY = 3333;
const EVM_WALLET = '0x6a1bc919e847c12725904965e05971b818b47ad0';
const SOLANA_WALLET = '3XkRf4B28NmH96aMbz3fNtfZhMeficq9fNv3kA7pFU9S';
const HYPERCORE_WALLET = '0x6a1bc919e847c12725904965e05971b818b47ad0';
const EVM_ASSET_IDENTITIES = new Map([
  ['ETH', { assetId: 'ethereum-native-eth', displayName: 'Ethereum', contractAddress: null, decimals: 18, assetType: 'native' }],
  ['USDC', { assetId: 'ethereum-usdc', displayName: 'USD Coin', contractAddress: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48', decimals: 6, assetType: 'erc20' }],
  ['WBTC', { assetId: 'ethereum-wbtc', displayName: 'Wrapped Bitcoin', contractAddress: '0x2260fac5e5542a773aa44fbcfedf7c193bc2c599', decimals: 8, assetType: 'erc20' }],
  ['UNI', { assetId: 'ethereum-uni', displayName: 'Uniswap', contractAddress: '0x1f9840a85d5af5bf1d1762f925bdaddc4201f984', decimals: 18, assetType: 'erc20' }],
  ['wTAO', { assetId: 'ethereum-wtao', displayName: 'Wrapped TAO', contractAddress: '0x77e06c9eccf2e797fd462a92b6d7642ef85b0a44', decimals: 9, assetType: 'erc20' }],
  ['BYTES', { assetId: 'ethereum-bytes', displayName: 'Neo Tokyo BYTES', contractAddress: '0xa19f5264f7d7be11c451c093d8f92592820bea86', decimals: 18, assetType: 'erc20' }],
]);
const SOLANA_MINTS = new Map([
  ['SOL', 'native'],
  ['JUP', 'JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN'],
  ['PENGU', '2zMMhcVQEXDtdE6vsFS7S7D5oUodfJHE8vd1gnBouauv'],
  ['USDC', 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v'],
]);
const HYPERCORE_TOKENS = new Map([
  ['HYPE', 150],
  ['USDC', 0],
]);
const GENESIS_LAUNCH = new Date('2025-10-09T16:03:47Z').getTime();


const loadingSource = <T,>(): SourceResult<T> => ({ status: 'loading', data: null, asOf: null });

const INITIAL_SOURCES: EngineSources = {
  vault: loadingSource<VaultSnapshot>(),
  evm: loadingSource<EvmSnapshot>(),
  solana: loadingSource<SolanaSnapshot>(),
  hypercore: loadingSource<HypercoreSnapshot>(),
  nft: loadingSource<NftHoldings>(),
  supply: loadingSource<KeySupply>(),
  holders: loadingSource<HolderSnapshot>(),
  rewards: loadingSource<RewardArchive>(),
};

const COMPLETED_REWARD_HISTORY = [
  { cycle: 'October 2025', genesis: 4, exodus: 0 },
  { cycle: 'November 2025', genesis: 10, exodus: 0 },
  { cycle: 'December 2025', genesis: 11, exodus: 0 },
  { cycle: 'January 2026', genesis: 6, exodus: 0 },
  { cycle: 'February 2026', genesis: 6, exodus: 0 },
  { cycle: 'March 2026', genesis: 5, exodus: 0 },
  { cycle: 'April 2026', genesis: 3.6, exodus: 3 },
  { cycle: 'May 2026', genesis: 3.6, exodus: 3 },
  { cycle: 'June 2026', genesis: 2.4, exodus: 2 },
  { cycle: 'July 2026', genesis: 2.4, exodus: 2 },
  { cycle: 'August 2026', genesis: 1.5, exodus: 1.25 },
] as const;

const COMPLETED_REWARDS_PER_KEY = COMPLETED_REWARD_HISTORY.reduce(
  (totals, reward) => ({
    genesis: totals.genesis + reward.genesis,
    exodus: totals.exodus + reward.exodus,
  }),
  { genesis: 0, exodus: 0 }
);

const REWARD_HISTORY_THROUGH = COMPLETED_REWARD_HISTORY.at(-1)?.cycle ?? '';

const LATEST_GRID_CYCLE = {
  cycle: 'August 2026',
  proposalUrl: 'https://snapshot.box/#/s:gridphantoms.eth/proposal/0x105b2a2f4b29b359f721e84a6e997e02f04474a71e2aede2b8010076343eba10',
  winner: 'Full-Spectrum Vault',
  winnerGp: '286 GP',
  winnerShare: '37.93%',
  runnerUp: 'Liquid Diversified',
  runnerUpGp: '269 GP',
  participatingWallets: 36,
  totalGp: 754,
  snapshotBlock: '25,876,257',
  genesisKeys: 307,
  exodusKeys: 447,
  genesisRate: '1.50',
  exodusRate: '1.25',
  baseBytes: '1,019.25',
  hazardBytes: '217',
  totalBytes: '1,236.25',
} as const;

const REWARD_PROOFS = [
  { cycle: 'August 2026', distributed: 'September 6, 2026', occurredAt: '2026-09-06T22:56:53Z', bytes: '1,236.25', transfers: 36, hash: '0x831b49fea0931019c04575f82a292072c9da831dc9bcf48d78189f4c8cd71931' },
  { cycle: 'July 2026', distributed: 'August 3, 2026', occurredAt: '2026-08-03T02:10:34Z', bytes: '1,178.8', transfers: 27, hash: '0x65674cb20d3980ef4bf9e93eeeb0560a746030dc6aa1a48390c4cc6d4bf66efd' },
  { cycle: 'June 2026', distributed: 'July 13, 2026', occurredAt: '2026-07-13T03:17:55Z', bytes: '1,115.6', transfers: 28, hash: '0x1a00539906d2e1c7508a1c1aef64b0a7e66a2b55d15cc6f3361b74b8da36202d' },
  { cycle: 'May 2026', distributed: 'June 3, 2026', occurredAt: '2026-06-03T22:28:39Z', bytes: '2,050.8', transfers: 39, hash: '0xb6ed9da83476ef32e88d689ddc10e49380f8b699a874e97c88996da7c713e3c7' },
  { cycle: 'April 2026', distributed: 'May 8, 2026', occurredAt: '2026-05-08T04:27:56Z', bytes: '1,926', transfers: 48, hash: '0x7b95b4deb03f983eba105efdcb08cec4e58fb1189bfbbf02dbb633d16aee4573' },
  { cycle: 'March 2026', distributed: 'April 9, 2026', occurredAt: '2026-04-09T06:07:53Z', bytes: '1,625', transfers: 33, hash: '0x908d318eca4005fb12d3cf91140322c5370a256cc58fe5bb66f7561edf5602c7' },
  { cycle: 'February 2026', distributed: 'March 12, 2026', occurredAt: '2026-03-12T01:12:07Z', bytes: '1,998', transfers: 50, hash: '0x2e45a309833dabe4163941e1530ea3fa18a8eb8a8eb616914bbced25ae9e8d94' },
  { cycle: 'January 2026', distributed: 'February 7, 2026', occurredAt: '2026-02-07T03:38:08Z', bytes: '2,442', transfers: 62, hash: '0x760a3b5e043bff9551994ec06da51ff1a19ee6318824c30fbe20a0e8ee819411' },
  { cycle: 'December 2025', distributed: 'January 7, 2026', occurredAt: '2026-01-07T05:33:41Z', bytes: '3,476', transfers: 58, hash: '0xd870fe7d53f3c4eff2070a33e32615e876044347ae2d0eae02506446f618f5d8' },
  { cycle: 'November 2025', distributed: 'December 3, 2025', occurredAt: '2025-12-03T03:55:46Z', bytes: '3,020', transfers: 58, hash: '0xa21fece7a8c8515e759e491303c2a544f30b9e0e57807febac072c07229b2d38' },
  { cycle: 'October 2025', distributed: 'November 2, 2025', occurredAt: '2025-11-02T20:28:13Z', bytes: '2,216', transfers: 120, hash: '0x87264ae2abd230923efe3cc53236f5669040529c6a74c62b4672af0131871d21' },
] as const;

const [LATEST_REWARD_PROOF, ...EARLIER_REWARD_PROOFS] = REWARD_PROOFS;

function formatUsd(value: number) {
  return value.toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: value > 0 && value < 1 ? 6 : 2,
  });
}

function formatAssetQuantity(value: number) {
  return value.toLocaleString('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: value >= 1000 ? 2 : value >= 1 ? 6 : 8,
  });
}

function formatUtc(value: string) {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
    timeZone: 'UTC',
    timeZoneName: 'short',
  }).format(new Date(value));
}

function formatUtcTime(value: string) {
  return new Intl.DateTimeFormat('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
    timeZone: 'UTC',
    timeZoneName: 'short',
  }).format(new Date(value));
}

function isValidTimestamp(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) && timestamp <= Date.now() + (5 * 60 * 1000);
}

function quantityFromRawBalance(rawBalance: string, decimals: number) {
  const padded = rawBalance.padStart(decimals + 1, '0');
  const whole = decimals ? padded.slice(0, -decimals) : padded;
  const fractional = decimals ? padded.slice(-decimals).replace(/0+$/, '') : '';
  return Number(fractional ? `${whole}.${fractional}` : whole);
}

async function fetchResponseOnce(path: string) {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), SOURCE_TIMEOUT_MS);
  try {
    return await fetch(path, { cache: 'no-store', signal: controller.signal });
  } finally {
    window.clearTimeout(timeout);
  }
}

async function fetchResponse(path: string) {
  for (let attempt = 1; attempt <= SOURCE_HTTP_ATTEMPTS; attempt += 1) {
    const response = await fetchResponseOnce(path);
    if (response.status < 500 || attempt === SOURCE_HTTP_ATTEMPTS) return response;
    await new Promise((resolve) => window.setTimeout(resolve, SOURCE_RETRY_DELAY_MS * attempt));
  }
  throw new Error(`Unable to load ${path}`);
}

async function fetchText(path: string) {
  const response = await fetchResponse(path);
  if (!response.ok) throw new Error(`Unable to load ${path}`);
  const text = await response.text();
  if (!text.trim()) throw new Error(`Empty response from ${path}`);
  return text;
}

async function fetchJson(path: string) {
  const response = await fetchResponse(path);
  if (!response.ok) throw new Error(`Unable to load ${path}`);
  const data = await response.json();
  if (!data || typeof data !== 'object' || Array.isArray(data)) throw new Error(`Invalid JSON from ${path}`);
  return data as Record<string, unknown>;
}

function parseVaultSnapshot(text: string): VaultSnapshot {
  const lines = text.trim().split('\n');
  if (lines[0]?.trim() !== 'stat,value') throw new Error('Invalid vault snapshot header');

  const snapshot: VaultSnapshot = {};
  for (const line of lines.slice(1)) {
    const [key, rawValue] = line.split(',');
    const value = Number(rawValue);
    if (!key?.trim() || !Number.isFinite(value) || value < 0) throw new Error('Invalid vault snapshot row');
    snapshot[key.trim()] = value;
  }

  const required = [
    'debank_portfolio_usd',
    'black_price_usd',
    'veblack_balance',
    'bytes_price_usd',
    'neo_s1_floor_usd',
    'neo_s2_floor_usd',
    'neo_items_cache_floor_usd',
    'grid_genesis_floor_usd',
    'credits_floor_usd',
    'coattail_brokers_floor_usd',
    'coattail_broker_wallet_usd',
    'coattail_broker_wallet_token_count',
  ];
  if (required.some((key) => !Number.isFinite(snapshot[key]))) throw new Error('Incomplete vault snapshot');
  return snapshot;
}

function parseEvmSnapshot(data: Record<string, unknown>): { data: EvmSnapshot; asOf: string } {
  if (
    data.schemaVersion !== 1
    || data.chain !== 'ethereum'
    || data.chainId !== 1
    || data.network !== 'mainnet'
    || data.walletAddress !== EVM_WALLET
    || data.valuationRole !== 'direct-wallet-look-through'
    || data.accountingTreatment !== 'included-in-debank-not-added-to-total'
  ) {
    throw new Error('Invalid EVM snapshot identity');
  }
  if (!isValidTimestamp(data.capturedAt) || data.verificationStatus !== 'independently-verified' || !Array.isArray(data.assets)) {
    throw new Error('Invalid EVM snapshot metadata');
  }
  const balanceSource = data.balanceSource;
  if (!balanceSource || typeof balanceSource !== 'object' || Array.isArray(balanceSource)) throw new Error('Invalid EVM balance provenance');
  const source = balanceSource as Record<string, unknown>;
  if (
    source.provider !== 'Ethereum JSON-RPC'
    || source.finality !== 'finalized'
    || !Number.isSafeInteger(source.blockNumber)
    || Number(source.blockNumber) <= 0
    || !/^0x[0-9a-f]{64}$/.test(String(source.blockHash))
    || !isValidTimestamp(source.blockTimestamp)
    || Date.parse(source.blockTimestamp as string) > Date.parse(data.capturedAt)
  ) {
    throw new Error('Invalid EVM finalized block provenance');
  }

  const assets = data.assets.map((rawAsset) => {
    if (!rawAsset || typeof rawAsset !== 'object' || Array.isArray(rawAsset)) throw new Error('Invalid EVM asset row');
    const asset = rawAsset as Record<string, unknown>;
    const symbol = typeof asset.symbol === 'string' ? asset.symbol : '';
    const expected = EVM_ASSET_IDENTITIES.get(symbol);
    const contractAddress = asset.contractAddress === null ? null : String(asset.contractAddress).toLowerCase();
    const rawBalance = String(asset.rawBalance);
    const quantity = Number(asset.quantity);
    const expectedQuantity = expected ? quantityFromRawBalance(rawBalance, expected.decimals) : Number.NaN;
    const priceUsd = Number(asset.priceUsd);
    const marketValueUsd = Number(asset.marketValueUsd);
    const costBasisUsd = Number(asset.costBasisUsd);
    const basisQuantity = Number(asset.basisQuantity);
    const averageEntryUsd = asset.averageEntryUsd === null ? null : Number(asset.averageEntryUsd);
    if (
      !expected
      || asset.assetId !== expected.assetId
      || asset.displayName !== expected.displayName
      || contractAddress !== expected.contractAddress
      || asset.decimals !== expected.decimals
      || asset.assetType !== expected.assetType
      || asset.chain !== 'ethereum'
      || asset.chainId !== 1
      || asset.network !== 'mainnet'
      || asset.walletAddress !== EVM_WALLET
      || !/^\d+$/.test(rawBalance)
    ) {
      throw new Error('Unexpected EVM asset identifier');
    }
    if (![quantity, priceUsd, marketValueUsd, costBasisUsd, basisQuantity].every((value) => Number.isFinite(value) && value >= 0) || priceUsd <= 0) {
      throw new Error('Invalid EVM asset value');
    }
    if (averageEntryUsd !== null && (!Number.isFinite(averageEntryUsd) || averageEntryUsd < 0)) throw new Error('Invalid EVM acquisition basis');
    if (
      asset.verificationStatus !== 'independently-verified'
      || asset.accountingTreatment !== 'included-in-debank-not-added-to-total'
      || !Number.isFinite(expectedQuantity)
      || Math.abs(expectedQuantity - quantity) > Math.max(1e-12, expectedQuantity * 1e-12)
      || Math.abs((quantity * priceUsd) - marketValueUsd) > Math.max(0.02, marketValueUsd * 0.001)
    ) {
      throw new Error('Unverified or inconsistent EVM asset');
    }
    return {
      assetId: String(asset.assetId),
      symbol,
      displayName: String(asset.displayName),
      assetType: asset.assetType as 'native' | 'erc20',
      contractAddress,
      decimals: expected.decimals,
      rawBalance,
      quantity,
      priceUsd,
      marketValueUsd,
      costBasisUsd,
      basisQuantity,
      averageEntryUsd,
      verificationStatus: 'independently-verified' as const,
    };
  });

  if (assets.length !== EVM_ASSET_IDENTITIES.size || new Set(assets.map((asset) => asset.symbol)).size !== EVM_ASSET_IDENTITIES.size) {
    throw new Error('Incomplete EVM asset allowlist');
  }
  const directWalletTotalUsd = Number(data.directWalletTotalUsd);
  const debankReferenceUsd = Number(data.debankReferenceUsd);
  const unattributedDeBankUsd = Number(data.unattributedDeBankUsd);
  const calculatedTotal = assets.reduce((sum, asset) => sum + asset.marketValueUsd, 0);
  if (
    !Number.isFinite(directWalletTotalUsd)
    || directWalletTotalUsd < 0
    || !Number.isFinite(debankReferenceUsd)
    || debankReferenceUsd < 0
    || !Number.isFinite(unattributedDeBankUsd)
    || Math.abs(directWalletTotalUsd - calculatedTotal) > Math.max(0.02, directWalletTotalUsd * 0.001)
    || Math.abs(unattributedDeBankUsd - (debankReferenceUsd - directWalletTotalUsd)) > 0.02
  ) {
    throw new Error('Invalid EVM snapshot reconciliation');
  }
  return {
    data: { walletAddress: EVM_WALLET, directWalletTotalUsd, debankReferenceUsd, unattributedDeBankUsd, assets },
    asOf: data.capturedAt,
  };
}

function parseSolanaSnapshot(data: Record<string, unknown>): { data: SolanaSnapshot; asOf: string } {
  if (data.schemaVersion !== 1 || data.chain !== 'solana' || data.network !== 'mainnet-beta' || data.walletAddress !== SOLANA_WALLET) {
    throw new Error('Invalid Solana snapshot identity');
  }
  if (!isValidTimestamp(data.capturedAt) || data.verificationStatus !== 'independently-verified' || !Array.isArray(data.assets)) {
    throw new Error('Invalid Solana snapshot metadata');
  }

  const assets = data.assets.map((rawAsset) => {
    if (!rawAsset || typeof rawAsset !== 'object' || Array.isArray(rawAsset)) throw new Error('Invalid Solana asset row');
    const asset = rawAsset as Record<string, unknown>;
    const symbol = typeof asset.symbol === 'string' ? asset.symbol : '';
    const expectedMint = SOLANA_MINTS.get(symbol);
    const quantity = Number(asset.quantity);
    const priceUsd = Number(asset.priceUsd);
    const marketValueUsd = Number(asset.marketValueUsd);
    const costBasisUsd = Number(asset.costBasisUsd);
    const basisQuantity = Number(asset.basisQuantity);
    const averageEntryUsd = asset.averageEntryUsd === null ? null : Number(asset.averageEntryUsd);
    if (!expectedMint || asset.contractOrMint !== expectedMint || !['native', 'spl'].includes(String(asset.assetType))) {
      throw new Error('Unexpected Solana asset identifier');
    }
    if (![quantity, priceUsd, marketValueUsd, costBasisUsd, basisQuantity].every((value) => Number.isFinite(value) && value >= 0)) {
      throw new Error('Invalid Solana asset value');
    }
    if (averageEntryUsd !== null && (!Number.isFinite(averageEntryUsd) || averageEntryUsd < 0)) throw new Error('Invalid Solana acquisition basis');
    if (asset.verificationStatus !== 'independently-verified' || Math.abs((quantity * priceUsd) - marketValueUsd) > Math.max(0.02, marketValueUsd * 0.001)) {
      throw new Error('Unverified or inconsistent Solana asset');
    }
    return {
      assetId: String(asset.assetId),
      symbol,
      displayName: String(asset.displayName),
      assetType: asset.assetType as 'native' | 'spl',
      contractOrMint: String(asset.contractOrMint),
      quantity,
      priceUsd,
      marketValueUsd,
      costBasisUsd,
      basisQuantity,
      averageEntryUsd,
      verificationStatus: 'independently-verified' as const,
    };
  });

  if (assets.length !== SOLANA_MINTS.size || new Set(assets.map((asset) => asset.symbol)).size !== SOLANA_MINTS.size) {
    throw new Error('Incomplete Solana asset allowlist');
  }
  const totalUsd = Number(data.totalUsd);
  const calculatedTotal = assets.reduce((sum, asset) => sum + asset.marketValueUsd, 0);
  if (!Number.isFinite(totalUsd) || totalUsd < 0 || Math.abs(totalUsd - calculatedTotal) > Math.max(0.02, totalUsd * 0.001)) {
    throw new Error('Invalid Solana snapshot total');
  }
  return { data: { walletAddress: SOLANA_WALLET, totalUsd, assets }, asOf: data.capturedAt };
}

function parseHypercoreSnapshot(data: Record<string, unknown>): { data: HypercoreSnapshot; asOf: string } {
  if (data.schemaVersion !== 1 || data.venue !== 'hypercore' || data.network !== 'mainnet' || data.walletAddress !== HYPERCORE_WALLET) {
    throw new Error('Invalid HyperCore snapshot identity');
  }
  if (!isValidTimestamp(data.capturedAt) || data.verificationStatus !== 'independently-verified' || !Array.isArray(data.assets)) {
    throw new Error('Invalid HyperCore snapshot metadata');
  }

  const assets = data.assets.map((rawAsset) => {
    if (!rawAsset || typeof rawAsset !== 'object' || Array.isArray(rawAsset)) throw new Error('Invalid HyperCore asset row');
    const asset = rawAsset as Record<string, unknown>;
    const symbol = typeof asset.symbol === 'string' ? asset.symbol : '';
    const expectedTokenIndex = HYPERCORE_TOKENS.get(symbol);
    const tokenIndex = Number(asset.tokenIndex);
    const quantity = Number(asset.quantity);
    const hold = Number(asset.hold);
    const priceUsd = Number(asset.priceUsd);
    const marketValueUsd = Number(asset.marketValueUsd);
    const costBasisUsd = Number(asset.costBasisUsd);
    const basisQuantity = Number(asset.basisQuantity);
    const averageEntryUsd = asset.averageEntryUsd === null ? null : Number(asset.averageEntryUsd);
    if (expectedTokenIndex === undefined || tokenIndex !== expectedTokenIndex || asset.assetType !== 'spot') {
      throw new Error('Unexpected HyperCore asset identifier');
    }
    if (![quantity, hold, priceUsd, marketValueUsd, costBasisUsd, basisQuantity].every((value) => Number.isFinite(value) && value >= 0) || priceUsd <= 0 || hold > quantity) {
      throw new Error('Invalid HyperCore asset value');
    }
    if (averageEntryUsd !== null && (!Number.isFinite(averageEntryUsd) || averageEntryUsd < 0)) throw new Error('Invalid HyperCore acquisition basis');
    if (asset.verificationStatus !== 'independently-verified' || Math.abs((quantity * priceUsd) - marketValueUsd) > Math.max(0.02, marketValueUsd * 0.001)) {
      throw new Error('Unverified or inconsistent HyperCore asset');
    }
    return {
      assetId: String(asset.assetId),
      symbol,
      displayName: String(asset.displayName),
      assetType: 'spot' as const,
      tokenIndex,
      quantity,
      hold,
      priceUsd,
      marketValueUsd,
      costBasisUsd,
      basisQuantity,
      averageEntryUsd,
      verificationStatus: 'independently-verified' as const,
    };
  });

  if (assets.length !== HYPERCORE_TOKENS.size || new Set(assets.map((asset) => asset.symbol)).size !== HYPERCORE_TOKENS.size) {
    throw new Error('Incomplete HyperCore asset allowlist');
  }
  const totalUsd = Number(data.totalUsd);
  const calculatedTotal = assets.reduce((sum, asset) => sum + asset.marketValueUsd, 0);
  if (!Number.isFinite(totalUsd) || totalUsd < 0 || Math.abs(totalUsd - calculatedTotal) > Math.max(0.02, totalUsd * 0.001)) {
    throw new Error('Invalid HyperCore snapshot total');
  }
  return { data: { walletAddress: HYPERCORE_WALLET, totalUsd, assets }, asOf: data.capturedAt };
}

function parseHolderSnapshot(text: string): HolderSnapshot {
  const lines = text.trim().split('\n').filter(Boolean);
  if (lines[0]?.trim() !== 'wallet,genesis_qty,exodus_qty') throw new Error('Invalid holder snapshot header');

  for (const line of lines.slice(1)) {
    const [wallet, rawGenesis, rawExodus] = line.split(',');
    const genesis = Number(rawGenesis);
    const exodus = Number(rawExodus);
    if (!/^0x[a-fA-F0-9]{40}$/.test(wallet || '') || !Number.isInteger(genesis) || !Number.isInteger(exodus) || genesis < 0 || exodus < 0 || genesis + exodus < 1) {
      throw new Error('Invalid holder snapshot row');
    }
  }

  return { holderCount: lines.length - 1 };
}

function parseRewardArchive(texts: string[]): RewardArchive {
  if (texts.length !== PHANTOM_REWARD_FILES.length) throw new Error('Incomplete reward archive');
  let totalRewards = 0;
  let totalEntries = 0;
  const uniqueRecipientsByCycle: number[] = [];

  for (const text of texts) {
    const recipients = new Set<string>();
    const lines = text.trim().split('\n').filter(Boolean);
    if (!lines.length) throw new Error('Empty reward archive file');

    for (const line of lines) {
      const [wallet, rawAmount] = line.split(',');
      const amount = Number(rawAmount);
      if (!/^0x[a-fA-F0-9]{40}$/.test(wallet || '') || !Number.isFinite(amount) || amount <= 0) {
        throw new Error('Invalid reward archive row');
      }
      totalRewards += amount;
      totalEntries += 1;
      recipients.add(wallet.toLowerCase());
    }
    uniqueRecipientsByCycle.push(recipients.size);
  }

  return { totalRewards, totalEntries, uniqueRecipientsByCycle };
}

async function loadSource<T>(
  name: keyof EngineSources,
  loader: () => Promise<{ data: T; asOf: string }>,
  staleAfterMs?: number,
): Promise<SourceResult<T>> {
  try {
    const result = await loader();
    if (!isValidTimestamp(result.asOf)) throw new Error('Invalid source timestamp');
    const status = staleAfterMs && Date.now() - Date.parse(result.asOf) > staleAfterMs ? 'stale' : 'available';
    return { status, data: result.data, asOf: result.asOf };
  } catch {
    console.error(`Engine Room ${name} source unavailable`);
    return { status: 'unavailable', data: null, asOf: null };
  }
}

function combineSourceStatuses(...sources: Array<SourceResult<unknown>>): SourceStatus {
  if (sources.some((source) => source.status === 'loading')) return 'loading';
  if (sources.some((source) => source.status === 'unavailable')) return 'unavailable';
  if (sources.some((source) => source.status === 'stale')) return 'stale';
  return 'available';
}

function isSourceUsable(status: SourceStatus) {
  return status === 'available' || status === 'stale';
}

function sourceStatusLabel(status: SourceStatus) {
  return status.toUpperCase();
}

function EvidenceBadge({ classification }: { classification: EvidenceClass }) {
  return <small className={`engine-evidence engine-evidence-${classification.toLowerCase()}`}>{classification}</small>;
}

function MetricState({ status, children }: { status: SourceStatus; children: ReactNode }) {
  if (status === 'available') return children;
  if (status === 'stale') return <span className="engine-stale-value">{children}<small>STALE</small></span>;
  return <span className={`engine-metric-state is-${status}`}>{status === 'loading' ? 'LOADING…' : 'UNAVAILABLE'}</span>;
}

function SourceCard({
  label,
  mode,
  timeKind,
  source,
}: {
  label: string;
  mode: string;
  timeKind: 'CAPTURED' | 'CHECKED' | 'OCCURRED';
  source: SourceResult<unknown>;
}) {
  return (
    <article className={`engine-source-card is-${source.status}`}>
      <span>{label}</span>
      <strong>
        {isSourceUsable(source.status) && source.asOf
          ? <>{timeKind} <time dateTime={source.asOf}>{formatUtc(source.asOf)}</time></>
          : source.status === 'loading' ? 'LOADING…' : 'SOURCE UNAVAILABLE'}
      </strong>
      <small>{sourceStatusLabel(source.status)} · {mode}</small>
    </article>
  );
}

function AnimatedNumber({ 
  value, 
  duration = 1800, 
  prefix = "", 
  suffix = "", 
  decimals = false,
  ready = true
}: { 
  value: number; 
  duration?: number; 
  prefix?: string; 
  suffix?: string;
  decimals?: boolean;
  ready?: boolean;
}) {
  const [displayValue, setDisplayValue] = useState(0);
  const displayValueRef = useRef(0);
  const animationFrameRef = useRef<number | null>(null);
  const hasAnimatedRef = useRef(false);

  useEffect(() => {
    if (animationFrameRef.current !== null) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }

    const setAnimatedDisplay = (nextValue: number) => {
      displayValueRef.current = nextValue;
      setDisplayValue(nextValue);
    };

    if (!ready) {
      hasAnimatedRef.current = false;
      setAnimatedDisplay(0);
      return;
    }

    const targetValue = Number.isFinite(value) ? Math.max(0, value) : 0;
    const skipAnimation = !window.requestAnimationFrame
      || document.hidden
      || window.matchMedia('(prefers-reduced-motion: reduce)').matches
      || targetValue <= 0;

    if (skipAnimation) {
      hasAnimatedRef.current = true;
      setAnimatedDisplay(targetValue);
      return;
    }

    const startValue = hasAnimatedRef.current ? displayValueRef.current : 0;
    const startTime = performance.now();
    const safeDuration = Math.max(1, duration);

    const animate = (timestamp: number) => {
      const progress = Math.min((timestamp - startTime) / safeDuration, 1);
      const easedProgress = 1 - Math.pow(1 - progress, 3);
      const nextValue = startValue + (targetValue - startValue) * easedProgress;

      setAnimatedDisplay(nextValue);

      if (progress < 1) {
        animationFrameRef.current = requestAnimationFrame(animate);
      } else {
        hasAnimatedRef.current = true;
        setAnimatedDisplay(targetValue);
        animationFrameRef.current = null;
      }
    };

    animationFrameRef.current = requestAnimationFrame(animate);

    return () => {
      if (animationFrameRef.current !== null) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
    };
  }, [value, duration, ready]);

  const formattedValue = decimals 
    ? displayValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    : Math.floor(displayValue).toLocaleString('en-US');

  return (
    <span className="tabular-nums">
      {prefix}{formattedValue}{suffix}
    </span>
  );
}

export default function EngineRoom() {
  const [sources, setSources] = useState<EngineSources>(INITIAL_SOURCES);
  const [rewardKeyType, setRewardKeyType] = useState<RewardKeyType>('genesis');
  const [hypotheticalBytesPrice, setHypotheticalBytesPrice] = useState('');
  const [rewardKeyCount, setRewardKeyCount] = useState('1');
  const [currentTime] = useState(() => Date.now());

  useEffect(() => {
    let cancelled = false;

    const loadData = async () => {
      const [vault, evm, solana, hypercore, nft, supply, holders, rewards] = await Promise.all([
        loadSource('vault', async () => {
          const [text, metadata] = await Promise.all([
            fetchText('/vault-snapshot.csv'),
            fetchJson('/vault-snapshot.meta.json'),
          ]);
          if (!isValidTimestamp(metadata.capturedAt)) throw new Error('Invalid vault capture metadata');
          return { data: parseVaultSnapshot(text), asOf: metadata.capturedAt };
        }, 48 * 60 * 60 * 1000),
        loadSource('evm', async () => parseEvmSnapshot(await fetchJson('/evm-vault-snapshot.json')), 48 * 60 * 60 * 1000),
        loadSource('solana', async () => parseSolanaSnapshot(await fetchJson('/solana-vault-snapshot.json')), 48 * 60 * 60 * 1000),
        loadSource('hypercore', async () => parseHypercoreSnapshot(await fetchJson('/hypercore-vault-snapshot.json')), 48 * 60 * 60 * 1000),
        loadSource('nft', async () => {
          const data = await fetchJson('/api/neo-vault-counts');
          const counts = [data.s1, data.s2, data.items, data.genesis, data.credits, data.coattail];
          if (counts.some((count) => !Number.isInteger(count) || Number(count) < 0) || !Array.isArray(data.assets) || !isValidTimestamp(data.readAt)) {
            throw new Error('Invalid NFT holdings response');
          }
          const assets = data.assets.filter((asset): asset is NftAsset => {
            if (!asset || typeof asset !== 'object' || Array.isArray(asset)) return false;
            const candidate = asset as Record<string, unknown>;
            return ['tokenId', 'collection', 'name', 'image', 'openseaUrl'].every((key) => typeof candidate[key] === 'string');
          });
          return {
            data: { s1: Number(data.s1), s2: Number(data.s2), items: Number(data.items), genesis: Number(data.genesis), credits: Number(data.credits), coattail: Number(data.coattail), assets },
            asOf: data.readAt,
          };
        }),
        loadSource('supply', async () => {
          const data = await fetchJson('/api/exodus-minted');
          if (!Number.isInteger(data.minted) || Number(data.minted) < 0 || Number(data.minted) > TOTAL_EXODUS_SUPPLY || !isValidTimestamp(data.readAt)) {
            throw new Error('Invalid Key supply response');
          }
          return { data: { exodusMinted: Number(data.minted) }, asOf: data.readAt };
        }),
        loadSource('holders', async () => {
          const [text, metadata] = await Promise.all([
            fetchText('/holders-snapshot.csv'),
            fetchJson('/holders-snapshot.meta.json'),
          ]);
          if (!isValidTimestamp(metadata.capturedAt)) throw new Error('Invalid holder capture metadata');
          return { data: parseHolderSnapshot(text), asOf: metadata.capturedAt };
        }, 14 * 24 * 60 * 60 * 1000),
        loadSource('rewards', async () => ({
          data: parseRewardArchive(await Promise.all(PHANTOM_REWARD_FILES.map((file) => fetchText(file)))),
          asOf: PHANTOM_REWARD_ARCHIVE_AT,
        })),
      ]);

      const reconciledEvm: SourceResult<EvmSnapshot> = vault.data && evm.data
        && Math.abs(evm.data.debankReferenceUsd - (vault.data.debank_portfolio_usd || 0)) > 0.01
        ? { status: 'unavailable', data: null, asOf: evm.asOf }
        : evm;

      if (!cancelled) setSources({ vault, evm: reconciledEvm, solana, hypercore, nft, supply, holders, rewards });
    };

    loadData();
    return () => { cancelled = true; };
  }, []);

  const snapshot = sources.vault.data ?? {};
  const evmSnapshot = sources.evm.data;
  const evmAssets = evmSnapshot?.assets ?? [];
  const evmDirectWalletTotal = evmSnapshot?.directWalletTotalUsd ?? 0;
  const solanaSnapshot = sources.solana.data;
  const solanaAssets = solanaSnapshot?.assets ?? [];
  const solanaTotalValue = solanaSnapshot?.totalUsd ?? 0;
  const hypercoreSnapshot = sources.hypercore.data;
  const hypercoreAssets = hypercoreSnapshot?.assets ?? [];
  const hypercoreTotalValue = hypercoreSnapshot?.totalUsd ?? 0;
  const nftHoldings = sources.nft.data;
  const exodusMinted = sources.supply.data?.exodusMinted ?? 0;
  const liberatedSlaves = sources.holders.data?.holderCount ?? 0;
  const rewardArchive = sources.rewards.data;
  const totalVotesCast = rewardArchive?.totalEntries ?? 0;
  const totalPhantomRewards = rewardArchive?.totalRewards ?? 0;

  // Dynamic Total Keys (on-demand Exodus minted count plus fixed Genesis supply)
  const TOTAL_KEYS = TOTAL_GENESIS_KEYS + exodusMinted;
  const vaultValueStatus = combineSourceStatuses(sources.vault, sources.solana, sources.hypercore, sources.nft);
  const totalKeysStatus = sources.supply.status;
  const vaultValuePerKeyStatus = combineSourceStatuses(sources.vault, sources.solana, sources.hypercore, sources.nft, sources.supply);
  const rewardTotalStatus = sources.rewards.status;
  const rewardReferenceStatus = combineSourceStatuses(sources.rewards, sources.vault);
  const holderStatus = sources.holders.status;
  const averageKeysStatus = combineSourceStatuses(sources.holders, sources.supply);
  const participationStatus = combineSourceStatuses(sources.holders, sources.rewards);

  const sourceList = Object.values(sources);
  const loadedSourceCount = sourceList.filter((source) => isSourceUsable(source.status)).length;
  const staleSourceCount = sourceList.filter((source) => source.status === 'stale').length;
  const sourcesLoading = sourceList.some((source) => source.status === 'loading');
  const statusTone = sourcesLoading
    ? 'is-loading'
    : loadedSourceCount === SOURCE_CLASS_COUNT && staleSourceCount === 0 ? 'is-complete' : loadedSourceCount > 0 ? 'is-partial' : 'is-unavailable';
  const statusSummary = sourcesLoading
    ? `LOADING · CHECKING ${SOURCE_CLASS_COUNT} SOURCE CLASSES`
    : loadedSourceCount === 0
      ? 'UNAVAILABLE · NO SOURCE CLASSES LOADED'
      : loadedSourceCount === SOURCE_CLASS_COUNT && staleSourceCount === 0
        ? `AVAILABLE · ${loadedSourceCount} / ${SOURCE_CLASS_COUNT} SOURCE CLASSES LOADED`
        : `PARTIAL · ${loadedSourceCount} / ${SOURCE_CLASS_COUNT} SOURCE CLASSES LOADED${staleSourceCount ? ` · ${staleSourceCount} STALE` : ''}`;

  // Avg Keys per Phantom - calculated from independently captured sources
  const avgKeysPerPhantomCalc = liberatedSlaves > 0
    ? TOTAL_KEYS / liberatedSlaves
    : 0;

  const exodusMintProgress = TOTAL_EXODUS_SUPPLY > 0
    ? (exodusMinted / TOTAL_EXODUS_SUPPLY) * 100
    : 0;

  const voterParticipationRate = liberatedSlaves > 0 && rewardArchive?.uniqueRecipientsByCycle.length
    ? rewardArchive.uniqueRecipientsByCycle.reduce((sum, count) => sum + ((count / liberatedSlaves) * 100), 0) / rewardArchive.uniqueRecipientsByCycle.length
    : 0;

  const daysSinceGenesis = Math.floor((currentTime - GENESIS_LAUNCH) / (1000 * 60 * 60 * 24));

  const neoS1Count = nftHoldings?.s1 ?? 0;
  const neoS2Count = nftHoldings?.s2 ?? 0;
  const neoItemsCount = nftHoldings?.items ?? 0;
  const genesisCount = nftHoldings?.genesis ?? 0;
  const creditsCount = nftHoldings?.credits ?? 0;
  const coattailCount = nftHoldings?.coattail ?? 0;
  const nftAssets = nftHoldings?.assets ?? [];
  const nftValue =
    (neoS1Count * (snapshot.neo_s1_floor_usd || 0)) +
    (neoS2Count * (snapshot.neo_s2_floor_usd || 0)) +
    (neoItemsCount * (snapshot.neo_items_cache_floor_usd || 0)) +
    (genesisCount * (snapshot.grid_genesis_floor_usd || 0)) +
    (creditsCount * (snapshot.credits_floor_usd || 0)) +
    (coattailCount * (snapshot.coattail_brokers_floor_usd || 0));

  const coattailWalletValue = snapshot.coattail_broker_wallet_usd || 0;
  const totalVaultValue = (snapshot.debank_portfolio_usd || 0) + solanaTotalValue + hypercoreTotalValue + nftValue + coattailWalletValue + ((snapshot.veblack_balance || 0) * (snapshot.black_price_usd || 0));

  const vaultValuePerKey = TOTAL_KEYS > 0 ? totalVaultValue / TOTAL_KEYS : 0;

  const airdropUSD = totalPhantomRewards * (snapshot.bytes_price_usd || 0);

  const parsedHypotheticalPrice = Number(hypotheticalBytesPrice);
  const hasHypotheticalPrice = hypotheticalBytesPrice.trim() !== '' && Number.isFinite(parsedHypotheticalPrice) && parsedHypotheticalPrice >= 0;
  const parsedRewardKeyCount = Number(rewardKeyCount);
  const safeRewardKeyCount = Number.isFinite(parsedRewardKeyCount) && parsedRewardKeyCount >= 1
    ? Math.floor(parsedRewardKeyCount)
    : 1;
  const completedRewardsPerKey = COMPLETED_REWARDS_PER_KEY[rewardKeyType];
  const hypotheticalValuePerKey = hasHypotheticalPrice
    ? completedRewardsPerKey * parsedHypotheticalPrice
    : 0;
  const hypotheticalTotalValue = hypotheticalValuePerKey * safeRewardKeyCount;


  return (
    <main className="engine-page">
      <div className="engine-topline" aria-hidden="true" />
      <div className="engine-main">
        <header className="engine-hero">
          <div className="engine-hero-title">
            <p className="engine-kicker">GRID PHANTOMS OPERATIONAL INTELLIGENCE</p>
            <h1><span>Engine</span><em>Room</em></h1>
            <p className="engine-lede">Track the vault. Verify the rewards. Read the rebellion.</p>
            <div className="engine-badges" aria-label="Engine Room coverage">
              <span>VAULT INTELLIGENCE</span><span>REWARD HISTORY</span><span>REBELLION VITALS</span>
            </div>
          </div>
          <div className="engine-snapshot-stamp" aria-live="polite">
            <strong><i className={`engine-status-dot ${statusTone}`} aria-hidden="true" />MIXED-SOURCE STATUS</strong>
            <span>{statusSummary}</span>
            <span>PAGE-LOAD SNAPSHOT · INDEPENDENT CAPTURE TIMES</span>
            <small>Reload to request updated source reads.</small>
          </div>
        </header>

        <details className="engine-source-details">
          <summary><span>VIEW SOURCE &amp; EVIDENCE DETAILS</span><i aria-hidden="true">+</i></summary>
          <div className="engine-source-ledger" aria-label="Engine Room source timestamps">
            <SourceCard label="VAULT REFERENCES" mode="SCHEDULED ARTIFACT" timeKind="CAPTURED" source={sources.vault} />
            <SourceCard label="EVM DIRECT WALLET" mode="FINALIZED ETHEREUM RPC" timeKind="CAPTURED" source={sources.evm} />
            <SourceCard label="SOLANA WALLET" mode="FINALIZED RPC + JUPITER" timeKind="CAPTURED" source={sources.solana} />
            <SourceCard label="HYPERCORE WALLET" mode="HYPERLIQUID SPOT API" timeKind="CAPTURED" source={sources.hypercore} />
            <SourceCard label="NFT HOLDINGS" mode="ON-DEMAND LOOKUP" timeKind="CHECKED" source={sources.nft} />
            <SourceCard label="KEY SUPPLY" mode="ON-DEMAND ONCHAIN INDEX" timeKind="CHECKED" source={sources.supply} />
            <SourceCard label="HOLDER SNAPSHOT" mode="SCHEDULED ARTIFACT" timeKind="CAPTURED" source={sources.holders} />
            <SourceCard label="REWARD ARCHIVE" mode={`VERIFIED THROUGH ${REWARD_HISTORY_THROUGH.toUpperCase()}`} timeKind="OCCURRED" source={sources.rewards} />
          </div>
          <p className="engine-evidence-key" aria-label="Metric classification key">
            <span><b>Observed</b> direct source fact</span>
            <span><b>Calculated</b> deterministic combination</span>
            <span><b>Estimated</b> reference-based valuation</span>
            <span><b>Projected</b> user-entered scenario</span>
          </p>
        </details>

        <section className="engine-section engine-panel" aria-labelledby="vault-heading">
          <div className="engine-section-head">
            <div><p className="engine-eyebrow">01 / VAULT SNAPSHOT</p><h2 id="vault-heading">Vault capital at a glance</h2></div>
            <p>Estimated vault value, current Key supply and the resulting value represented per Key.</p>
          </div>
          <div className="engine-vault-grid">
            <article className="engine-metric engine-metric-primary">
              <div className="engine-metric-topline"><span>VALUE OF SAKURA&apos;S VAULT</span><EvidenceBadge classification="Estimated" /></div>
              <p className="engine-metric-value engine-cyan"><MetricState status={vaultValueStatus}><AnimatedNumber value={totalVaultValue} prefix="$" duration={1800} decimals={true} ready={isSourceUsable(vaultValueStatus)} /></MetricState></p>
              <p className="engine-metric-note">DeBank EVM portfolio, finalized Solana wallet balances, HyperCore spot balances, NFT floor values, Broker wallet tokenized stocks and the veBLACK position.</p>
            </article>
            <article className="engine-metric">
              <div className="engine-metric-topline"><span>TOTAL KEYS</span><EvidenceBadge classification="Calculated" /></div>
              <p className="engine-metric-value"><MetricState status={totalKeysStatus}><AnimatedNumber value={TOTAL_KEYS} duration={1400} decimals={false} ready={isSourceUsable(totalKeysStatus)} /></MetricState></p>
              <p className="engine-metric-unit">GENESIS + MINTED EXODUS</p>
            </article>
            <article className="engine-metric">
              <div className="engine-metric-topline"><span>VALUE PER KEY</span><EvidenceBadge classification="Estimated" /></div>
              <p className="engine-metric-value"><MetricState status={vaultValuePerKeyStatus}><AnimatedNumber value={vaultValuePerKey} prefix="$" duration={1600} decimals={true} ready={isSourceUsable(vaultValuePerKeyStatus)} /></MetricState></p>
              <p className="engine-metric-unit">TOTAL VALUE / TOTAL KEYS</p>
            </article>
          </div>
          <div className="engine-wallet-stack">
            <details className="engine-wallet-shelf" aria-label="Ethereum direct wallet asset breakdown">
              <summary>
                <span className="engine-wallet-summary-copy"><span>EVM DIRECT WALLET</span><small>{sourceStatusLabel(sources.evm.status)} · DIRECT WALLET LOOK-THROUGH</small></span>
                <strong><MetricState status={sources.evm.status}>{formatUsd(evmDirectWalletTotal)}</MetricState></strong>
                <i aria-hidden="true">+</i>
              </summary>
              <div className="engine-wallet-body">
                {sources.evm.status === 'loading' ? (
                  <div className="engine-wallet-state">LOADING FINALIZED ETHEREUM BALANCES…</div>
                ) : sources.evm.status === 'unavailable' ? (
                  <div className="engine-wallet-state is-unavailable">EVM DIRECT WALLET SNAPSHOT UNAVAILABLE</div>
                ) : (
                  <>
                    <div className="engine-wallet-reconciliation" aria-label="EVM and DeBank reconciliation">
                      <div><span>DEBANK EVM REFERENCE</span><strong>{formatUsd(evmSnapshot?.debankReferenceUsd ?? 0)}</strong><small>CONTROLLING EVM TOTAL</small></div>
                      <div><span>DIRECT WALLET COVERAGE</span><strong>{formatUsd(evmDirectWalletTotal)}</strong><small>ALLOWLISTED ASSETS</small></div>
                      <div><span>PROTOCOL + OTHER DELTA</span><strong>{formatUsd(evmSnapshot?.unattributedDeBankUsd ?? 0)}</strong><small>NOT ASSIGNED BY THIS VIEW</small></div>
                    </div>
                    <div className="engine-wallet-actions"><a href={`https://etherscan.io/address/${EVM_WALLET}`} target="_blank" rel="noopener noreferrer">VIEW WALLET ↗</a></div>
                    <div className="engine-wallet-assets">
                      {evmAssets.map((asset) => (
                        <article key={asset.assetId}>
                          <span>{asset.symbol}<small>{asset.assetType === 'native' ? 'NATIVE' : 'ERC-20'}</small></span>
                          <strong>{formatAssetQuantity(asset.quantity)}</strong>
                          <small>{formatUsd(asset.priceUsd)} EACH</small>
                          <b>{formatUsd(asset.marketValueUsd)}</b>
                        </article>
                      ))}
                    </div>
                  </>
                )}
                <p>Finalized Ethereum RPC balances · exact-contract allowlist · mixed-source spot references · INCLUDED IN DEBANK · NOT ADDED AGAIN<br />wTAO is TAO price exposure through a centralized/community bridge wrapper, not canonical native TAO custody</p>
              </div>
            </details>

            <details className="engine-wallet-shelf" aria-label="Solana wallet asset breakdown">
              <summary>
                <span className="engine-wallet-summary-copy"><span>SOLANA WALLET</span><small>{sourceStatusLabel(sources.solana.status)} · FINALIZED DIRECT WALLET</small></span>
                <strong><MetricState status={sources.solana.status}>{formatUsd(solanaTotalValue)}</MetricState></strong>
                <i aria-hidden="true">+</i>
              </summary>
              <div className="engine-wallet-body">
                {sources.solana.status === 'loading' ? (
                  <div className="engine-wallet-state">LOADING FINALIZED BALANCES…</div>
                ) : sources.solana.status === 'unavailable' ? (
                  <div className="engine-wallet-state is-unavailable">SOLANA WALLET SNAPSHOT UNAVAILABLE</div>
                ) : (
                  <>
                    <div className="engine-wallet-actions"><a href={`https://solscan.io/account/${SOLANA_WALLET}`} target="_blank" rel="noopener noreferrer">VIEW WALLET ↗</a></div>
                    <div className="engine-wallet-assets">
                      {solanaAssets.map((asset) => (
                        <article key={asset.assetId}>
                          <span>{asset.symbol}<small>{asset.assetType === 'native' ? 'NATIVE' : 'SPL'}</small></span>
                          <strong>{formatAssetQuantity(asset.quantity)}</strong>
                          <small>{formatUsd(asset.priceUsd)} EACH</small>
                          <b>{formatUsd(asset.marketValueUsd)}</b>
                        </article>
                      ))}
                    </div>
                  </>
                )}
                <p>Finalized read-only balances · canonical mint allowlist · live Jupiter prices · independently verified</p>
              </div>
            </details>

            <details className="engine-wallet-shelf" aria-label="HyperCore spot asset breakdown">
              <summary>
                <span className="engine-wallet-summary-copy"><span>HYPERCORE SPOT WALLET</span><small>{sourceStatusLabel(sources.hypercore.status)} · VERIFIED SPOT BALANCES</small></span>
                <strong><MetricState status={sources.hypercore.status}>{formatUsd(hypercoreTotalValue)}</MetricState></strong>
                <i aria-hidden="true">+</i>
              </summary>
              <div className="engine-wallet-body">
                {sources.hypercore.status === 'loading' ? (
                  <div className="engine-wallet-state">LOADING VERIFIED SPOT BALANCES…</div>
                ) : sources.hypercore.status === 'unavailable' ? (
                  <div className="engine-wallet-state is-unavailable">HYPERCORE WALLET SNAPSHOT UNAVAILABLE</div>
                ) : (
                  <>
                    <div className="engine-wallet-actions"><a href={`https://app.hyperliquid.xyz/portfolio/${HYPERCORE_WALLET}`} target="_blank" rel="noopener noreferrer">VIEW WALLET ↗</a></div>
                    <div className="engine-wallet-assets">
                      {hypercoreAssets.map((asset) => (
                        <article key={asset.assetId}>
                          <span>{asset.symbol}<small>SPOT · TOKEN {asset.tokenIndex}</small></span>
                          <strong>{formatAssetQuantity(asset.quantity)}</strong>
                          <small>{formatUsd(asset.priceUsd)} EACH</small>
                          <b>{formatUsd(asset.marketValueUsd)}</b>
                        </article>
                      ))}
                    </div>
                  </>
                )}
                <p>Read-only Hyperliquid spot clearinghouse balances · HYPE token index 150 · HYPE/USDC market @107 · independently verified</p>
              </div>
            </details>
          </div>
        </section>

        <section className="engine-section engine-panel" aria-labelledby="rewards-heading">
          <div className="engine-section-head">
            <div><p className="engine-eyebrow">02 / PHANTOM REWARD HISTORY</p><h2 id="rewards-heading">Completed distributions, in context</h2></div>
            <p>Historical discretionary distributions and their estimated USD value using the BYTES price in the vault snapshot.</p>
          </div>
          <div className="engine-reward-grid">
            <article className="engine-metric">
              <div className="engine-metric-topline"><span>REWARDS DISTRIBUTED</span><EvidenceBadge classification="Calculated" /></div>
              <p className="engine-metric-value"><MetricState status={rewardTotalStatus}>{totalPhantomRewards.toLocaleString('en-US', { maximumFractionDigits: 1 })}</MetricState></p><p className="engine-metric-unit">$BYTES DISTRIBUTED THROUGH {REWARD_HISTORY_THROUGH.toUpperCase()}</p>
            </article>
            <article className="engine-metric">
              <div className="engine-metric-topline"><span>ESTIMATED USD VALUE</span><EvidenceBadge classification="Estimated" /></div>
              <p className="engine-metric-value"><MetricState status={rewardReferenceStatus}>${Math.round(airdropUSD).toLocaleString()}</MetricState></p><p className="engine-metric-unit">TOTAL BYTES × SNAPSHOT PRICE</p>
            </article>
          </div>
          <div className="engine-cycle-brief" aria-labelledby="latest-cycle-heading">
            <div className="engine-cycle-brief-head">
              <div>
                <span>LATEST COMPLETED GRID CYCLE</span>
                <h3 id="latest-cycle-heading">{LATEST_GRID_CYCLE.cycle} mandate and distribution</h3>
              </div>
              <a href={LATEST_GRID_CYCLE.proposalUrl} target="_blank" rel="noopener noreferrer">VIEW VERIFIED VOTE ↗</a>
            </div>
            <div className="engine-cycle-result">
              <div className="engine-cycle-winner">
                <span>WINNING MANDATE</span>
                <strong>{LATEST_GRID_CYCLE.winner}</strong>
                <small>{LATEST_GRID_CYCLE.winnerGp} · {LATEST_GRID_CYCLE.winnerShare} · runner-up {LATEST_GRID_CYCLE.runnerUp} at {LATEST_GRID_CYCLE.runnerUpGp}</small>
              </div>
              <dl className="engine-cycle-stats">
                <div><dt>PARTICIPATION</dt><dd>{LATEST_GRID_CYCLE.participatingWallets}</dd><small>36 PARTICIPATING WALLETS</small></div>
                <div><dt>VOTING POWER</dt><dd>{LATEST_GRID_CYCLE.totalGp}</dd><small>754 GP</small></div>
                <div><dt>SNAPSHOT BLOCK</dt><dd>{LATEST_GRID_CYCLE.snapshotBlock}</dd><small>ETHEREUM</small></div>
                <div><dt>QUALIFYING KEYS</dt><dd>{LATEST_GRID_CYCLE.genesisKeys + LATEST_GRID_CYCLE.exodusKeys}</dd><small>{LATEST_GRID_CYCLE.genesisKeys} GENESIS · {LATEST_GRID_CYCLE.exodusKeys} EXODUS</small></div>
              </dl>
            </div>
            <div className="engine-cycle-allocation">
              <div><span>PER-KEY BASE RATES</span><strong>{LATEST_GRID_CYCLE.genesisRate} GENESIS · {LATEST_GRID_CYCLE.exodusRate} EXODUS</strong></div>
              <div><span>BASE REWARDS</span><strong>{LATEST_GRID_CYCLE.baseBytes} BASE</strong></div>
              <div><span>FIRST HAZARD SUPPORT</span><strong>{LATEST_GRID_CYCLE.hazardBytes} HAZARD SUPPORT</strong><small>30 WALLETS RECEIVED POSITIVE SUPPORT</small></div>
              <div className="is-total"><span>VERIFIED DISTRIBUTION</span><strong>{LATEST_GRID_CYCLE.totalBytes} BYTES</strong></div>
            </div>
            <p className="engine-cycle-note">Hazard Support is wallet-level and is not included in the per-Key simulator. It was applied once under the cycle&apos;s fixed Clearance schedule after participation qualified; future potential Phantom Rewards remain discretionary and are never guaranteed.</p>
          </div>
          <a href={`https://snowtrace.io/tx/${LATEST_REWARD_PROOF.hash}`} target="_blank" rel="noopener noreferrer" className="engine-proof-link">
            <span className="engine-proof-status">LATEST VERIFIED DISTRIBUTION</span>
            <span className="engine-proof-copy"><strong>{LATEST_REWARD_PROOF.cycle} Grid Cycle potential Phantom Rewards</strong><small><time dateTime={LATEST_REWARD_PROOF.occurredAt}>{LATEST_REWARD_PROOF.distributed} · {formatUtcTime(LATEST_REWARD_PROOF.occurredAt)}</time> · {LATEST_REWARD_PROOF.bytes} BYTES · {LATEST_REWARD_PROOF.transfers} transfers</small></span>
            <b aria-hidden="true">↗</b>
          </a>
          <details className="engine-proof-shelf">
            <summary><span>HISTORICAL PROOF ARCHIVE</span><strong>VIEW {EARLIER_REWARD_PROOFS.length} EARLIER PROOFS</strong><i aria-hidden="true">+</i></summary>
            <div className="engine-proof-archive">
              {EARLIER_REWARD_PROOFS.map((proof) => (
                <a key={proof.hash} href={`https://snowtrace.io/tx/${proof.hash}`} target="_blank" rel="noopener noreferrer">
                  <span><strong>{proof.cycle} Grid Cycle</strong><small><time dateTime={proof.occurredAt}>{proof.distributed} · {formatUtcTime(proof.occurredAt)}</time></small></span>
                  <span><strong>{proof.bytes} BYTES</strong><small>{proof.transfers} transfers · Snowtrace ↗</small></span>
                </a>
              ))}
            </div>
          </details>
        </section>

        <section className="engine-section engine-panel engine-simulator" aria-labelledby="simulator-heading">
          <div className="engine-section-head">
            <div><p className="engine-eyebrow">03 / REWARD VALUE SIMULATOR</p><h2 id="simulator-heading">Model completed per-Key rewards</h2></div>
            <p>Choose a Key type and hypothetical BYTES price to explore completed historical per-Key base reward value.</p>
          </div>
          <div className="engine-simulator-grid">
            <div className="engine-control-panel">
              <fieldset><legend>KEY TYPE</legend><div className="engine-segmented">
                {(['genesis', 'exodus'] as RewardKeyType[]).map((keyType) => (
                  <button key={keyType} type="button" aria-pressed={rewardKeyType === keyType} onClick={() => setRewardKeyType(keyType)} className={rewardKeyType === keyType ? 'is-active' : ''}>
                    {keyType === 'genesis' ? 'Genesis Key' : 'Exodus Key'}
                  </button>
                ))}
              </div></fieldset>
              <div className="engine-input-grid">
                <label htmlFor="hypothetical-bytes-price"><span>HYPOTHETICAL BYTES PRICE</span><span className="engine-input-wrap"><b aria-hidden="true">$</b>
                  <input id="hypothetical-bytes-price" type="number" inputMode="decimal" min="0" step="any" value={hypotheticalBytesPrice} onChange={(event) => setHypotheticalBytesPrice(event.target.value)} placeholder="Enter any price" />
                </span></label>
                <label htmlFor="reward-key-count"><span>KEYS HELD</span>
                  <input id="reward-key-count" type="number" inputMode="numeric" min="1" step="1" value={rewardKeyCount} onChange={(event) => { const nextValue = event.target.value; if (nextValue === '' || /^\d+$/.test(nextValue)) setRewardKeyCount(nextValue); }} />
                </label>
              </div>
              <p className="engine-source-note">Snapshot BYTES price: <MetricState status={sources.vault.status}>{formatUsd(snapshot.bytes_price_usd || 0)}</MetricState></p>
            </div>
            <div className="engine-output-panel" aria-live="polite">
              <div className="engine-output-grid">
                <div><div className="engine-output-heading"><span>REWARDS PER KEY</span><EvidenceBadge classification="Calculated" /></div><strong>{completedRewardsPerKey.toLocaleString()}</strong><small>BYTES</small></div>
                <div><div className="engine-output-heading"><span>VALUE PER KEY</span><EvidenceBadge classification="Projected" /></div><strong className="engine-violet">{hasHypotheticalPrice ? formatUsd(hypotheticalValuePerKey) : '—'}</strong><small>{hasHypotheticalPrice ? `AT $${hypotheticalBytesPrice} PER BYTES` : 'ENTER ANY BYTES PRICE'}</small></div>
              </div>
              <div className="engine-output-total"><span>{`TOTAL ACROSS ${safeRewardKeyCount.toLocaleString()} ${safeRewardKeyCount === 1 ? 'KEY' : 'KEYS'}`}</span><EvidenceBadge classification="Projected" /><strong>{hasHypotheticalPrice ? formatUsd(hypotheticalTotalValue) : '—'}</strong></div>
            </div>
          </div>
          <p className="engine-disclaimer">Completed distributions through {REWARD_HISTORY_THROUGH} only. Wallet-level Hazard Support is excluded from per-Key modeling. User-entered prices are hypothetical and are not forecasts. Phantom Rewards are discretionary and never guaranteed.</p>
        </section>

        <section className="engine-section engine-panel" aria-labelledby="vitals-heading">
          <div className="engine-section-head">
            <div><p className="engine-eyebrow">04 / REBELLION VITALS</p><h2 id="vitals-heading">Participation and project activity</h2></div>
            <p>A compact operational read on holders, reward participation, mint progress and time in the Grid.</p>
          </div>
          <div className="engine-vitals-grid">
            <article><span>LIBERATED SLAVES</span><EvidenceBadge classification="Observed" /><strong><MetricState status={holderStatus}>{liberatedSlaves.toLocaleString()}</MetricState></strong><small>UNIQUE WALLETS</small></article>
            <article><span>TOTAL VOTES CAST</span><EvidenceBadge classification="Calculated" /><strong><MetricState status={rewardTotalStatus}>{totalVotesCast.toLocaleString()}</MetricState></strong><small>ACROSS 11 CYCLES</small></article>
            <article><span>AVG. KEYS PER PHANTOM</span><EvidenceBadge classification="Calculated" /><strong><MetricState status={averageKeysStatus}>{avgKeysPerPhantomCalc.toFixed(2)}</MetricState></strong><small>KEYS / HOLDER</small></article>
            <article><span>EXODUS MINT PROGRESS</span><EvidenceBadge classification="Calculated" /><strong className="engine-cyan"><MetricState status={totalKeysStatus}>{exodusMintProgress.toFixed(2)}%</MetricState></strong><small>OF 3,333 SUPPLY</small></article>
            <article><span>AVG. VOTER PARTICIPATION</span><EvidenceBadge classification="Calculated" /><strong className="engine-cyan"><MetricState status={participationStatus}>{voterParticipationRate.toFixed(1)}%</MetricState></strong><small>VS CURRENT HOLDERS</small></article>
            <article><span>DAYS SINCE GENESIS</span><EvidenceBadge classification="Calculated" /><strong className="engine-cyan">{daysSinceGenesis}</strong><small>SINCE FIRST MINT</small></article>
          </div>
        </section>

        <section className="engine-section engine-panel engine-holdings" aria-labelledby="holdings-heading">
          <div className="engine-section-head">
            <div><p className="engine-eyebrow">05 / NFT HOLDINGS</p><h2 id="holdings-heading">NFTs held by Sakura&apos;s Vault</h2></div>
            <p>Various NFT assets held in Sakura&apos;s Vault. Select any tile to inspect the asset on OpenSea.</p>
          </div>
          {sources.nft.status === 'loading' ? (
            <div className="engine-holdings-state">LOADING NFT HOLDINGS…</div>
          ) : sources.nft.status === 'unavailable' ? (
            <div className="engine-holdings-state is-unavailable">NFT HOLDINGS UNAVAILABLE</div>
          ) : nftAssets.length === 0 ? (
            <div className="engine-holdings-state">NO NFT HOLDINGS FOUND</div>
          ) : (
            <div className="engine-holdings-grid">
              {nftAssets.map((asset) => (
                <a key={`${asset.collection}-${asset.tokenId}`} className="engine-holding-card" href={asset.openseaUrl} target="_blank" rel="noopener noreferrer">
                  <span className="engine-holding-art">
                    {asset.image ? <img src={asset.image} alt={asset.name} loading="lazy" decoding="async" /> : <span>ART UNAVAILABLE</span>}
                  </span>
                  <span className="engine-holding-copy"><small>{asset.collection}</small><strong>{asset.name}</strong><em>VIEW ASSET ↗</em></span>
                </a>
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
