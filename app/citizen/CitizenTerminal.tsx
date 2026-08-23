'use client';

import { FormEvent, useEffect, useState } from 'react';
import { calculateStakingPoints, getStakingBytesCap, S1_CREDIT_YIELD_POINTS, S1_LOCK_MULTIPLIERS, S1_VAULT_MULTIPLIERS, S2_LOCK_MULTIPLIERS, type CitizenSeason } from '@/lib/citizen-terminal';
import { calculateImpliedValuation, type ValuationMethod } from '@/lib/citizen-valuation';

type Trait = { label: string; value: string };
type Component = { label: string; tokenId: string | null; name: string; rank: number | null; rarityScore: number | null; componentScore: number | null; imageUrl: string | null; traits: Trait[] };
type Lookup = {
  season: CitizenSeason; tokenId: string; name: string; imageUrl: string | null; rank: number | null; rarityScore: number | null;
  estimatedRank?: number | null; estimatedRankStatus?: 'available' | 'unavailable'; estimatedRankSource?: string; estimatedRankAsOf?: string; estimatedRankUrl?: string;
  elite: boolean; rewardRate: number | null; traits: Trait[]; components: Component[];
  calculatorPreset: { creditYield?: string; creditMultiplier?: string }; notices?: string[]; sources: string[];
};
type CollectionFloor = { key: string; season: 'S1' | 'S2'; label: string; floorEth: number | null; owners: number | null; sales24h: number | null; url: string };
type EliteListing = { tokenId: string; name: string; imageUrl: string | null; rank: number; rarityScore: number; priceEth: number | null; priceUsd: number | null; rewardRate: string | null; url: string };
type ValuationRow = { key: string; season: 'S1' | 'S2'; label: string; url: string; supply: number | null; supplyBreakdown: { legacyExternal: number; v2External?: number; v2Active?: number; economicallyDistinct: number } | null; floorEth: number | null; offerEth: number | null; offerQuantity: number | null; offerCount: number | null };
type Market = {
  asOf: string; ethUsd: number | null; collections: CollectionFloor[]; s1ListingCount: number | string; eliteListings: EliteListing[]; notes: string[];
  sourceTimes?: { listingsAsOf: string; offersAsOf: string; rankingsAsOf: string; supplyAsOf: string };
  valuation: { classification: 'estimated'; sourceBlock: number; sourceBlockHash: string; blockAsOf: string; totalCollections: number; rows: ValuationRow[]; methodology: string };
};
type BytesMetrics = {
  generatedAt?: string; sourceBlock?: number;
  metrics?: {
    bytesPriceUsd?: { value?: number; asOf?: string; availability?: string };
    totalSupplyValuationUsd?: { value?: number; asOf?: string; availability?: string };
  };
};
type RewardRates = {
  availability: 'available'; asOf: string; blockNumber: number; source: string;
  pools: Array<{ pool: 'S1' | 'S2'; netBytesPerPointPerDay: number; currentEmissionBytesPerDay: number; totalDisplayPoints: number; daoTaxBps: number }>;
};

const formatNumber = (value: number | null | undefined, digits = 2) => value == null || !Number.isFinite(value)
  ? '—'
  : value.toLocaleString('en-US', { maximumFractionDigits: digits });
const formatUsd = (value: number | null | undefined) => value == null || !Number.isFinite(value)
  ? '—'
  : value.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: value < 1 ? 4 : 0 });
const formatCompactUsd = (value: number | null | undefined) => value == null || !Number.isFinite(value)
  ? '—'
  : new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', notation: 'compact', maximumFractionDigits: 2 }).format(value);
const formatSnapshotAge = (value: number | null, now: number | null) => {
  if (value == null || now == null) return 'connecting';
  const minutes = Math.max(0, Math.floor((now - value) / 60_000));
  if (minutes < 1) return 'less than 1 min ago';
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  return `${hours} hr${hours === 1 ? '' : 's'} ago`;
};
const S1_FLOOR_ORDER = ['s1-citizens', 's1-elite', 's1-identities', 's1-vaults', 's1-items', 's1-lands'];

function SectionHeading({ eyebrow, title, detail }: { eyebrow: string; title: string; detail: string }) {
  return <div className="ct-section-heading"><p>{eyebrow}</p><h2>{title}</h2><span>{detail}</span></div>;
}

