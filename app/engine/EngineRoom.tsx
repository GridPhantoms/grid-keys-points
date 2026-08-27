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
type NeoAsset = {
  tokenId: string;
  collection: string;
  name: string;
  image: string;
  openseaUrl: string;
};
type NeoHoldings = { s1: number; s2: number; items: number; assets: NeoAsset[] };
type KeySupply = { exodusMinted: number };
type HolderSnapshot = { holderCount: number };
type RewardArchive = {
  totalRewards: number;
  totalEntries: number;
  uniqueRecipientsByCycle: number[];
};

type EngineSources = {
  vault: SourceResult<VaultSnapshot>;
  neo: SourceResult<NeoHoldings>;
  supply: SourceResult<KeySupply>;
  holders: SourceResult<HolderSnapshot>;
  rewards: SourceResult<RewardArchive>;
};

const SOURCE_CLASS_COUNT = 5;
const SOURCE_TIMEOUT_MS = 12_000;

const TOTAL_GENESIS_KEYS = 555;
const TOTAL_EXODUS_SUPPLY = 3333;
const GENESIS_LAUNCH = new Date('2025-10-09T16:03:47Z').getTime();


const loadingSource = <T,>(): SourceResult<T> => ({ status: 'loading', data: null, asOf: null });

const INITIAL_SOURCES: EngineSources = {
  vault: loadingSource<VaultSnapshot>(),
  neo: loadingSource<NeoHoldings>(),
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
] as const;

const COMPLETED_REWARDS_PER_KEY = COMPLETED_REWARD_HISTORY.reduce(
  (totals, reward) => ({
    genesis: totals.genesis + reward.genesis,
    exodus: totals.exodus + reward.exodus,
  }),
  { genesis: 0, exodus: 0 }
);

const REWARD_HISTORY_THROUGH = COMPLETED_REWARD_HISTORY.at(-1)?.cycle ?? '';

const REWARD_PROOFS = [
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
  return typeof value === 'string' && Number.isFinite(Date.parse(value));
}

