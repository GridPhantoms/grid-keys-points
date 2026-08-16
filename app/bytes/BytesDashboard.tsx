'use client';

import { useEffect, useState } from 'react';
import { validateBytesMetricsResponse, validateEmissionsHistory } from '../../lib/bytes-client-data.mjs';
import { nextGenesisHalfLevel } from '../../lib/bytes-model.mjs';
import EmissionsChart from './EmissionsChart';
import type { BytesMetricsResponse, EmissionsHistory, EmissionPools, MetricRecord } from './types';

const numberFormatter = new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 });
const integerFormatter = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 });
const dateTimeFormatter = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
  timeZone: 'UTC',
  timeZoneName: 'short',
});
const dateFormatter = new Intl.DateTimeFormat('en-US', { month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
const VERIFIED_EMISSIONS_EPOCH_SECONDS = 1_686_787_200;

function formatNumber(value: unknown, digits = 2) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return 'Unavailable';
  return value.toLocaleString('en-US', { maximumFractionDigits: digits });
}

function formatSigned(value: unknown) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return 'Unavailable';
  const formatted = numberFormatter.format(Math.abs(value));
  return `${value > 0 ? '+' : value < 0 ? '−' : ''}${formatted}`;
}

function formatTimestamp(value?: string) {
  if (!value || !Number.isFinite(Date.parse(value))) return 'Unavailable';
  return dateTimeFormatter.format(new Date(value));
}

function formatPercentage(value: unknown) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return 'Unavailable';
  return `${value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%`;
}

function isPoolValue(value: unknown): value is EmissionPools {
  return Boolean(value && typeof value === 'object' && 'total' in value);
}

function Badge({ classification }: { classification: string }) {
  return <span className={`bytes-badge bytes-${classification}`}>{classification}</span>;
}

function MetricDetails({ metric, label, sourceBlock, valuePrefix = '' }: {
  metric?: MetricRecord<unknown>;
  label: string;
  sourceBlock?: number | null;
  valuePrefix?: string;
}) {
  if (!metric) return null;
  return (
    <details className="bytes-details">
      <summary>{label}</summary>
      <dl>
        <div><dt>Classification</dt><dd><Badge classification={metric.classification} /></dd></div>
        <div><dt>Availability</dt><dd>{metric.availability}</dd></div>
        <div><dt>Source</dt><dd>{metric.source}</dd></div>
        {sourceBlock != null && <div><dt>Source block</dt><dd>{integerFormatter.format(sourceBlock)}</dd></div>}
        <div><dt>As of</dt><dd>{formatTimestamp(metric.asOf)}</dd></div>
        {metric.rawValue && <div><dt>{metric.daoTaxExcludedRawValue ? 'Exact calculated aggregate' : metric.classification === 'calculated' ? 'Exact calculated value' : 'Exact contract value'}</dt><dd><code>{valuePrefix}{metric.rawValue} {metric.unit}</code></dd></div>}
        {metric.daoTaxExcludedRawValue && <div><dt>Exact pending DAO-tax aggregate</dt><dd><code>{metric.daoTaxExcludedRawValue} BYTES</code> · excluded from the displayed net pending snapshot aggregate</dd></div>}
        {metric.formula && <div><dt>Formula</dt><dd><code>{metric.formula}</code></dd></div>}
        {metric.assumptions?.length ? <div><dt>Assumptions</dt><dd><ul>{metric.assumptions.map((item) => <li key={item}>{item}</li>)}</ul></dd></div> : null}
        {metric.reason && <div><dt>Reason</dt><dd>{metric.reason}</dd></div>}
      </dl>
    </details>
  );
}

function StatCard({ label, metric, digits = 0, prefix = '' }: {
  label: string;
  metric?: MetricRecord<unknown>;
  digits?: number;
  prefix?: string;
}) {
  const formatted = formatNumber(metric?.value, digits);
  const display = formatted === 'Unavailable' ? formatted : `${prefix}${formatted}`;
  return (
    <article className="bytes-card">
      <div className="bytes-card-label">
        <span>{label}</span>
        {metric ? <Badge classification={metric.classification} /> : <span className="bytes-badge">waiting</span>}
      </div>
      <div className={metric?.availability === 'available' && metric.classification !== 'projected' ? 'bytes-value bytes-cyan' : 'bytes-value'}>{display}</div>
      <div className="bytes-unit">{metric?.availability === 'available' ? metric.unit : metric?.reason ?? 'Waiting for live metrics'}</div>
    </article>
  );
}

