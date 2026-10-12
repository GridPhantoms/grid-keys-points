'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';

type CreditRow = {
  tokenId: number; creditRating: number; officialRank: number; priceEth: number; priceUsd: number;
  ethPer1kCr: number; checkedAt: string; url: string;
};
type StatementRow = {
  tokenId: number; format: string; stage: string; credits: number; layers: number; creditRating: number;
  priceEth: number; priceUsd: number; ethPer1kCr: number; url: string;
};
type ApiData = {
  fetchedAt: string;
  ethUsd: number;
  caution: string;
  credits: {
    available: boolean; source: string; sourceUpdatedAt: string | null; nextRefresh: string | null;
    checkedAtOldest: string | null; totalLiveListings: number; matchingListings: number; items: CreditRow[];
  };
  statements: { available: boolean; reason: string | null; snapshotAsOf: string; listingPages: number; items: StatementRow[] };
};

function money(value: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: value >= 100 ? 0 : 2 }).format(value);
}

function relativeTime(value: string | null, now: number) {
  if (!value) return 'time unavailable';
  const seconds = Math.max(0, Math.floor((now - Date.parse(value)) / 1000));
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 48) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

function ExternalLink({ url, label }: { url: string; label: string }) {
  return <a href={url} target="_blank" rel="noopener noreferrer" aria-label={label}>OpenSea <span aria-hidden="true">↗</span></a>;
}