async function fetchResponse(path: string) {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), SOURCE_TIMEOUT_MS);
  try {
    return await fetch(path, { cache: 'no-store', signal: controller.signal });
  } finally {
    window.clearTimeout(timeout);
  }
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
  ];
  if (required.some((key) => !Number.isFinite(snapshot[key]))) throw new Error('Incomplete vault snapshot');
  return snapshot;
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

    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      hasAnimatedRef.current = true;
      setAnimatedDisplay(targetValue);
      return;
    }

    if (targetValue <= 0) {
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
      const [vault, neo, supply, holders, rewards] = await Promise.all([
        loadSource('vault', async () => {
          const [text, metadata] = await Promise.all([
            fetchText('/vault-snapshot.csv'),
            fetchJson('/vault-snapshot.meta.json'),
          ]);
          if (!isValidTimestamp(metadata.capturedAt)) throw new Error('Invalid vault capture metadata');
          return { data: parseVaultSnapshot(text), asOf: metadata.capturedAt };
        }, 48 * 60 * 60 * 1000),
        loadSource('neo', async () => {
          const data = await fetchJson('/api/neo-vault-counts');
          const counts = [data.s1, data.s2, data.items];
          if (counts.some((count) => !Number.isInteger(count) || Number(count) < 0) || !Array.isArray(data.assets) || !isValidTimestamp(data.readAt)) {
            throw new Error('Invalid Neo holdings response');
          }
          const assets = data.assets.filter((asset): asset is NeoAsset => {
            if (!asset || typeof asset !== 'object' || Array.isArray(asset)) return false;
            const candidate = asset as Record<string, unknown>;
            return ['tokenId', 'collection', 'name', 'image', 'openseaUrl'].every((key) => typeof candidate[key] === 'string');
          });
          return {
            data: { s1: Number(data.s1), s2: Number(data.s2), items: Number(data.items), assets },
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

      if (!cancelled) setSources({ vault, neo, supply, holders, rewards });
    };

    loadData();
    return () => { cancelled = true; };
  }, []);

  const snapshot = sources.vault.data ?? {};
  const neoHoldings = sources.neo.data;
  const exodusMinted = sources.supply.data?.exodusMinted ?? 0;
  const liberatedSlaves = sources.holders.data?.holderCount ?? 0;
  const rewardArchive = sources.rewards.data;
  const totalVotesCast = rewardArchive?.totalEntries ?? 0;
  const totalPhantomRewards = rewardArchive?.totalRewards ?? 0;

  // Dynamic Total Keys (on-demand Exodus minted count plus fixed Genesis supply)
  const TOTAL_KEYS = TOTAL_GENESIS_KEYS + exodusMinted;
  const vaultValueStatus = combineSourceStatuses(sources.vault, sources.neo);
  const totalKeysStatus = sources.supply.status;
  const vaultValuePerKeyStatus = combineSourceStatuses(sources.vault, sources.neo, sources.supply);
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

  const neoS1Count = neoHoldings?.s1 ?? 0;
  const neoS2Count = neoHoldings?.s2 ?? 0;
  const neoItemsCount = neoHoldings?.items ?? 0;
  const neoAssets = neoHoldings?.assets ?? [];
  const neoValue =
    (neoS1Count * (snapshot.neo_s1_floor_usd || 0)) +
    (neoS2Count * (snapshot.neo_s2_floor_usd || 0)) +
    (neoItemsCount * (snapshot.neo_items_cache_floor_usd || 0));

  const totalVaultValue = (snapshot.debank_portfolio_usd || 0) + neoValue + ((snapshot.veblack_balance || 0) * (snapshot.black_price_usd || 0));

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
            <SourceCard label="NEO TOKYO HOLDINGS" mode="ON-DEMAND LOOKUP" timeKind="CHECKED" source={sources.neo} />
            <SourceCard label="KEY SUPPLY" mode="ON-DEMAND ONCHAIN INDEX" timeKind="CHECKED" source={sources.supply} />
            <SourceCard label="HOLDER SNAPSHOT" mode="SCHEDULED ARTIFACT" timeKind="CAPTURED" source={sources.holders} />
            <SourceCard label="REWARD ARCHIVE" mode="VERIFIED THROUGH JULY 2026" timeKind="OCCURRED" source={sources.rewards} />
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
              <p className="engine-metric-note">DeBank portfolio, Neo Tokyo asset values and the veBLACK position.</p>
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
          <a href={`https://snowtrace.io/tx/${LATEST_REWARD_PROOF.hash}`} target="_blank" rel="noopener noreferrer" className="engine-proof-link">
            <span className="engine-proof-status">LATEST VERIFIED DISTRIBUTION</span>
            <span className="engine-proof-copy"><strong>{LATEST_REWARD_PROOF.cycle} Grid Cycle potential Phantom Rewards</strong><small><time dateTime={LATEST_REWARD_PROOF.occurredAt}>{LATEST_REWARD_PROOF.distributed} · {formatUtcTime(LATEST_REWARD_PROOF.occurredAt)}</time> · {LATEST_REWARD_PROOF.bytes} BYTES · {LATEST_REWARD_PROOF.transfers} transfers</small></span>
            <b aria-hidden="true">↗</b>
          </a>
          <details className="engine-proof-shelf">
            <summary><span>HISTORICAL PROOF ARCHIVE</span><strong>VIEW 9 EARLIER PROOFS</strong><i aria-hidden="true">+</i></summary>
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
            <p>Choose a Key type and hypothetical BYTES price to explore completed historical reward value.</p>
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
          <p className="engine-disclaimer">Completed distributions through {REWARD_HISTORY_THROUGH} only. User-entered prices are hypothetical and are not forecasts. Phantom Rewards are discretionary and never guaranteed.</p>
        </section>

        <section className="engine-section engine-panel" aria-labelledby="vitals-heading">
          <div className="engine-section-head">
            <div><p className="engine-eyebrow">04 / REBELLION VITALS</p><h2 id="vitals-heading">Participation and project activity</h2></div>
            <p>A compact operational read on holders, reward participation, mint progress and time in the Grid.</p>
          </div>
          <div className="engine-vitals-grid">
            <article><span>LIBERATED SLAVES</span><EvidenceBadge classification="Observed" /><strong><MetricState status={holderStatus}>{liberatedSlaves.toLocaleString()}</MetricState></strong><small>UNIQUE WALLETS</small></article>
            <article><span>TOTAL VOTES CAST</span><EvidenceBadge classification="Calculated" /><strong><MetricState status={rewardTotalStatus}>{totalVotesCast.toLocaleString()}</MetricState></strong><small>ACROSS 10 CYCLES</small></article>
            <article><span>AVG. KEYS PER PHANTOM</span><EvidenceBadge classification="Calculated" /><strong><MetricState status={averageKeysStatus}>{avgKeysPerPhantomCalc.toFixed(2)}</MetricState></strong><small>KEYS / HOLDER</small></article>
            <article><span>EXODUS MINT PROGRESS</span><EvidenceBadge classification="Calculated" /><strong className="engine-cyan"><MetricState status={totalKeysStatus}>{exodusMintProgress.toFixed(2)}%</MetricState></strong><small>OF 3,333 SUPPLY</small></article>
            <article><span>AVG. VOTER PARTICIPATION</span><EvidenceBadge classification="Calculated" /><strong className="engine-cyan"><MetricState status={participationStatus}>{voterParticipationRate.toFixed(1)}%</MetricState></strong><small>VS CURRENT HOLDERS</small></article>
            <article><span>DAYS SINCE GENESIS</span><EvidenceBadge classification="Calculated" /><strong className="engine-cyan">{daysSinceGenesis}</strong><small>SINCE FIRST MINT</small></article>
          </div>
        </section>

        <section className="engine-section engine-panel engine-holdings" aria-labelledby="holdings-heading">
          <div className="engine-section-head">
            <div><p className="engine-eyebrow">05 / NEO TOKYO HOLDINGS</p><h2 id="holdings-heading">NFTs held by Sakura&apos;s Vault</h2></div>
            <p>Current Neo Tokyo NFTs detected in the vault wallet. Select any tile to inspect the asset on OpenSea.</p>
          </div>
          {sources.neo.status === 'loading' ? (
            <div className="engine-holdings-state">LOADING NEO TOKYO HOLDINGS…</div>
          ) : sources.neo.status === 'unavailable' ? (
            <div className="engine-holdings-state is-unavailable">NEO TOKYO HOLDINGS UNAVAILABLE</div>
          ) : neoAssets.length === 0 ? (
            <div className="engine-holdings-state">NO NEO TOKYO HOLDINGS FOUND</div>
          ) : (
            <div className="engine-holdings-grid">
              {neoAssets.map((asset) => (
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