function EmissionsSummaryCard({ configured, modeled, divergence, theoryWeek }: {
  configured?: MetricRecord<unknown>;
  modeled?: MetricRecord<unknown>;
  divergence?: MetricRecord<unknown>;
  theoryWeek?: MetricRecord<unknown>;
}) {
  const configuredPools = configured && isPoolValue(configured.value) ? configured.value : null;
  const modeledPools = modeled && isPoolValue(modeled.value) ? modeled.value : null;
  const configuredTotal = configuredPools?.total;
  const modeledTotal = modeledPools?.total;
  const configuredAvailable = configured?.availability === 'available' && typeof configuredTotal === 'number';
  const modeledAvailable = modeled?.availability === 'available' && typeof modeledTotal === 'number';
  const divergenceAvailable = divergence?.availability === 'available' && typeof divergence.value === 'number';
  const modelWeek = theoryWeek?.availability === 'available' && typeof theoryWeek.value === 'number' ? theoryWeek.value : null;
  const variancePercent = configuredAvailable && modeledAvailable && modeledTotal > 0
    ? ((configuredTotal - modeledTotal) / modeledTotal) * 100
    : null;
  const rawOffsetWeeks = configuredAvailable && modeledAvailable && modeledTotal > 0 && configuredTotal > 0
    ? Math.log2(configuredTotal / modeledTotal) * 52
    : null;
  const roundedOffsetWeeks = rawOffsetWeeks === null ? null : Math.round(rawOffsetWeeks);
  const alignedReferenceWeek = modelWeek !== null
    && rawOffsetWeeks !== null
    && roundedOffsetWeeks !== null
    && Math.abs(rawOffsetWeeks - roundedOffsetWeeks) < 0.05
    ? modelWeek - roundedOffsetWeeks
    : null;
  const legacyEmissionTotal = configuredPools && typeof configuredPools.BYTES === 'number' && typeof configuredPools.LP === 'number'
    ? configuredPools.BYTES + configuredPools.LP
    : null;

  return (
    <article className="bytes-card bytes-emissions-summary">
      <div className="bytes-card-label"><span>Current daily emissions</span>{configured ? <Badge classification={configured.classification} /> : <span className="bytes-badge">waiting</span>}</div>
      <div className={configuredAvailable ? 'bytes-value bytes-cyan bytes-value-hero' : 'bytes-value bytes-value-hero'}>{configuredAvailable ? formatNumber(configuredTotal) : 'Unavailable'}</div>
      <div className="bytes-unit">{configuredAvailable ? 'BYTES/DAY · CONTRACT-CONFIGURED' : configured?.reason ?? 'Waiting for live metrics'}</div>
      <div className="bytes-summary-grid">
        <div><b>{modeledAvailable ? formatNumber(modeledTotal) : '—'}</b><small>Modeled reference rate · BYTES/day</small></div>
        <div><b>{divergenceAvailable ? `${formatSigned(divergence.value)} · ${variancePercent === null ? '—' : formatSigned(variancePercent)}%` : '—'}</b><small>Configured vs. modeled · BYTES/day</small></div>
      </div>
      {alignedReferenceWeek !== null && modelWeek !== null ? <p className="bytes-observer-note">Active reward windows align with reference week {alignedReferenceWeek} · calendar model: week {modelWeek}</p> : null}
      {legacyEmissionTotal !== null && legacyEmissionTotal > 0 ? <p className="bytes-contract-alert">Additional nonzero contract reward-window configuration detected for BYTES/LP asset indices: {formatNumber(legacyEmissionTotal)} BYTES/day. Inspect claimability and pool treatment before including it in headline issuance.</p> : null}
    </article>
  );
}

function ProjectedIssuanceCard({ metric, steady }: {
  metric?: MetricRecord<unknown>;
  steady?: MetricRecord<unknown>;
}) {
  const issuanceValue = metric?.availability === 'available' && typeof metric.value === 'number' ? metric.value : null;
  const steadyValue = steady?.availability === 'available' && typeof steady.value === 'number' && steady.value > 0 ? steady.value : null;
  const share = issuanceValue !== null && steadyValue !== null ? (issuanceValue / steadyValue) * 100 : null;
  return (
    <article className="bytes-card">
      <div className="bytes-card-label"><span>Projected next-365-day issuance</span>{metric ? <Badge classification={metric.classification} /> : <span className="bytes-badge">waiting</span>}</div>
      <div className="bytes-value">{issuanceValue !== null ? integerFormatter.format(issuanceValue) : 'Unavailable'}</div>
      <div className="bytes-unit">{issuanceValue !== null ? 'BYTES' : metric?.reason ?? 'Waiting for live metrics'}</div>
      <p className="bytes-card-note">{share === null ? 'Steady-scenario share unavailable' : <><strong>{formatNumber(share, 1)}%</strong> of the steady scenario&apos;s total modeled remaining issuance is projected within the next 365 days</>}</p>
    </article>
  );
}

