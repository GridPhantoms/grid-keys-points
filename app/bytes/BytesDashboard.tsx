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

function StatCard({ label, metric, signed = false, pools = false, digits = 0, prefix = '' }: {
  label: string;
  metric?: MetricRecord<unknown>;
  signed?: boolean;
  pools?: boolean;
  digits?: number;
  prefix?: string;
}) {
  const poolValue = metric && isPoolValue(metric.value) ? metric.value : null;
  const legacyEmissionTotal = poolValue && typeof poolValue.BYTES === 'number' && typeof poolValue.LP === 'number'
    ? poolValue.BYTES + poolValue.LP
    : null;
  const formatted = poolValue ? formatNumber(poolValue.total) : signed ? formatSigned(metric?.value) : formatNumber(metric?.value, digits);
  const display = formatted === 'Unavailable' ? formatted : `${prefix}${formatted}`;
  return (
    <article className="bytes-card">
      <div className="bytes-card-label">
        <span>{label}</span>
        {metric ? <Badge classification={metric.classification} /> : <span className="bytes-badge">waiting</span>}
      </div>
      <div className={metric?.availability === 'available' && metric.classification !== 'projected' ? 'bytes-value bytes-cyan' : 'bytes-value'}>{display}</div>
      <div className="bytes-unit">{metric?.availability === 'available' ? metric.unit : metric?.reason ?? 'Waiting for live metrics'}</div>
      {pools && poolValue ? (
        <>
          <div className="bytes-split">
            <div><b>{formatNumber(poolValue.S1)}</b><small>S1 pool</small></div>
            <div><b>{formatNumber(poolValue.S2)}</b><small>S2 pool</small></div>
          </div>
          {legacyEmissionTotal !== null && legacyEmissionTotal > 0 ? <p className="bytes-contract-alert">Additional configured legacy asset-type emissions: {formatNumber(legacyEmissionTotal)} BYTES/day. Inspect methodology.</p> : null}
        </>
      ) : null}
      {poolValue && !pools ? (
        <div className="bytes-split">
          <div><b>{formatNumber(poolValue.S1)}</b><small>S1 model</small></div>
          <div><b>{formatNumber(poolValue.S2)}</b><small>S2 model</small></div>
        </div>
      ) : null}
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
  const pendingRewardsPercentage = ethereumSupply?.availability === 'available'
    && pendingRewards?.availability === 'available'
    && typeof ethereumSupply.value === 'number'
    && typeof pendingRewards.value === 'number'
    && ethereumSupply.value > 0
    ? (pendingRewards.value / ethereumSupply.value) * 100
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
          <p className="bytes-lede">Contract-configured emissions, modeled decay, and supply research—separated by evidence class and shown with visible provenance.</p>
        </div>
        <div className="bytes-stamp" aria-label="Source status">
          <div className={`bytes-source-status ${metrics ? 'is-online' : ''}`}><i aria-hidden="true" />{metrics ? `${metrics.status} contract snapshot` : metricsDone ? 'Live metrics unavailable' : 'Connecting to metrics source'}</div>
          <div>Ethereum block {metrics?.sourceBlock ? metrics.sourceBlock.toLocaleString('en-US') : 'unavailable'}</div>
          <div>Source as of {formatTimestamp(sourceAsOf)}</div>
          <div>Last refresh {formatTimestamp(lastRefresh ?? undefined)}</div>
        </div>
      </section>

      <div className="bytes-notice bytes-community-credit"><strong>Community groundwork.</strong> <a href="https://x.com/0xSanSSerif" target="_blank" rel="noreferrer">@0xSanSSerif</a> spent years doing exhaustive manual work on BytesMetrics.io, helping make BYTES tokenomics legible and paving the way for this terminal. His original database was compromised, but the contribution deserves to be remembered.</div>
      <div className="bytes-notice"><strong>Observed first.</strong> Headline emissions come from configured staking-contract windows. Calculated and projected values remain visibly separate.</div>

      {allLoading ? <div className="bytes-loading" role="status" aria-live="polite">Loading live metrics and emissions history…</div> : null}
      {metricsDone && !metrics ? <div className="bytes-message" role="status">Live contract metrics are temporarily unavailable. Historical emissions remain available below when loaded.</div> : null}
      {historyDone && !history ? <div className="bytes-message" role="status">Historical emissions could not be loaded. Live contract metrics remain available above when loaded.</div> : null}
      {metrics?.warnings?.length ? <div className="bytes-message" role="status">Partial source response: {metrics.warnings.join(' ')}</div> : null}

      <section className="bytes-stats" aria-label="Current BYTES metrics">
        <StatCard label="Configured daily emissions" metric={configured} pools />
        <StatCard label="Modeled current daily rate" metric={modeled} />
        <StatCard label="Projected next-365-day issuance" metric={next365DayIssuance} />
        <StatCard label="Configured vs. modeled variance" metric={divergence} signed />
      </section>

      <section className="bytes-stats bytes-market-stats" aria-label="BYTES supply and valuation metrics">
        <StatCard label="BYTES spot price" metric={bytesPrice} digits={4} prefix="$" />
        <StatCard label="Ethereum chain-local total supply" metric={ethereumSupply} digits={2} />
        <StatCard label="Market cap*" metric={totalSupplyValuation} prefix="$" />
      </section>

      <div className="bytes-layout">
        <section className="bytes-panel bytes-chart-panel" aria-labelledby="emissions-heading">
          <div className="bytes-panel-head">
            <div><p className="bytes-eyebrow">Reconstructed configured history + explicit model</p><h2 id="emissions-heading">Emissions Decay</h2><p>Calculated daily reward windows reconstructed from observed inputs, compared with the theoretical weekly curve.</p></div>
            {history && <span className="bytes-sample-count">{history.rows.length.toLocaleString('en-US')} daily samples</span>}
          </div>
          {history ? <EmissionsChart rows={history.rows} /> : historyDone ? <div className="bytes-chart-placeholder">Historical chart unavailable.</div> : <div className="bytes-chart-placeholder">Loading historical series…</div>}

          <div className="bytes-scenarios" aria-labelledby="scenario-heading">
            <h2 id="scenario-heading" className="bytes-section-title">Remaining issuance scenarios</h2>
            <ScenarioCard title="Steady participation" description="Reservoir means the model's week-zero daily allocation before decay. This scenario starts with the verified 5,875 BYTES/day combined S1 and S2 baseline, then applies weekly decay; 5,875 is not today's issuance." metric={steady} sourceBlock={metrics?.sourceBlock} />
            <ScenarioCard title="Maximum participation" description="The 11,000 BYTES/day reservoir is the theoretical maximum week-zero allocation. It is decayed to the same model week for an upper-bound comparison, not presented as today's issuance." metric={maximum} sourceBlock={metrics?.sourceBlock} />
          </div>

          <div className="bytes-context"><strong>Supply-side context:</strong> Lower new issuance can require less demand to absorb potential emissions-driven sell pressure, but it does not guarantee price appreciation. Emissions only become sell pressure when recipients sell; demand, liquidity, holder behavior, and wider market conditions still matter.</div>
        </section>

        <aside className="bytes-side">
          <section className="bytes-panel" aria-labelledby="valuation-heading">
            <div className="bytes-panel-head"><div><p className="bytes-eyebrow">Cross-chain accounting</p><h2 id="valuation-heading">Supply &amp; valuation</h2></div></div>
            <p className="bytes-panel-copy">Ethereum and Avalanche supplies are shown side by side but never added: verified Avalanche CCIP BurnMint units represent bridged BYTES while Ethereum uses lock/release accounting. Market Cap* uses Ethereum supply once. Price references the <a href="https://www.dextools.io/app/en/ether/pair-explorer/0xfeb09c7e130a4b87b27ebd648ec485657b688b34" target="_blank" rel="noreferrer">Ethereum BYTES/WETH pair on DEXTools</a>.</p>
            <AvailabilityRow label="Ethereum chain-local total supply" metric={ethereumSupply} sourceBlock={metrics?.sourceBlock} />
            <AvailabilityRow label="Avalanche chain-local BYTES supply" metric={avalancheSupply} sourceBlock={avalancheSourceBlock} />
            <AvailabilityRow label="Market Cap*" metric={totalSupplyValuation} sourceBlock={metrics?.sourceBlock} valuePrefix="$" />
            <AvailabilityRow label="BYTES spot price" metric={bytesPrice} sourceBlock={metrics?.sourceBlock} valuePrefix="$" />
          </section>

          <section className="bytes-panel" aria-labelledby="supply-heading">
            <div className="bytes-panel-head"><div><p className="bytes-eyebrow">Verification gate</p><h2 id="supply-heading">Staking status</h2></div></div>
            <p className="bytes-panel-copy">The staking contract’s BYTES balance and the net pending reward snapshot aggregate across indexed stakers are sourced on-chain.</p>
            <AvailabilityRow label="BYTES held by staking contract" metric={stakingBalance} sourceBlock={metrics?.sourceBlock} valueNote={stakingPercentage === null ? undefined : `${formatPercentage(stakingPercentage)} of Ethereum total supply`} />
            <AvailabilityRow label="Pending / Unclaimed Rewards" metric={pendingRewards} sourceBlock={metrics?.sourceBlock} valueNote={pendingRewardsPercentage === null ? undefined : `${formatPercentage(pendingRewardsPercentage)} relative to current Ethereum total supply`} />
          </section>

          <section className="bytes-panel" aria-labelledby="ledger-heading">
            <div className="bytes-panel-head"><div><p className="bytes-eyebrow">Transparent by design</p><h2 id="ledger-heading">Methodology ledger</h2><p>Every published number names what it is.</p></div></div>
            <div className="bytes-class-key" aria-label="Metric classifications">
              <Badge classification="observed" /><span>direct contract source data</span>
              <Badge classification="calculated" /><span>derived or reconstructed from observed inputs</span>
              <Badge classification="projected" /><span>scenario output with assumptions</span>
            </div>
            <MetricDetails metric={configured} label="Configured daily emissions" sourceBlock={metrics?.sourceBlock} />
            <MetricDetails metric={modeled} label="Modeled current daily rate" sourceBlock={metrics?.sourceBlock} />
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

      <section className="bytes-human-section" aria-labelledby="plain-english-heading">
        <p className="bytes-eyebrow">The human read</p>
        <h2 id="plain-english-heading">In plain English</h2>
        <div className="bytes-human-grid">
          <p>Neo Tokyo&apos;s economy began with loud staking incentives. The curve is now doing what it was designed to do: making new issuance quieter over time. The staking contract is currently configured to emit about <strong>{configured?.availability === 'available' && isPoolValue(configured.value) ? `${formatNumber(configured.value.total)} BYTES per day` : 'an unavailable amount'}</strong>, while the Neo Tokyo staking contract holds <strong>{stakingPercentage === null ? 'an unavailable share' : formatPercentage(stakingPercentage)}</strong> of Ethereum total supply, including the BYTES that Citizens have staked alongside their S1s and S2s.</p>
          <p>Assuming participation stays near today&apos;s level and the verified weekly decay continues, the model projects about <strong>{next365DayIssuance?.availability === 'available' ? `${integerFormatter.format(next365DayIssuance.value)} BYTES` : 'an unavailable amount'}</strong> of issuance over the next 365 days. The next Genesis half-level is projected for <strong>{nextMilestone ? dateFormatter.format(new Date(nextMilestone.asOf)) : 'an unavailable date'}</strong>, when modeled S1 emissions reach {nextMilestone ? formatNumber(nextMilestone.s1DailyRate) : '—'} BYTES per day.</p>
          <p>The early curve sent much more reward inventory to stakers than today&apos;s curve does. Whether those rewards were held or sold is not measured here. If attention and demand return in a true bull market, they would meet a lighter modeled emissions stream than in the early years. That relationship is mechanical; it does not establish demand, predict price, or quantify actual selling.</p>
          <p>The tokenomics strength is the predictable decay: fewer new units enter the system as time passes. This terminal does not measure liquidity depth, holder concentration, or realized volatility, and its price input is one verified spot reference rather than a promise of executable size. For the citizens still watching the city&apos;s economy, the goal is to keep the mechanics honest without sanding off the uncertainty.</p>
        </div>
      </section>

      <section className="bytes-footnotes" aria-labelledby="footnotes-heading">
        <p className="bytes-eyebrow">Context &amp; caveats</p>
        <h2 id="footnotes-heading">Footnotes</h2>
        <ol>
          <li><strong>Market Cap*</strong> is the community&apos;s practical shorthand for Ethereum canonical <code>totalSupply() × BYTES/USD spot price</code>. It is not a conventional circulating market capitalization because a defensible circulating-supply figure is not currently available. The spot reference can be affected by liquidity and pool manipulation.</li>
          <li><a href="https://coinmarketcap.com/currencies/neo-tokyo/" target="_blank" rel="noreferrer">CoinMarketCap&apos;s Neo Tokyo listing</a> reflects an older reporting snapshot. On September 17, 2025, Neo Tokyo PM Firestorm and community contributors submitted a deliberately conservative maximum-supply scenario that assumed maximum participation beginning the next day. Actual participation and subsequent issuance did not follow that extreme path, so CMC&apos;s maximum, total, and self-reported circulating figures can now be stale or structurally mismatched. This terminal uses current contract reads instead.</li>
          <li>The projected next-365-day issuance assumes today&apos;s configured S1 and S2 participation remains steady while the weekly decay continues. It replaces the misleading flat-rate calculation of <code>current daily emissions × 365</code>.</li>
          <li>Staking-contract holdings are shown as a percentage of Ethereum total supply. The balance includes the BYTES that Citizens have staked alongside their S1s and S2s, but direct transfers can also enter the contract, so the raw balance is not a pure active-principal or circulating-supply definition.</li>
          <li>Pending rewards are refreshed once every 24 hours and shown relative to current Ethereum total supply for scale. They are accrued and unclaimed rewards, not existing supply until they are claimed and minted; inspect the metric for its exact snapshot time.</li>
        </ol>
      </section>
    </main>
  );
}