export default function ValueFinder() {
  const [tab, setTab] = useState<'credits' | 'statements'>('credits');
  const [minCr, setMinCr] = useState('');
  const [maxEth, setMaxEth] = useState('');
  const [sort, setSort] = useState('best-value');
  const [limit, setLimit] = useState('50');
  const [appliedMinCr, setAppliedMinCr] = useState('');
  const [appliedMaxEth, setAppliedMaxEth] = useState('');
  const [data, setData] = useState<ApiData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [now, setNow] = useState(0);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setAppliedMinCr(minCr);
      setAppliedMaxEth(maxEth);
    }, 400);
    return () => window.clearTimeout(timer);
  }, [minCr, maxEth]);

  const query = useMemo(() => new URLSearchParams({
    ...(appliedMinCr ? { minCr: appliedMinCr } : {}),
    ...(appliedMaxEth ? { maxEth: appliedMaxEth } : {}),
    sort,
    limit,
  }).toString(), [appliedMinCr, appliedMaxEth, sort, limit]);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/credits/value?${query}`, { cache: 'no-store' });
      const payload = await response.json() as ApiData & { error?: string };
      if (!response.ok) throw new Error(payload.error || 'Live value data is unavailable.');
      setData(payload);
      setNow(Date.now());
    } catch (cause) {
      setData(null);
      setError(cause instanceof Error ? cause.message : 'Live value data is unavailable.');
    } finally {
      setLoading(false);
    }
  }, [query]);

  useEffect(() => {
    const initialTimer = window.setTimeout(() => void refresh(), 0);
    const refreshTimer = window.setInterval(() => void refresh(), 5 * 60 * 1000);
    const ageTimer = window.setInterval(() => setNow(Date.now()), 30 * 1000);
    return () => { window.clearTimeout(initialTimer); window.clearInterval(refreshTimer); window.clearInterval(ageTimer); };
  }, [refresh]);

  return (
    <div className="cr-finder">
      <section className="cr-livebar" aria-live="polite">
        <div>
          <span className={`cr-source-dot ${data?.credits.available ? 'is-live' : ''}`} />
          <div>
            <strong>{data?.credits.available ? 'Official CREDITS source available' : loading ? 'Checking live sources…' : 'Live source unavailable'}</strong>
            {data && <small>Fetched {relativeTime(data.fetchedAt, now)} · {new Date(data.fetchedAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}</small>}
            {data?.credits.sourceUpdatedAt && <small>Official snapshot updated {relativeTime(data.credits.sourceUpdatedAt, now)}</small>}
          </div>
        </div>
        <button type="button" onClick={() => void refresh()} disabled={loading}>{loading ? 'Refreshing…' : 'Refresh listings'}</button>
      </section>

      {error && <div className="cr-alert" role="alert"><strong>Live results unavailable.</strong><span>{error}</span></div>}

      <div className="cr-tabs" role="tablist" aria-label="Value type">
        <button type="button" role="tab" aria-selected={tab === 'credits'} onClick={() => setTab('credits')}>CREDITS</button>
        <button type="button" role="tab" aria-selected={tab === 'statements'} onClick={() => setTab('statements')}>Statements</button>
      </div>

      {tab === 'credits' ? (
        <section role="tabpanel" aria-labelledby="credits-results-title">
          <div className="cr-filterbar">
            <label>Minimum CR<input type="number" min="0" max="1000000" inputMode="numeric" value={minCr} onChange={(event) => setMinCr(event.target.value)} placeholder="e.g. 750" /></label>
            <label>Maximum ETH<input type="number" min="0" max="10000" step="0.001" inputMode="decimal" value={maxEth} onChange={(event) => setMaxEth(event.target.value)} placeholder="Any price" /></label>
            <label>Sort by<select value={sort} onChange={(event) => setSort(event.target.value)}><option value="best-value">Best value</option><option value="lowest-price">Lowest price</option><option value="highest-cr">Highest CR</option></select></label>
            <label>Results<select value={limit} onChange={(event) => setLimit(event.target.value)}><option value="25">25</option><option value="50">50</option><option value="100">100</option></select></label>
          </div>
          <div className="cr-results-head"><div><p className="cr-kicker">Loose CREDITS</p><h2 id="credits-results-title">Current listings</h2></div>{data && <span>{data.credits.items.length} shown · {data.credits.matchingListings.toLocaleString()} matching · {data.credits.totalLiveListings.toLocaleString()} live</span>}</div>
          {data && data.credits.items.length === 0 && <p className="cr-empty">No current listings match these filters.</p>}
          {data && data.credits.items.length > 0 && <CreditResults rows={data.credits.items} />}
        </section>
      ) : (
        <section role="tabpanel" aria-labelledby="statement-results-title">
          <div className="cr-results-head"><div><p className="cr-kicker">Statements</p><h2 id="statement-results-title">Top 10 current values</h2></div>{data?.statements.available && <span>Complete listing scope · {data.statements.listingPages} page{data.statements.listingPages === 1 ? '' : 's'}</span>}</div>
          {data && !data.statements.available && <div className="cr-alert"><strong>Statements unavailable for live purchase research.</strong><span>{data.statements.reason}</span></div>}
          {data?.statements.available && data.statements.items.length === 0 && <p className="cr-empty">No active Statement listings matched verified metadata.</p>}
          {data?.statements.available && data.statements.items.length > 0 && <StatementResults rows={data.statements.items} />}
        </section>
      )}

      {data && <p className="cr-caution">{data.caution} Approximate USD uses the Coinbase ETH-USD ticker fetched with this snapshot. Listings recheck automatically every five minutes while this page is open.</p>}
    </div>
  );
}

function CreditResults({ rows }: { rows: CreditRow[] }) {
  return <>
    <div className="cr-table-wrap"><table><thead><tr><th>Token</th><th>Credit Rating</th><th>Official rank</th><th>ETH</th><th>Approx. USD</th><th>ETH / 1K CR</th><th>Listing</th></tr></thead><tbody>{rows.map((row) => <tr key={row.tokenId}><td>#{row.tokenId}</td><td>{row.creditRating.toFixed(1)}</td><td>#{row.officialRank.toLocaleString()}</td><td>{row.priceEth.toFixed(4)}</td><td>{money(row.priceUsd)}</td><td>{row.ethPer1kCr.toFixed(4)}</td><td><ExternalLink url={row.url} label={`Open CREDITS token ${row.tokenId} on OpenSea`} /></td></tr>)}</tbody></table></div>
    <div className="cr-card-list">{rows.map((row) => <article key={row.tokenId}><header><strong>CREDIT #{row.tokenId}</strong><span>Rank #{row.officialRank.toLocaleString()}</span></header><dl><div><dt>Credit Rating</dt><dd>{row.creditRating.toFixed(1)}</dd></div><div><dt>Price</dt><dd>{row.priceEth.toFixed(4)} ETH</dd></div><div><dt>Approx. USD</dt><dd>{money(row.priceUsd)}</dd></div><div><dt>ETH / 1K CR</dt><dd>{row.ethPer1kCr.toFixed(4)}</dd></div></dl><ExternalLink url={row.url} label={`Open CREDITS token ${row.tokenId} on OpenSea`} /></article>)}</div>
  </>;
}

function StatementResults({ rows }: { rows: StatementRow[] }) {
  return <>
    <div className="cr-table-wrap"><table><thead><tr><th>ID</th><th>Format / stage</th><th>Credits / layers</th><th>CR</th><th>ETH</th><th>Approx. USD</th><th>ETH / 1K CR</th><th>Listing</th></tr></thead><tbody>{rows.map((row) => <tr key={row.tokenId}><td>#{row.tokenId}</td><td>{row.format}<small>{row.stage}</small></td><td>{row.credits} / {row.layers}</td><td>{row.creditRating.toLocaleString()}</td><td>{row.priceEth.toFixed(4)}</td><td>{money(row.priceUsd)}</td><td>{row.ethPer1kCr.toFixed(4)}</td><td><ExternalLink url={row.url} label={`Open Statement ${row.tokenId} on OpenSea`} /></td></tr>)}</tbody></table></div>
    <div className="cr-card-list">{rows.map((row) => <article key={row.tokenId}><header><strong>STATEMENT #{row.tokenId}</strong><span>{row.format} · {row.stage}</span></header><dl><div><dt>Credits / layers</dt><dd>{row.credits} / {row.layers}</dd></div><div><dt>Credit Rating</dt><dd>{row.creditRating.toLocaleString()}</dd></div><div><dt>Price</dt><dd>{row.priceEth.toFixed(4)} ETH</dd></div><div><dt>Approx. USD</dt><dd>{money(row.priceUsd)}</dd></div><div><dt>ETH / 1K CR</dt><dd>{row.ethPer1kCr.toFixed(4)}</dd></div></dl><ExternalLink url={row.url} label={`Open Statement ${row.tokenId} on OpenSea`} /></article>)}</div>
  </>;
}