function GenesisEpochCard({ asOf }: { asOf?: string }) {
  const asOfMs = asOf && Number.isFinite(Date.parse(asOf)) ? Date.parse(asOf) : null;
  const elapsedDays = asOfMs === null ? null : Math.max(0, Math.floor((asOfMs / 1000 - VERIFIED_EMISSIONS_EPOCH_SECONDS) / 86_400));
  const elapsedWeeks = elapsedDays === null ? null : Math.floor(elapsedDays / 7);
  const remainingDays = elapsedDays === null ? null : elapsedDays % 7;
  return (
    <article className="bytes-card bytes-epoch-card">
      <div className="bytes-card-label"><span>Since BYTES 2.0 Genesis epoch</span><Badge classification="calculated" /></div>
      <div className="bytes-value bytes-cyan">{elapsedDays === null ? 'Unavailable' : integerFormatter.format(elapsedDays)}</div>
      <div className="bytes-unit">DAYS SINCE JUNE 15, 2023</div>
      <p className="bytes-card-note">{elapsedWeeks === null ? 'Epoch counter unavailable' : <><strong>{integerFormatter.format(elapsedWeeks)} weeks</strong> · {remainingDays} {remainingDays === 1 ? 'day' : 'days'}</>}</p>
    </article>
  );
}

function TotalSupplyCard({ metric }: { metric?: MetricRecord<unknown> }) {
  const value = metric?.availability === 'available' && typeof metric.value === 'number' ? metric.value : null;
  return (
    <article className="bytes-card">
      <div className="bytes-card-label"><span>Total supply</span>{metric ? <Badge classification={metric.classification} /> : <span className="bytes-badge">waiting</span>}</div>
      <div className={value !== null ? 'bytes-value bytes-cyan' : 'bytes-value'}>{value !== null ? formatNumber(value) : 'Unavailable'}</div>
      <div className="bytes-unit">{value !== null ? 'BYTES' : metric?.reason ?? 'Waiting for live metrics'}</div>
      <p className="bytes-card-note">Ethereum BYTES 2.0 · canonical <code>totalSupply()</code></p>
    </article>
  );
}

function StakedBytesCard({ metric, percentage }: {
  metric?: MetricRecord<unknown>;
  percentage: number | null;
}) {
  const value = metric?.availability === 'available' && typeof metric.value === 'number' ? metric.value : null;
  return (
    <article className="bytes-card">
      <div className="bytes-card-label"><span>Staked BYTES</span>{metric ? <Badge classification={metric.classification} /> : <span className="bytes-badge">waiting</span>}</div>
      <div className={value !== null ? 'bytes-value bytes-cyan' : 'bytes-value'}>{value !== null ? integerFormatter.format(value) : 'Unavailable'}</div>
      <div className="bytes-unit">{value !== null ? 'BYTES HELD BY STAKING CONTRACT' : metric?.reason ?? 'Waiting for live metrics'}</div>
      <p className="bytes-card-note">{percentage === null ? 'Share of total supply unavailable' : <><strong>{formatPercentage(percentage)}</strong> of total supply</>}</p>
    </article>
  );
}

function HolderSummaryCard({ crossChain, ethereum, avalanche }: {
  crossChain?: MetricRecord<unknown>;
  ethereum?: MetricRecord<unknown>;
  avalanche?: MetricRecord<unknown>;
}) {
  const crossChainValue = crossChain?.availability === 'available' && typeof crossChain.value === 'number' ? crossChain.value : null;
  const ethereumValue = ethereum?.availability === 'available' && typeof ethereum.value === 'number' ? ethereum.value : null;
  const avalancheValue = avalanche?.availability === 'available' && typeof avalanche.value === 'number' ? avalanche.value : null;
  return (
    <article className="bytes-card bytes-holder-card">
      <div className="bytes-card-label"><span>Cross-chain unique holders</span>{crossChain ? <Badge classification={crossChain.classification} /> : <span className="bytes-badge">waiting</span>}</div>
      <div className={crossChainValue !== null ? 'bytes-value bytes-cyan' : 'bytes-value'}>{crossChainValue !== null ? integerFormatter.format(crossChainValue) : 'Unavailable'}</div>
      <div className="bytes-unit">POSITIVE-BALANCE ADDRESSES</div>
      <div className="bytes-summary-grid">
        <div><b>{ethereumValue !== null ? integerFormatter.format(ethereumValue) : '—'}</b><small>Ethereum holders</small></div>
        <div><b>{avalancheValue !== null ? integerFormatter.format(avalancheValue) : '—'}</b><small>Avalanche holders</small></div>
      </div>
      <p className="bytes-card-note">Matching addresses across both chains are counted once</p>
    </article>
  );
}

