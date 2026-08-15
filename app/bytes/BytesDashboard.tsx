'use client';

import { useEffect, useState } from 'react';
import { validateBytesMetricsResponse, validateEmissionsHistory } from '../../lib/bytes-client-data.mjs';
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

function isPoolValue(value: unknown): value is EmissionPools {
  return Boolean(value && typeof value === 'object' && 'total' in value);
}

function Badge({ classification }: { classification: string }) {
  return <span className={`bytes-badge bytes-${classification}`}>{classification}</span>;
}

function MetricDetails({ metric, label, sourceBlock }: {
  metric?: MetricRecord<unknown>;
  label: string;
  sourceBlock?: number | null;
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
        {metric.rawValue && <div><dt>{metric.daoTaxExcludedRawValue ? 'Exact calculated aggregate' : metric.classification === 'calculated' ? 'Exact calculated value' : 'Exact contract value'}</dt><dd><code>{metric.rawValue} {metric.unit}</code></dd></div>}
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
        <div className="bytes-split">
          <div><b>{formatNumber(poolValue.S1)}</b><small>S1 pool</small></div>
          <div><b>{formatNumber(poolValue.S2)}</b><small>S2 pool</small></div>
          <div><b>{formatNumber(poolValue.BYTES)}</b><small>BYTES pool</small></div>
          <div><b>{formatNumber(poolValue.LP)}</b><small>LP pool</small></div>
        </div>
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

function AvailabilityRow({ label, metric, sourceBlock }: {
  label: string;
  metric?: MetricRecord<unknown>;
  sourceBlock?: number | null;
}) {
  const isAvailable = metric?.availability === 'available' && typeof metric.value === 'number';
  return (
    <div className="bytes-availability-row">
      <div>
        <span>{label}</span>
        <strong>{isAvailable ? `${formatNumber(metric.value)} ${metric.unit}` : 'Awaiting verified source'}</strong>
      </div>
      <p>{isAvailable ? `${metric.classification === 'calculated' ? 'Calculated from' : 'Verified by'} ${metric.source}.` : metric?.reason ?? 'Canonical definitions and contract provenance have not yet been verified.'}</p>
      <MetricDetails metric={metric} label={`Inspect ${label.toLowerCase()} methodology`} sourceBlock={sourceBlock} />
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
  const annualized = metrics?.metrics.annualizedConfiguredIssuance;
  const divergence = metrics?.metrics.configuredVsTheoretical;
  const theoryWeek = metrics?.metrics.theoreticalWeek;
  const avalancheSupply = metrics?.metrics.avalancheBytesSupply;
  const bytesPrice = metrics?.metrics.bytesPriceUsd;
  const totalSupplyValuation = metrics?.metrics.totalSupplyValuationUsd;
  const circulatingMarketCap = metrics?.metrics.circulatingMarketCapUsd;
  const steady = metrics?.projections.steadyParticipationRemainingIssuance;
  const maximum = metrics?.projections.maximumParticipationRemainingIssuance;
  const sourceAsOf = configured?.asOf ?? metrics?.generatedAt;
  const avalancheSourceBlock = metrics?.provenance.avalanche.sourceBlock;
  const allLoading = !metricsDone && !historyDone;

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

      <div className="bytes-notice"><strong>Observed first.</strong> Headline emissions come from configured staking-contract windows. Calculated and projected values remain visibly separate.</div>

      {allLoading ? <div className="bytes-loading" role="status" aria-live="polite">Loading live metrics and emissions history…</div> : null}
      {metricsDone && !metrics ? <div className="bytes-message" role="status">Live contract metrics are temporarily unavailable. Historical emissions remain available below when loaded.</div> : null}
      {historyDone && !history ? <div className="bytes-message" role="status">Historical emissions could not be loaded. Live contract metrics remain available above when loaded.</div> : null}
      {metrics?.warnings?.length ? <div className="bytes-message" role="status">Partial source response: {metrics.warnings.join(' ')}</div> : null}

      <section className="bytes-stats" aria-label="Current BYTES metrics">
        <StatCard label="Configured emissions" metric={configured} pools />
        <StatCard label="Modeled current rate" metric={modeled} />
        <StatCard label="Annualized configured issuance" metric={annualized} />
        <StatCard label="Configured minus theoretical" metric={divergence} signed />
      </section>

      <section className="bytes-stats bytes-market-stats" aria-label="BYTES supply and valuation metrics">
        <StatCard label="BYTES spot price" metric={bytesPrice} digits={4} prefix="$" />
        <StatCard label="Ethereum canonical total-supply valuation" metric={totalSupplyValuation} prefix="$" />
        <StatCard label="Avalanche chain-local supply" metric={avalancheSupply} digits={2} />
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
            <ScenarioCard title="Steady participation" description="The verified 5,875 BYTES/day combined S1 and S2 reservoir continues along the weekly decay model." metric={steady} sourceBlock={metrics?.sourceBlock} />
            <ScenarioCard title="Maximum participation" description="Upper-bound comparison using the full 11,000 BYTES/day launch reservoir at the same model week." metric={maximum} sourceBlock={metrics?.sourceBlock} />
          </div>

          <div className="bytes-context"><strong>Supply-side context:</strong> Lower new issuance can require less demand to absorb emissions, but it does not guarantee price appreciation. Demand, liquidity, holder behavior, and wider market conditions still matter.</div>
        </section>

        <aside className="bytes-side">
          <section className="bytes-panel" aria-labelledby="valuation-heading">
            <div className="bytes-panel-head"><div><p className="bytes-eyebrow">Cross-chain accounting</p><h2 id="valuation-heading">Supply &amp; valuation</h2></div></div>
            <p className="bytes-panel-copy">Avalanche chain-local supply is observed independently at its own source block. Ethereum Canonical Total-Supply Valuation uses Ethereum supply once because the verified Avalanche CCIP BurnMint balance represents bridged tokens. It is not market cap. Price references the <a href="https://www.dextools.io/app/en/ether/pair-explorer/0xfeb09c7e130a4b87b27ebd648ec485657b688b34" target="_blank" rel="noreferrer">Ethereum BYTES/WETH pair on DEXTools</a>.</p>
            <AvailabilityRow label="Avalanche chain-local BYTES supply" metric={avalancheSupply} sourceBlock={avalancheSourceBlock} />
            <AvailabilityRow label="BYTES spot price" metric={bytesPrice} sourceBlock={metrics?.sourceBlock} />
            <AvailabilityRow label="Ethereum canonical total-supply valuation — not market cap" metric={totalSupplyValuation} sourceBlock={metrics?.sourceBlock} />
            <AvailabilityRow label="Market cap" metric={circulatingMarketCap} sourceBlock={metrics?.sourceBlock} />
          </section>


          <section className="bytes-panel" aria-labelledby="supply-heading">
            <div className="bytes-panel-head"><div><p className="bytes-eyebrow">Verification gate</p><h2 id="supply-heading">Supply &amp; staking status</h2></div></div>
            <p className="bytes-panel-copy">Ethereum BYTES total supply, the staking contract’s token balance, and the net pending reward snapshot aggregate across indexed stakers are sourced on-chain. Circulating and maximum-supply figures remain unavailable until separately verified.</p>
            <AvailabilityRow label="Ethereum BYTES 2.0 total supply" metric={metrics?.metrics.ethBytes2Supply} sourceBlock={metrics?.sourceBlock} />
            <AvailabilityRow label="BYTES held by staking contract" metric={metrics?.metrics.bytesHeldByStakingContract} sourceBlock={metrics?.sourceBlock} />
            <AvailabilityRow label="Pending / Unclaimed Rewards" metric={metrics?.metrics.pendingUnclaimedRewards} sourceBlock={metrics?.sourceBlock} />
          </section>

          <section className="bytes-panel" aria-labelledby="ledger-heading">
            <div className="bytes-panel-head"><div><p className="bytes-eyebrow">No black box</p><h2 id="ledger-heading">Methodology ledger</h2><p>Every published number names what it is.</p></div></div>
            <div className="bytes-class-key" aria-label="Metric classifications">
              <Badge classification="observed" /><span>direct contract source data</span>
              <Badge classification="calculated" /><span>derived or reconstructed from observed inputs</span>
              <Badge classification="projected" /><span>scenario output with assumptions</span>
            </div>
            <MetricDetails metric={configured} label="Configured emissions" sourceBlock={metrics?.sourceBlock} />
            <MetricDetails metric={modeled} label="Modeled current rate" sourceBlock={metrics?.sourceBlock} />
            <MetricDetails metric={annualized} label="Annualized configured issuance" sourceBlock={metrics?.sourceBlock} />
            <MetricDetails metric={divergence} label="Configured-minus-theoretical divergence" sourceBlock={metrics?.sourceBlock} />
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
            <p className="bytes-method-note">Configured emissions can differ from the formula curve because contract reward windows are explicitly configured. The divergence is shown rather than reconciled away.</p>
          </section>
        </aside>
      </div>
    </main>
  );
}