export default function CitizenTerminal() {
  const [lookupSeason, setLookupSeason] = useState<CitizenSeason>('s1');
  const [stakingSeason, setStakingSeason] = useState<CitizenSeason>('s1');
  const [tokenId, setTokenId] = useState('3099');
  const [lookup, setLookup] = useState<Lookup | null>(null);
  const [lookupLoading, setLookupLoading] = useState(false);
  const [lookupError, setLookupError] = useState('');
  const [market, setMarket] = useState<Market | null>(null);
  const [marketError, setMarketError] = useState('');
  const [bytesPrice, setBytesPrice] = useState<number | null>(null);
  const [bytesMarketCap, setBytesMarketCap] = useState<number | null>(null);
  const [bytesMarketAsOf, setBytesMarketAsOf] = useState<string | null>(null);
  const [bytesSourceBlock, setBytesSourceBlock] = useState<number | null>(null);
  const [valuationMethod, setValuationMethod] = useState<ValuationMethod>('floor');
  const [rewardRates, setRewardRates] = useState<RewardRates | null>(null);
  const [creditYield, setCreditYield] = useState('Low');
  const [vaultMultiplier, setVaultMultiplier] = useState('None');
  const [s1LockPeriod, setS1LockPeriod] = useState('12 months');
  const [s2LockPeriod, setS2LockPeriod] = useState('12 months');
  const [s1BytesStaked, setS1BytesStaked] = useState('1000');
  const [s2BytesStaked, setS2BytesStaked] = useState('200');
  const [s1CitizenPriceEth, setS1CitizenPriceEth] = useState<string | null>(null);
  const [s2CitizenPriceEth, setS2CitizenPriceEth] = useState<string | null>(null);
  const [s1HasVault, setS1HasVault] = useState<boolean | undefined>(undefined);
  const [targetBytesPrice, setTargetBytesPrice] = useState('');
  const [snapshotNow, setSnapshotNow] = useState<number | null>(null);

  useEffect(() => {
    const initial = window.setTimeout(() => setSnapshotNow(Date.now()), 0);
    const timer = window.setInterval(() => setSnapshotNow(Date.now()), 60_000);
    return () => { window.clearTimeout(initial); window.clearInterval(timer); };
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    const aborted = (error: unknown) => error instanceof DOMException && error.name === 'AbortError';

    fetch('/api/citizen-terminal/market', { signal: controller.signal, cache: 'no-store' })
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.error ?? 'Market data unavailable');
        setMarket(data as Market);
      })
      .catch((error) => { if (!aborted(error)) setMarketError(error instanceof Error ? error.message : 'Market data unavailable'); });

    fetch('/api/citizen-terminal/reward-rate', { signal: controller.signal, cache: 'no-store' })
      .then(async (response) => { if (response.ok) setRewardRates(await response.json() as RewardRates); })
      .catch((error) => { if (!aborted(error)) console.error('Reward-rate request failed.'); });

    fetch('/api/bytes-metrics', { signal: controller.signal })
      .then(async (response) => response.ok ? response.json() as Promise<BytesMetrics> : null)
      .then((bytesData) => {
        const spot = bytesData?.metrics?.bytesPriceUsd?.value;
        const marketCap = bytesData?.metrics?.totalSupplyValuationUsd?.value;
        if (typeof spot === 'number' && Number.isFinite(spot)) setBytesPrice(spot);
        if (typeof marketCap === 'number' && Number.isFinite(marketCap)) {
          setBytesMarketCap(marketCap);
          setBytesMarketAsOf(bytesData?.metrics?.totalSupplyValuationUsd?.asOf ?? bytesData?.generatedAt ?? null);
          setBytesSourceBlock(typeof bytesData?.sourceBlock === 'number' ? bytesData.sourceBlock : null);
        }
      })
      .catch((error) => { if (!aborted(error)) console.error('BYTES spot request failed.'); });

    return () => controller.abort();
  }, []);

  const performLookup = async (event?: FormEvent) => {
    event?.preventDefault();
    if (!/^\d+$/.test(tokenId.trim())) { setLookupError('Enter a valid Citizen number.'); return; }
    const requestedSeason = lookupSeason;
    setLookupLoading(true); setLookupError(''); setLookup(null);
    try {
      const response = await fetch(`/api/citizen-terminal/lookup?season=${requestedSeason}&tokenId=${encodeURIComponent(tokenId.trim())}`, { cache: 'no-store' });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? 'Citizen lookup failed');
      const result = data as Lookup;
      setLookup(result);
      setStakingSeason(result.season);
      if (result.season === 's1') {
        const hasVault = result.components.some((component) => component.label === 'Vault Card' && component.tokenId != null && component.tokenId !== '0');
        setS1HasVault(hasVault);
        if (result.calculatorPreset.creditYield) setCreditYield(result.calculatorPreset.creditYield);
        if (result.calculatorPreset.creditMultiplier) setVaultMultiplier(result.calculatorPreset.creditMultiplier);
        if (!hasVault) setS1BytesStaked((value) => String(Math.min(Number(value) || 0, getStakingBytesCap('s1', false))));
      }
    } catch (error) {
      setLookup(null); setLookupError(error instanceof Error ? error.message : 'Citizen lookup failed');
    } finally { setLookupLoading(false); }
  };

  const lockPeriod = stakingSeason === 's1' ? s1LockPeriod : s2LockPeriod;
  const bytesStaked = stakingSeason === 's1' ? s1BytesStaked : s2BytesStaked;
  const setActiveLockPeriod = stakingSeason === 's1' ? setS1LockPeriod : setS2LockPeriod;
  const setActiveBytesStaked = stakingSeason === 's1' ? setS1BytesStaked : setS2BytesStaked;
  const citizenFloor = market?.collections.find((row) => row.key === `${stakingSeason}-citizens`)?.floorEth ?? null;
  const citizenPriceOverride = stakingSeason === 's1' ? s1CitizenPriceEth : s2CitizenPriceEth;
  const setActiveCitizenPriceEth = stakingSeason === 's1' ? setS1CitizenPriceEth : setS2CitizenPriceEth;
  const citizenPriceInput = citizenPriceOverride ?? (citizenFloor == null ? '' : String(citizenFloor));
  const parsedCitizenPriceEth = Number(citizenPriceInput);
  const citizenPriceEth = citizenPriceInput.trim() !== '' && Number.isFinite(parsedCitizenPriceEth) && parsedCitizenPriceEth >= 0
    ? parsedCitizenPriceEth
    : null;
  const citizenPriceIsCustom = citizenPriceOverride !== null;
  const parsedBytes = Number(bytesStaked);
  const bytesCap = getStakingBytesCap(stakingSeason, stakingSeason === 's1' ? s1HasVault : false);
  const bytesOverCap = Number.isFinite(parsedBytes) && parsedBytes > bytesCap;
  const points = calculateStakingPoints({ season: stakingSeason, creditYield, vaultMultiplier, lockPeriod, bytesStaked: parsedBytes, hasVault: stakingSeason === 's1' ? s1HasVault : false });
  const liveRate = rewardRates?.pools.find((pool) => pool.pool === stakingSeason.toUpperCase())?.netBytesPerPointPerDay ?? null;
  const hasRate = liveRate != null && Number.isFinite(liveRate) && liveRate >= 0;
  const rewardPerDay = hasRate ? points.totalPoints * liveRate : null;
  const activeBytesPrice = targetBytesPrice.trim() !== '' && Number.isFinite(Number(targetBytesPrice)) && Number(targetBytesPrice) >= 0
    ? Number(targetBytesPrice)
    : bytesPrice;
  const acquisitionValue = citizenPriceEth != null && market?.ethUsd != null && bytesPrice != null
    ? citizenPriceEth * market.ethUsd + points.bytesStaked * bytesPrice
    : null;
  const annualRewardValue = rewardPerDay != null && activeBytesPrice != null ? rewardPerDay * 365 * activeBytesPrice : null;
  const apy = acquisitionValue && annualRewardValue != null ? annualRewardValue / acquisitionValue * 100 : null;
  const lockOptions = stakingSeason === 's1' ? Object.keys(S1_LOCK_MULTIPLIERS) : Object.keys(S2_LOCK_MULTIPLIERS);
  const groupedFloors = market ? ['S1', 'S2'].map((group) => ({
    group,
    rows: market.collections
      .filter((row) => row.season === group)
      .sort((a, b) => group === 'S1' ? S1_FLOOR_ORDER.indexOf(a.key) - S1_FLOOR_ORDER.indexOf(b.key) : 0),
  })) : [];
  const valuationInputs = market?.valuation.rows
    .filter((row): row is ValuationRow & { supply: number } => row.supply != null && Number.isFinite(row.supply))
    .map((row) => ({ key: row.key, supply: row.supply, floorEth: row.floorEth, offerEth: row.offerEth, offerQuantity: row.offerQuantity })) ?? [];
  const impliedValuation = market && valuationInputs.length === market.valuation.totalCollections
    ? calculateImpliedValuation(valuationInputs, valuationMethod, market.ethUsd, bytesMarketCap)
    : null;
  const valuationRows = market && impliedValuation
    ? impliedValuation.rows.map((calculated) => ({ ...market.valuation.rows.find((row) => row.key === calculated.key)!, ...calculated }))
    : [];
  const totalValueEth = impliedValuation?.totalUsd != null && market?.ethUsd ? impliedValuation.totalUsd / market.ethUsd : null;
  const snapshotSourceValues = [
    market?.sourceTimes?.listingsAsOf ?? market?.asOf,
    market?.sourceTimes?.offersAsOf ?? market?.asOf,
    market?.sourceTimes?.rankingsAsOf ?? market?.asOf,
    market?.sourceTimes?.supplyAsOf ?? market?.valuation?.blockAsOf,
    rewardRates?.asOf,
    bytesMarketAsOf,
  ];
  const snapshotSourceTimes = snapshotSourceValues
    .map((value) => value ? Date.parse(value) : Number.NaN)
    .filter(Number.isFinite);
  const latestSnapshotSource = snapshotSourceTimes.length ? Math.max(...snapshotSourceTimes) : null;
  const oldestSnapshotSource = snapshotSourceTimes.length ? Math.min(...snapshotSourceTimes) : null;

  return <main className="ct-main">
    <section className="ct-hero" aria-labelledby="citizen-title">
      <div className="ct-hero-title">
        <div className="ct-kicker">NEO TOKYO MARKET INTELLIGENCE</div>
        <h1 id="citizen-title">Citizen <em>Interlink</em></h1>
        <p>Inspect the code. Price the yield. Read the market.</p>
        <div className="ct-hero-badges"><span>Citizen intelligence</span><span>Live market references</span><span>Staking scenarios</span></div>
      </div>
      <div className={`ct-snapshot-stamp ${snapshotSourceTimes.length === 6 ? 'is-complete' : ''}`} aria-label="Snapshot recency summary">
        <strong><i aria-hidden="true" />{snapshotSourceTimes.length ? 'INTERLINK ACTIVE' : 'CONNECTING TO SOURCES'}</strong>
        <span>Latest source interlinked {formatSnapshotAge(latestSnapshotSource, snapshotNow)}</span>
        <span>Oldest source {formatSnapshotAge(oldestSnapshotSource, snapshotNow)}</span>
        <span>{snapshotSourceTimes.length} / 6 source classes · 5 min–1 hr refresh range</span>
      </div>
    </section>

    <section className="ct-panel ct-lookup-panel">
      <SectionHeading eyebrow="01 / CITIZEN LOOKUP" title="Decode any assembled Citizen" detail="One number reveals the Citizen, its traits, components, rarity and staking profile." />
      <form className="ct-lookup-form" onSubmit={performLookup}>
        <div className="ct-season-toggle" aria-label="Citizen season">
          {(['s1', 's2'] as CitizenSeason[]).map((value) => <button key={value} type="button" disabled={lookupLoading} className={lookupSeason === value ? 'active' : ''} onClick={() => { setLookupSeason(value); setTokenId(value === 's1' ? '3099' : '1033'); setLookup(null); setLookupError(''); }}>{value.toUpperCase()}</button>)}
        </div>
        <label><span>CITIZEN NUMBER</span><input inputMode="numeric" pattern="[0-9]*" value={tokenId} onChange={(event) => setTokenId(event.target.value)} placeholder={lookupSeason === 's1' ? '3099' : '1033'} /></label>
        <button className="ct-primary-button" disabled={lookupLoading}>{lookupLoading ? 'DECODING…' : 'RUN LOOKUP'}</button>
      </form>
      {lookupError && <p className="ct-error">{lookupError}</p>}

      {lookup && <div className="ct-citizen-result">
        <div className="ct-citizen-overview">
          <div className="ct-citizen-image">{lookup.imageUrl ? <img src={lookup.imageUrl} alt={lookup.name} /> : <span>NO IMAGE</span>}</div>
          <div className="ct-citizen-title">
            <p>{lookup.season.toUpperCase()} · ASSEMBLED CITIZEN</p>
            <h3>{lookup.name}</h3>
            <div className="ct-badges">
              {lookup.elite && <span className="elite">ELITE S1</span>}
              {lookup.season === 's1' && <span>{lookup.rank ? `RANK #${lookup.rank.toLocaleString()}` : 'RANK NOT PUBLISHED'}</span>}
              {lookup.season === 's2' && <span>{lookup.estimatedRank != null ? `OPENSEA EST. RANK #${lookup.estimatedRank.toLocaleString()}` : 'OPENSEA EST. RANK UNAVAILABLE'}</span>}
              {lookup.rewardRate != null && <span>REWARD RATE {lookup.rewardRate}</span>}
            </div>
            <dl>
              {lookup.season === 's1' && <div><dt>Rarity score</dt><dd>{formatNumber(lookup.rarityScore, 2)}</dd></div>}
              <div><dt>Components</dt><dd>{lookup.components.length}</dd></div>
              <div><dt>Calculator</dt><dd>{lookup.season === 's1' ? 'Auto-filled' : 'S2 baseline loaded'}</dd></div>
            </dl>
          </div>
        </div>
        <div className="ct-component-grid">
          {lookup.components.map((item) => <article key={item.label} className="ct-component-card">
            <header><div><p>{item.label.toUpperCase()}</p><h4>{item.tokenId ? `#${item.tokenId}` : item.name}</h4></div>{item.rank && <span>RANK #{item.rank.toLocaleString()}</span>}</header>
            {(item.componentScore != null || item.rarityScore != null) && <div className="ct-component-scores"><span title="Neo Tokyo component trait total">Trait sum score {formatNumber(item.componentScore, 2)}</span><span title="RarityMon score used to place this component's rank">Rarity ranking score {formatNumber(item.rarityScore, 2)}</span></div>}
            <div className="ct-traits">{item.traits.map((trait) => <div key={`${item.label}-${trait.label}`}><span>{trait.label}</span><strong>{trait.value}</strong></div>)}</div>
          </article>)}
        </div>
        {lookup.notices?.map((notice) => <p className="ct-notice" key={notice}>{notice}</p>)}
        {lookup.season === 's2' && lookup.estimatedRankAsOf && <p className="ct-rank-source">Source: <a href={lookup.estimatedRankUrl} target="_blank" rel="noreferrer">{lookup.estimatedRankSource ?? 'OpenSea OpenRarity'} ↗</a> · Checked {new Date(lookup.estimatedRankAsOf).toLocaleString()}</p>}
      </div>}
    </section>

    <section className="ct-panel ct-bank-panel">
      <SectionHeading eyebrow="02 / BANK OF NEO TOKYO" title="Price the staking return" detail="The Citizen lookup feeds its known S1 yield and Vault multiplier directly into this calculator." />
      <div className="ct-bank-grid">
        <div className="ct-bank-controls">
          <div className="ct-season-toggle wide">{(['s1', 's2'] as CitizenSeason[]).map((value) => <button key={value} type="button" className={stakingSeason === value ? 'active' : ''} onClick={() => setStakingSeason(value)}>{value.toUpperCase()} STAKING</button>)}</div>
          {stakingSeason === 's1' && <div className="ct-field-grid">
            <label><span>CREDIT YIELD {lookup?.season === 's1' && <b>AUTO</b>}</span><select value={creditYield} onChange={(event) => setCreditYield(event.target.value)}>{Object.keys(S1_CREDIT_YIELD_POINTS).filter((value) => value !== 'Mid').map((value) => <option key={value}>{value}</option>)}</select></label>
            <label><span>VAULT MULTIPLIER {lookup?.season === 's1' && <b>AUTO</b>}</span><select value={vaultMultiplier} onChange={(event) => setVaultMultiplier(event.target.value)}>{Object.keys(S1_VAULT_MULTIPLIERS).filter((value) => !['Medium-High', '?'].includes(value)).map((value) => <option key={value}>{value}</option>)}</select></label>
          </div>}
          <div className="ct-field-grid">
            <label><span>LOCK PERIOD</span><select value={lockPeriod} onChange={(event) => setActiveLockPeriod(event.target.value)}>{lockOptions.map((value) => <option key={value}>{value}</option>)}</select></label>
            <label><span>BYTES STAKED <button className="ct-max-button" type="button" onClick={() => setActiveBytesStaked(String(bytesCap))}>MAX {bytesCap.toLocaleString()}</button></span><input className={bytesOverCap ? 'invalid' : ''} type="number" min="0" max={bytesCap} step="1" value={bytesStaked} onChange={(event) => setActiveBytesStaked(event.target.value)} onBlur={() => { if (bytesOverCap) setActiveBytesStaked(String(bytesCap)); }} />{bytesOverCap && <small className="ct-input-error">Protocol maximum is {bytesCap.toLocaleString()} BYTES. Calculations are capped automatically.</small>}{stakingSeason === 's1' && s1HasVault === false && <small className="ct-field-note">Vaultless S1 detected. The no-vault cap applies.</small>}</label>
          </div>
          <div className="ct-citizen-price-control">
            <label>
              <span>CITIZEN PRICE (ETH) <b>{citizenPriceIsCustom ? 'CUSTOM PRICE' : 'LIVE FLOOR'}</b></span>
              <div><i>Ξ</i><input type="number" min="0" step="any" value={citizenPriceInput} onChange={(event) => setActiveCitizenPriceEth(event.target.value)} /></div>
              <small>Enter a specific listing price or the ETH price originally paid.</small>
            </label>
            <button type="button" disabled={citizenFloor == null || !citizenPriceIsCustom} onClick={() => setActiveCitizenPriceEth(null)}>USE LIVE FLOOR{citizenFloor == null ? '' : ` · ${formatNumber(citizenFloor, 4)} Ξ`}</button>
          </div>
          <div className="ct-live-rate-card">
            <div><span>CURRENT REWARD RATE</span><b>{liveRate != null ? 'ONCHAIN SNAPSHOT' : 'UNAVAILABLE'}</b></div>
            <strong>{formatNumber(liveRate, 8)}</strong>
            <small>BYTES / POINT / DAY</small>
          </div>
          {rewardRates && <p className="ct-rate-source">Calculated at Ethereum block {rewardRates.blockNumber.toLocaleString()} · {new Date(rewardRates.asOf).toLocaleString()} · Net of DAO tax</p>}
          <div className="ct-speculator">
            <div><p>SPECULATOR MODE</p><span>Test the same return at any target BYTES price.</span></div>
            <label><span>TARGET BYTES PRICE</span><div><i>$</i><input type="number" min="0" step="any" value={targetBytesPrice} onChange={(event) => setTargetBytesPrice(event.target.value)} placeholder={bytesPrice != null ? String(bytesPrice) : '0.00'} /></div></label>
          </div>
        </div>
        <div className="ct-bank-output">
          <p>ESTIMATED POSITION</p>
          <div className="ct-big-metric"><span>STAKING POINTS</span><strong>{formatNumber(points.totalPoints, 2)}</strong><small>{formatNumber(points.citizenPoints, 2)} Citizen + {formatNumber(points.bytesPoints, 2)} BYTES</small></div>
          <div className="ct-output-grid">
            <div><span>BYTES / DAY</span><strong>{formatNumber(rewardPerDay, 3)}</strong></div>
            <div><span>BYTES / MONTH</span><strong>{formatNumber(rewardPerDay == null ? null : rewardPerDay * 30, 2)}</strong></div>
            <div><span>POSITION COST</span><strong>{formatUsd(acquisitionValue)}</strong></div>
            <div className="accent"><span>HYPOTHETICAL APY</span><strong>{apy == null ? '—' : `${formatNumber(apy, 1)}%`}</strong></div>
          </div>
          <p className="ct-disclaimer">Illustrative only. Position cost uses the entered Citizen price plus staked BYTES at current spot prices. Historical ETH purchases use today&apos;s ETH/USD, not the exchange rate on the purchase date. Speculator Mode changes projected reward valuation, not acquisition cost. Excludes fees, taxes, slippage and future rate changes.</p>
        </div>
      </div>
    </section>

    <section className="ct-panel ct-market-panel">
      <SectionHeading eyebrow="03 / MARKET DASHBOARD" title="The Neo Tokyo market, mapped." detail="Live OpenSea floor references for assembled Citizens and all four S1 / three S2 component collections." />
      {marketError && <p className="ct-error">{marketError}</p>}
      <div className="ct-market-groups">
        {groupedFloors.map(({ group, rows }) => <div key={group} className="ct-market-group"><header><span>{group} FLOORS</span><p>{group === 'S1' ? 'NEO TOKYO CITY' : 'OUTERLANDS'}</p></header><div>{rows.map((row) => <a href={row.url} target="_blank" rel="noreferrer" key={row.key} className="ct-floor-card"><span>{row.label}</span><strong>{row.floorEth == null ? 'No Listings' : `${formatNumber(row.floorEth, 4)} Ξ`}</strong><small>{row.sales24h == null ? 'OpenSea' : `${row.sales24h} sales / 24h`} ↗</small></a>)}</div></div>)}
      </div>
      <div className="ct-valuation-card">
        <div className="ct-valuation-topline">
          <div><p>NEO TOKYO IMPLIED ECOSYSTEM VALUE</p><span>ESTIMATED · NFT COLLECTIONS + $BYTES</span></div>
          <div className="ct-valuation-toggle" aria-label="Valuation method">
            <button type="button" className={valuationMethod === 'floor' ? 'active' : ''} aria-pressed={valuationMethod === 'floor'} onClick={() => setValuationMethod('floor')}>FLOOR-LED</button>
            <button type="button" className={valuationMethod === 'offer' ? 'active' : ''} aria-pressed={valuationMethod === 'offer'} onClick={() => setValuationMethod('offer')}>OFFER-LED</button>
          </div>
        </div>
        <div className="ct-valuation-main">
          <div className="ct-valuation-headline">
            <span>{impliedValuation?.complete ? 'IMPLIED VALUE' : impliedValuation ? 'COVERAGE GATE' : 'CALCULATING'}</span>
            <strong>{!impliedValuation ? 'Calculating…' : impliedValuation.complete ? formatCompactUsd(impliedValuation.totalUsd) : 'INCOMPLETE VALUATION'}</strong>
            <small>{impliedValuation?.complete ? `${formatNumber(totalValueEth, 0)} ETH` : 'A missing collection reference is never treated as zero.'}</small>
          </div>
          <dl className="ct-valuation-summary">
            <div><dt>NFT collections</dt><dd>{formatCompactUsd(impliedValuation?.nftUsd)}</dd></div>
            <div><dt>$BYTES market cap*</dt><dd>{formatCompactUsd(bytesMarketCap)}</dd></div>
            <div><dt>Coverage</dt><dd>{impliedValuation ? `${impliedValuation.coverage} / ${impliedValuation.totalCollections}` : '—'}</dd></div>
            <div><dt>Method</dt><dd>{valuationMethod === 'floor' ? 'Floor-led' : 'Offer-led'}</dd></div>
          </dl>
        </div>
        <details className="ct-valuation-details">
          <summary>VIEW COLLECTION MATH <span>+</span></summary>
          <div className="ct-valuation-table-wrap"><table><thead><tr><th>Collection</th><th>Distinct supply</th><th>Reference</th><th>Price</th><th>Offer depth</th><th>Subtotal</th></tr></thead><tbody>
            {valuationRows.map((row) => <tr key={row.key}>
              <td><a href={row.url} target="_blank" rel="noreferrer"><strong>{row.season} {row.label}</strong><small>{row.supplyBreakdown?.v2Active != null ? `${row.supplyBreakdown.v2Active.toLocaleString()} V2 + ${row.supplyBreakdown.legacyExternal.toLocaleString()} unmigrated V1` : `${row.supplyBreakdown?.v2External?.toLocaleString() ?? '—'} V2 + ${row.supplyBreakdown?.legacyExternal.toLocaleString() ?? '—'} legacy unassembled`} ↗</small></a></td>
              <td>{row.supply.toLocaleString()}</td>
              <td><span className={`ct-source-badge ${row.method}`}>{row.method === 'floor' ? 'FLOOR' : row.method === 'bid-fallback' ? 'BID FALLBACK' : row.method === 'top-offer' ? 'TOP OFFER' : 'UNAVAILABLE'}</span></td>
              <td>{row.referenceEth == null ? '—' : `${formatNumber(row.referenceEth, 4)} Ξ`}</td>
              <td>{row.offerQuantity == null ? '—' : `${row.offerQuantity.toLocaleString()} unit${row.offerQuantity === 1 ? '' : 's'}`}</td>
              <td>{row.subtotalEth == null ? '—' : `${formatNumber(row.subtotalEth, 2)} Ξ`}</td>
            </tr>)}
          </tbody></table></div>
        </details>
        <p className="ct-valuation-caveat">Modeled reference value, not a company valuation or liquidation value. Floors use current executable asks; offers have limited depth. Elite Citizens are excluded because they are already part of S1 Citizens.</p>
        <p className="ct-valuation-source"><strong>Why this exists.</strong> This first-party model was created in response to inaccuracies identified in Neo Tokyo&apos;s presentation on <a href="https://nftpricefloor.com/brands" target="_blank" rel="noreferrer">NFT Price Floor&apos;s NFT Brands tracker ↗</a>. It uses direct onchain supply and custody reads to avoid overlapping assembled Citizens, migrated assets and component collections.</p>
        {market?.valuation && <p className="ct-valuation-source">NFT supply pinned to Ethereum block <a href={`https://etherscan.io/block/${market.valuation.sourceBlock}`} target="_blank" rel="noreferrer">{market.valuation.sourceBlock.toLocaleString()} ↗</a> · {new Date(market.valuation.blockAsOf).toLocaleString()} · $BYTES market cap* block {bytesSourceBlock?.toLocaleString() ?? '—'}{bytesMarketAsOf ? ` · ${new Date(bytesMarketAsOf).toLocaleString()}` : ''}</p>}
      </div>
      {market?.asOf && <p className="ct-asof">Listings {new Date(market.sourceTimes?.listingsAsOf ?? market.asOf).toLocaleString()} · Offers {new Date(market.sourceTimes?.offersAsOf ?? market.asOf).toLocaleString()} · Ranks {new Date(market.sourceTimes?.rankingsAsOf ?? market.asOf).toLocaleString()} · Listings can change at any time</p>}
    </section>

    <section className="ct-panel">
      <SectionHeading eyebrow="04 / ELITE WATCH" title="S1 Elite listings" detail="Current listed S1s whose live NeoTokyo.codes rarity rank is 500 or better." />
      <div className="ct-table-wrap"><table><thead><tr><th>Citizen</th><th>Rank</th><th>Reward rate</th><th>Listing</th><th /></tr></thead><tbody>
        {market?.eliteListings.map((item) => <tr key={item.tokenId}><td><div className="ct-listing-citizen">{item.imageUrl && <img src={item.imageUrl} alt="" />}<strong>#{item.tokenId}</strong></div></td><td><span className="ct-rank-pill">ELITE #{item.rank}</span></td><td>{item.rewardRate ?? '—'}</td><td><strong>{item.priceEth == null ? '—' : `${formatNumber(item.priceEth, 4)} Ξ`}</strong><small>{formatUsd(item.priceUsd)}</small></td><td><a href={item.url} target="_blank" rel="noreferrer">VIEW ↗</a></td></tr>)}
        {market && market.eliteListings.length === 0 && <tr><td colSpan={5} className="ct-empty">No Elite S1 listings in the current OpenSea scan.</td></tr>}
        {!market && !marketError && <tr><td colSpan={5} className="ct-empty">Scanning current listings…</td></tr>}
      </tbody></table></div>
      <p className="ct-asof">Scans up to the 50 lowest current S1 listings and matches token numbers against current rarity ranks.</p>
    </section>
  </main>;
}