function CitizenStakingCard({ label, count, percentage, collectionSupply, v2Supply }: {
  label: string;
  count?: MetricRecord<unknown>;
  percentage?: MetricRecord<unknown>;
  collectionSupply?: MetricRecord<unknown>;
  v2Supply?: MetricRecord<unknown>;
}) {
  const countAvailable = count?.availability === 'available' && typeof count.value === 'number';
  const percentageAvailable = percentage?.availability === 'available' && typeof percentage.value === 'number';
  const collectionAvailable = collectionSupply?.availability === 'available' && typeof collectionSupply.value === 'number';
  const v2Available = v2Supply?.availability === 'available' && typeof v2Supply.value === 'number';
  return (
    <article className="bytes-card bytes-citizen-card">
      <div className="bytes-card-label"><span>{label}</span>{count ? <Badge classification={count.classification} /> : <span className="bytes-badge">waiting</span>}</div>
      <div className={countAvailable ? 'bytes-value bytes-cyan' : 'bytes-value'}>{countAvailable ? integerFormatter.format(count.value as number) : 'Unavailable'}</div>
      <div className="bytes-unit">STAKED IN THE CANONICAL CITIZEN YIELD POOL</div>
      <div className="bytes-split">
        <div><b className="bytes-citizen-percentage">{percentageAvailable ? formatPercentage(percentage.value) : '—'}</b><small>of {collectionAvailable ? integerFormatter.format(collectionSupply.value as number) : '—'} total collection supply</small></div>
        <div><b>{v2Available ? integerFormatter.format(v2Supply.value as number) : '—'}</b><small>current assembled V2 supply</small></div>
      </div>
      <MetricDetails metric={count} label={`Inspect ${label.toLowerCase()} count`} />
      <MetricDetails metric={percentage} label={`Inspect ${label.toLowerCase()} percentage`} />
      <MetricDetails metric={collectionSupply} label={`Inspect ${label.toLowerCase()} total collection supply`} />
    </article>
  );
}

function ScenarioCard({ title, description, metric, sourceBlock }: {
  title: string;
  description: string;
  metric?: MetricRecord<number>;
  sourceBlock?: number | null;
}) {
  return (
    <article className="bytes-scenario">
      <div className="bytes-scenario-top"><h3>{title}</h3><Badge classification="projected" /></div>
      <p>{description}</p>
      <strong>{metric?.availability === 'available' ? integerFormatter.format(metric.value) : 'Unavailable'}</strong>
      <div className="bytes-unit">MODELED REMAINING ISSUANCE · BYTES</div>
      <MetricDetails metric={metric} label={`Inspect ${title.toLowerCase()} formula and assumptions`} sourceBlock={sourceBlock} />
    </article>
  );
}

function AvailabilityRow({ label, metric, sourceBlock, valueNote, valuePrefix = '' }: {
  label: string;
  metric?: MetricRecord<unknown>;
  sourceBlock?: number | null;
  valueNote?: string;
  valuePrefix?: string;
}) {
  const isAvailable = metric?.availability === 'available' && typeof metric.value === 'number';
  return (
    <div className="bytes-availability-row">
      <div>
        <span>{label}</span>
        <strong>{isAvailable ? `${valuePrefix}${formatNumber(metric.value)} ${metric.unit}${valueNote ? ` (${valueNote})` : ''}` : 'Awaiting verified source'}</strong>
      </div>
      <p>{isAvailable ? `${metric.classification === 'calculated' ? 'Calculated from' : 'Verified by'} ${metric.source}.` : metric?.reason ?? 'Canonical definitions and contract provenance have not yet been verified.'}</p>
      <MetricDetails metric={metric} label={`Inspect ${label.toLowerCase()} methodology`} sourceBlock={sourceBlock} valuePrefix={valuePrefix} />
    </div>
  );
}

export default function BytesDashboard() {
  const [metrics, setMetrics] = useState<BytesMetricsResponse | null>(null);
  const [history, setHistory] = useState<EmissionsHistory | null>(null);
  const [metricsDone, setMetricsDone] = useState(false);
  const [historyDone, setHistoryDone] = useState(false);
  const [lastRefresh, setLastRefresh] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    const loadMetrics = async () => {
      try {
        const response = await fetch('/api/bytes-metrics', { signal: controller.signal });
        if (!response.ok) return;
        const payload: unknown = await response.json();
        setMetrics(validateBytesMetricsResponse(payload));
      } catch {
        // The historical series remains independently available.
      } finally {
        if (!controller.signal.aborted) setMetricsDone(true);
      }
    };
    const loadHistory = async () => {
      try {
        const response = await fetch('/data/bytes-emissions-history.json', { signal: controller.signal });
        if (!response.ok) return;
        const payload: unknown = await response.json();
        setHistory(validateEmissionsHistory(payload));
      } catch {
        // Live metrics remain independently available.
      } finally {
        if (!controller.signal.aborted) setHistoryDone(true);
      }
    };
    void Promise.allSettled([loadMetrics(), loadHistory()]).then(() => {
      if (!controller.signal.aborted) setLastRefresh(new Date().toISOString());
    });
    return () => controller.abort();
  }, []);

  const configured = metrics?.metrics.currentConfiguredEmissions;
  const modeled = metrics?.metrics.currentModeledRate;
  const next365DayIssuance = metrics?.metrics.projectedNext365DayIssuance;
  const divergence = metrics?.metrics.configuredVsTheoretical;
  const theoryWeek = metrics?.metrics.theoreticalWeek;
  const ethereumSupply = metrics?.metrics.ethBytes2Supply;
  const avalancheSupply = metrics?.metrics.avalancheBytesSupply;
  const stakingBalance = metrics?.metrics.bytesHeldByStakingContract;
  const s1CitizensStaked = metrics?.metrics.s1CitizensStaked;
  const s1StakedPercentage = metrics?.metrics.s1StakedPercentage;
  const s1CollectionSupply = metrics?.metrics.s1CollectionSupply;
  const s1CitizenV2Supply = metrics?.metrics.s1CitizenV2Supply;
  const s2CitizensStaked = metrics?.metrics.s2CitizensStaked;
  const s2StakedPercentage = metrics?.metrics.s2StakedPercentage;
  const s2CollectionSupply = metrics?.metrics.s2CollectionSupply;
  const s2CitizenV2Supply = metrics?.metrics.s2CitizenV2Supply;
  const ethereumHolderCount = metrics?.metrics.ethereumBytesHolderCount;
  const avalancheHolderCount = metrics?.metrics.avalancheBytesHolderCount;
  const crossChainUniqueHolderCount = metrics?.metrics.crossChainUniqueBytesHolderCount;
  const pendingRewards = metrics?.metrics.pendingUnclaimedRewards;
  const bytesPrice = metrics?.metrics.bytesPriceUsd;
  const totalSupplyValuation = metrics?.metrics.totalSupplyValuationUsd;
  const steady = metrics?.projections.steadyParticipationRemainingIssuance;
  const maximum = metrics?.projections.maximumParticipationRemainingIssuance;
  const sourceAsOf = configured?.asOf ?? metrics?.generatedAt;
  const avalancheSourceBlock = metrics?.provenance.avalanche.sourceBlock;
  const allLoading = !metricsDone && !historyDone;
  const stakingPercentage = ethereumSupply?.availability === 'available'
    && stakingBalance?.availability === 'available'
    && typeof ethereumSupply.value === 'number'
    && typeof stakingBalance.value === 'number'
    && ethereumSupply.value > 0
    ? (stakingBalance.value / ethereumSupply.value) * 100
    : null;
  const nextMilestone = theoryWeek?.availability === 'available' && typeof theoryWeek.value === 'number'
    ? nextGenesisHalfLevel(VERIFIED_EMISSIONS_EPOCH_SECONDS, theoryWeek.value)
    : null;

  return (
    <main className="bytes-main">
      <section className="bytes-hero" aria-labelledby="bytes-title">
        <div>
          <p className="bytes-eyebrow">Neo Tokyo market intelligence</p>
          <h1 id="bytes-title">$BYTES <span>TERMINAL</span></h1>
          <p className="bytes-lede">Contract-configured emissions, modeled decay, and supply research on our adopted utility token—separated by evidence class and shown with visible provenance.</p>
        </div>
        <div className="bytes-stamp" aria-label="Source status">
          <div className={`bytes-source-status ${metrics ? 'is-online' : ''}`}><i aria-hidden="true" />{metrics ? `${metrics.status} contract snapshot` : metricsDone ? 'Live metrics unavailable' : 'Connecting to metrics source'}</div>
          <div>Ethereum block {metrics?.sourceBlock ? metrics.sourceBlock.toLocaleString('en-US') : 'unavailable'}</div>
          <div>Source as of {formatTimestamp(sourceAsOf)}</div>
          <div>Last refresh {formatTimestamp(lastRefresh ?? undefined)}</div>
        </div>
      </section>

      <div className="bytes-notice bytes-community-credit"><strong>Community groundwork.</strong> OG Citizen <a href="https://x.com/0xSanSSerif" target="_blank" rel="noreferrer">@0xSanSSerif</a> spent years doing exhaustive manual work on BytesMetrics.io, helping make BYTES tokenomics legible and paving the way for the concept of this terminal. His original database was compromised, but the contribution deserves to be remembered.</div>
      <div className="bytes-notice"><strong>Observed first.</strong> Headline emissions come from configured staking-contract windows. Calculated and projected values remain visibly separate.</div>

      {allLoading ? <div className="bytes-loading" role="status" aria-live="polite">Loading live metrics and emissions history…</div> : null}
      {metricsDone && !metrics ? <div className="bytes-message" role="status">Live contract metrics are temporarily unavailable. Historical emissions remain available below when loaded.</div> : null}
      {historyDone && !history ? <div className="bytes-message" role="status">Historical emissions could not be loaded. Live contract metrics remain available above when loaded.</div> : null}
      {metrics?.warnings?.length ? <div className="bytes-message" role="status">Partial source response: {metrics.warnings.join(' ')}</div> : null}

      <section className="bytes-stats bytes-headline-stats" aria-label="Current BYTES emissions and issuance metrics">
        <EmissionsSummaryCard configured={configured} modeled={modeled} divergence={divergence} theoryWeek={theoryWeek} />
        <ProjectedIssuanceCard metric={next365DayIssuance} steady={steady} />
        <GenesisEpochCard asOf={metrics?.generatedAt} />
      </section>

      <section className="bytes-stats bytes-supply-stats" aria-label="BYTES supply, staking, and holder metrics">
        <TotalSupplyCard metric={ethereumSupply} />
        <StakedBytesCard metric={stakingBalance} percentage={stakingPercentage} />
        <HolderSummaryCard crossChain={crossChainUniqueHolderCount} ethereum={ethereumHolderCount} avalanche={avalancheHolderCount} />
      </section>

      <section className="bytes-stats bytes-citizen-stats" aria-label="Neo Tokyo Citizen staking metrics">
        <CitizenStakingCard label="S1 Citizens staked" count={s1CitizensStaked} percentage={s1StakedPercentage} collectionSupply={s1CollectionSupply} v2Supply={s1CitizenV2Supply} />
        <CitizenStakingCard label="S2 Outer Citizens staked" count={s2CitizensStaked} percentage={s2StakedPercentage} collectionSupply={s2CollectionSupply} v2Supply={s2CitizenV2Supply} />
      </section>

      <section className="bytes-stats bytes-market-stats" aria-label="BYTES market reference metrics">
        <StatCard label="BYTES spot price" metric={bytesPrice} digits={4} prefix="$" />
        <StatCard label="Market cap*" metric={totalSupplyValuation} prefix="$" />
      </section>

      <div className="bytes-layout">
        <div className="bytes-primary">
          <section className="bytes-panel bytes-chart-panel" aria-labelledby="emissions-heading">
          <div className="bytes-panel-head">
            <div><p className="bytes-eyebrow">Reconstructed configured history + explicit reference model</p><h2 id="emissions-heading">Emissions Decay</h2><p>Calculated daily reward windows reconstructed from observed inputs, compared with a separate weekly reference curve that the contract does not execute automatically.</p></div>
            {history && <span className="bytes-sample-count">{history.rows.length.toLocaleString('en-US')} daily samples</span>}
          </div>
          {history ? <EmissionsChart rows={history.rows} /> : historyDone ? <div className="bytes-chart-placeholder">Historical chart unavailable.</div> : <div className="bytes-chart-placeholder">Loading historical series…</div>}

          <div className="bytes-scenarios" aria-labelledby="scenario-heading">
            <h2 id="scenario-heading" className="bytes-section-title">Remaining Issuance Scenarios</h2>
            <ScenarioCard title="Steady Scenario" description="If staking participation stays around the steady level represented by this model, this is the estimated BYTES still to be emitted over the remaining life of the curve." metric={steady} sourceBlock={metrics?.sourceBlock} />
            <ScenarioCard title="Max Staking Scenario" description="If Community Staking Incentives were at maximum participation from here forward, this is the model's maximum potential remaining BYTES issuance." metric={maximum} sourceBlock={metrics?.sourceBlock} />
          </div>

            <div className="bytes-context"><strong>Supply-side context:</strong> Lower new issuance can require less demand to absorb potential emissions-driven sell pressure, but it does not guarantee price appreciation. Emissions only become sell pressure when recipients sell; demand, liquidity, holder behavior, and wider market conditions still matter.</div>
          </section>

          <section className="bytes-human-section" aria-labelledby="plain-english-heading">
            <p className="bytes-eyebrow">The human read</p>
            <h2 id="plain-english-heading">In Plain English</h2>
            <div className="bytes-human-grid">
              <p>Neo Tokyo&apos;s BYTES 2.0 system routes rewards through separate <strong>S1 Citizen</strong> and <strong>S2 Outer Citizen Yield Pools</strong>. Citizen positions are hard-locked for a selected staking period; points per Citizen combine pool-specific NFT inputs, a duration boost, and eligible BYTES contribution, while an S1 position may also include a Vault modifier. The contract is currently configured to emit about <strong>{configured?.availability === 'available' && isPoolValue(configured.value) ? `${formatNumber(configured.value.total)} BYTES per day` : 'an unavailable amount'}</strong>. Separately, the staking contract holds <strong>{stakingPercentage === null ? 'an unavailable share' : formatPercentage(stakingPercentage)}</strong> of BYTES supply, including BYTES Citizens have committed alongside S1 and S2 positions.</p>
              <p>If participation stays near today&apos;s level and future configured reward windows continue to track the weekly reference curve, the model projects about <strong>{next365DayIssuance?.availability === 'available' ? `${integerFormatter.format(next365DayIssuance.value)} BYTES` : 'an unavailable amount'}</strong> of issuance over the next 365 days. In the reference model, the next emissions half-level is reached on <strong>{nextMilestone ? dateFormatter.format(new Date(nextMilestone.asOf)) : 'an unavailable date'}</strong>, when the modeled S1 rate falls to {nextMilestone ? formatNumber(nextMilestone.s1DailyRate) : '—'} BYTES per day. Actual configured emissions may differ.</p>
              <p>Earlier configured reward windows sent much more reward inventory to stakers than current windows. Whether those rewards were held or sold is not measured here. If attention and demand return in a true bull market, they may meet a lighter configured emissions stream than in the early years, but only future contract configuration can establish that path. This does not predict demand, price, or actual selling.</p>
              <p>The published reference model is predictably decaying; contract output remains administrator-configured through reward windows. This terminal now measures positive-balance holder addresses, but it does not infer beneficial owners, custody relationships, holder concentration, liquidity depth, or realized volatility. Its price input is one verified spot reference rather than a promise of executable size. For the Citizens still watching the city&apos;s economy, the goal is to keep the mechanics honest without sanding off the uncertainty.</p>
            </div>
          </section>
        </div>

        <aside className="bytes-side">
          <section className="bytes-panel" aria-labelledby="valuation-heading">
            <div className="bytes-panel-head"><div><p className="bytes-eyebrow">Cross-chain accounting</p><h2 id="valuation-heading">Supply &amp; Valuation</h2></div></div>
            <p className="bytes-panel-copy">Ethereum and Avalanche supplies are shown side by side but never added: verified Avalanche CCIP BurnMint units represent bridged BYTES while Ethereum uses lock/release accounting. Market Cap* uses Ethereum supply once. Price references the <a href="https://www.dextools.io/app/en/ether/pair-explorer/0xfeb09c7e130a4b87b27ebd648ec485657b688b34" target="_blank" rel="noreferrer">Ethereum BYTES/WETH pair on DEXTools</a>.</p>
            <AvailabilityRow label="Ethereum chain-local total supply" metric={ethereumSupply} sourceBlock={metrics?.sourceBlock} />
            <AvailabilityRow label="Avalanche chain-local BYTES supply" metric={avalancheSupply} sourceBlock={avalancheSourceBlock} />
            <AvailabilityRow label="Market Cap*" metric={totalSupplyValuation} sourceBlock={metrics?.sourceBlock} valuePrefix="$" />
            <AvailabilityRow label="BYTES spot price" metric={bytesPrice} sourceBlock={metrics?.sourceBlock} valuePrefix="$" />
          </section>

          <section className="bytes-panel" aria-labelledby="supply-heading">
            <div className="bytes-panel-head"><div><p className="bytes-eyebrow">Verification gate</p><h2 id="supply-heading">Staking Status</h2></div></div>
            <p className="bytes-panel-copy">The staking contract&apos;s BYTES balance and the net pending reward snapshot aggregate across indexed stakers are sourced on-chain. These token balances are distinct from the S1 Citizen and S2 Outer Citizen NFT counts above.</p>
            <AvailabilityRow label="BYTES held by staking contract" metric={stakingBalance} sourceBlock={metrics?.sourceBlock} valueNote={stakingPercentage === null ? undefined : `${formatPercentage(stakingPercentage)} of total supply`} />
            <AvailabilityRow label="Pending / Unclaimed Rewards" metric={pendingRewards} sourceBlock={metrics?.sourceBlock} />
          </section>


          <section className="bytes-panel" aria-labelledby="ledger-heading">
            <div className="bytes-panel-head"><div><p className="bytes-eyebrow">Transparent by design</p><h2 id="ledger-heading">Methodology Ledger</h2><p>Every published number names what it is.</p></div></div>
            <div className="bytes-class-key" aria-label="Metric classifications">
              <Badge classification="observed" /><span>direct contract source data</span>
              <Badge classification="calculated" /><span>derived or reconstructed from observed inputs</span>
              <Badge classification="projected" /><span>scenario output with assumptions</span>
            </div>
            <MetricDetails metric={configured} label="Current daily emissions: configured" sourceBlock={metrics?.sourceBlock} />
            <MetricDetails metric={modeled} label="Current daily emissions: modeled" sourceBlock={metrics?.sourceBlock} />
            <MetricDetails metric={next365DayIssuance} label="Projected next-365-day issuance" sourceBlock={metrics?.sourceBlock} />
            <MetricDetails metric={divergence} label="Configured vs. modeled variance" sourceBlock={metrics?.sourceBlock} />
            <MetricDetails metric={theoryWeek} label="Theoretical model week" sourceBlock={metrics?.sourceBlock} />
            {history && (
              <details className="bytes-details">
                <summary>Historical configured emissions</summary>
                <dl>
                  <div><dt>Classification</dt><dd><Badge classification="calculated" /> calculated from observed inputs</dd></div>
                  <div><dt>Source</dt><dd>{history.methodology.source ?? 'Historical staking-contract reconstruction'}</dd></div>
                  {history.sourceBlock != null && <div><dt>Source block</dt><dd>{integerFormatter.format(history.sourceBlock)}</dd></div>}
                  <div><dt>Generated</dt><dd>{formatTimestamp(history.generatedAt)}</dd></div>
                  {history.methodology.normalization && <div><dt>Normalization</dt><dd>{history.methodology.normalization}</dd></div>}
                </dl>
              </details>
            )}
            <p className="bytes-method-note">Configured daily emissions can differ from the modeled curve because contract reward windows are explicitly configured. A positive variance means configured daily emissions are above the modeled daily rate; a negative variance means they are below it.</p>
          </section>
        </aside>
      </div>

      <section className="bytes-footnotes" aria-labelledby="footnotes-heading">
        <p className="bytes-eyebrow">Context &amp; caveats</p>
        <h2 id="footnotes-heading">Footnotes</h2>
        <ol>
          <li><strong>Market Cap*</strong> is the community&apos;s practical shorthand for Ethereum canonical <code>totalSupply() × BYTES/USD spot price</code>. It is not a conventional circulating market capitalization because a defensible circulating-supply figure is not currently available. The spot reference can be affected by liquidity and pool manipulation.</li>
          <li><a href="https://coinmarketcap.com/currencies/neo-tokyo/" target="_blank" rel="noreferrer">CoinMarketCap&apos;s Neo Tokyo listing</a> reflects an older reporting snapshot. On September 17, 2025, Neo Tokyo PM Firestorm and community contributors submitted a deliberately conservative maximum-supply scenario that assumed maximum participation beginning the next day. Actual participation and subsequent issuance did not follow that extreme path, so CMC&apos;s maximum, total, and self-reported circulating figures can now be stale or structurally mismatched. This terminal uses current contract reads instead.</li>
          <li>The projected next-365-day issuance assumes today&apos;s configured S1 and S2 participation remains steady and future configured reward windows continue to track the weekly reference curve. The contract does not execute that curve automatically. This replaces the misleading flat-rate calculation of <code>current daily emissions × 365</code>.</li>
          <li>Staking-contract holdings are shown as a percentage of total supply. The balance includes the BYTES Citizens have committed alongside S1 and S2 positions, but direct transfers can also enter the contract, so the raw balance is not a pure active-principal or circulating-supply definition.</li>
          <li>Pending rewards are refreshed once every 24 hours. They are accrued and unclaimed rewards, not existing supply until they are claimed and minted; inspect the metric for its exact snapshot time.</li>
          <li>Holder counts include addresses with a strictly positive chain-local BYTES balance. The weekly cross-chain figure unions matching lowercase EVM addresses so an address present on both chains counts once. It does not infer whether multiple wallets share one beneficial owner or whether one custodial address represents many users.</li>
          <li>Citizen-staking percentages use original S1 and S2 collection contract <code>totalSupply()</code> values at the same Ethereum block: 2,081 S1 and 3,770 S2 at this release checkpoint. These match the community workbook. Live staked counts and current assembled V2 supplies come from the canonical V2 contracts; because Citizens can be assembled and disassembled, V2 supply is dynamic and is shown separately.</li>
          <li>BYTES 2.0 mechanics are summarized from the official Neo Tokyo reference graphics supplied for this terminal update. The diagrams distinguish individual PPC inputs from pool-level Community Staking Incentives; contract-configured emissions remain the terminal&apos;s live source of truth.</li>
        </ol>
      </section>
    </main>
  );
}
