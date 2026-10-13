'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

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
    checkedAtOldest: string | null; totalLiveListings: number; matchingListings: number; snapshotMatchingListings: number;
    freshValidatedAt: string | null; freshCandidatesChecked: number; validationScopeComplete: boolean;
    moreCandidatesRemain: boolean; items: CreditRow[];
  };
  statements: {
    available: boolean; reason: string | null; snapshotAsOf: string; listingPages: number;
    listingCheckedAt: string | null; metadataCoverage: { matched: number; listed: number }; items: StatementRow[];
  };
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

function truncateRating(value: number) {
  return (Math.trunc(value * 100) / 100).toFixed(2);
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
  const requestId = useRef(0);
  const requestController = useRef<AbortController | null>(null);

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

  const refresh = useCallback(async (mode: 'auto' | 'manual' | 'snapshot' = 'auto') => {
    const activeRequest = ++requestId.current;
    requestController.current?.abort();
    const controller = new AbortController();
    requestController.current = controller;
    setLoading(true);
    setError(null);
    setData(null);
    try {
      const params = new URLSearchParams(query);
      if (mode !== 'snapshot') params.set('refresh', mode);
      const response = await fetch(`/api/credits/value?${params}`, { cache: 'no-store', signal: controller.signal });
      const payload = await response.json() as ApiData & { error?: string };
      if (!response.ok) throw new Error(payload.error || 'Live value data is unavailable.');
      if (activeRequest !== requestId.current) return;
      setData(payload);
      setNow(Date.now());
    } catch (cause) {
      if (controller.signal.aborted || activeRequest !== requestId.current) return;
      setData(null);
      setError(cause instanceof Error ? cause.message : 'Live value data is unavailable.');
    } finally {
      if (activeRequest === requestId.current) setLoading(false);
    }
  }, [query]);

  useEffect(() => {
    const initialTimer = window.setTimeout(() => void refresh('auto'), 0);
    const refreshTimer = window.setInterval(() => {
      if (document.visibilityState === 'visible') void refresh('auto');
    }, 15 * 60 * 1000);
    const ageTimer = window.setInterval(() => setNow(Date.now()), 30 * 1000);
    const onVisibility = () => {
      if (document.visibilityState === 'visible') void refresh('auto');
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      requestController.current?.abort();
      window.clearTimeout(initialTimer);
      window.clearInterval(refreshTimer);
      window.clearInterval(ageTimer);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [refresh]);

  const selectTab = (next: 'credits' | 'statements') => {
    document.getElementById(`${next}-tab`)?.focus();
    setTab(next);
  };

  return (
    <div className="cr-finder">
      <section className="cr-livebar" aria-live="polite">
        <div>
          <span className={`cr-source-dot ${data?.credits.available ? 'is-live' : ''}`} />
          <div>
            <strong>{data?.credits.freshValidatedAt ? 'Visible CREDITS verified directly with OpenSea' : loading ? 'Finding and verifying current listings…' : data?.credits.available ? 'Official CREDITS snapshot available' : 'Live source unavailable'}</strong>
            {data && <small>Fetched {relativeTime(data.fetchedAt, now)} · {new Date(data.fetchedAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}</small>}
            {data?.credits.sourceUpdatedAt && <small>Official candidate snapshot updated {relativeTime(data.credits.sourceUpdatedAt, now)}</small>}
            {data?.credits.freshValidatedAt && <small>{data.credits.freshCandidatesChecked} candidates checked directly with OpenSea {relativeTime(data.credits.freshValidatedAt, now)}</small>}
          </div>
        </div>
        <button type="button" onClick={() => void refresh('manual')} disabled={loading}>{loading ? 'Checking OpenSea…' : 'Recheck with OpenSea'}</button>
      </section>

      {error && <div className="cr-alert" role="alert"><strong>Live results unavailable.</strong><span>{error}</span></div>}

      <div className="cr-tabs" role="tablist" aria-label="Value type">
        <button id="credits-tab" type="button" role="tab" aria-controls="credits-panel" aria-selected={tab === 'credits'} tabIndex={tab === 'credits' ? 0 : -1} onKeyDown={(event) => { if (event.key === 'ArrowRight') selectTab('statements'); }} onClick={() => setTab('credits')}>CREDITS</button>
        <button id="statements-tab" type="button" role="tab" aria-controls="statements-panel" aria-selected={tab === 'statements'} tabIndex={tab === 'statements' ? 0 : -1} onKeyDown={(event) => { if (event.key === 'ArrowLeft') selectTab('credits'); }} onClick={() => setTab('statements')}>Statements</button>
      </div>

      {tab === 'credits' ? (
        <section id="credits-panel" role="tabpanel" aria-labelledby="credits-tab">
          <div className="cr-filterbar">
            <label>Minimum CR<input type="number" min="0" max="1000000" inputMode="numeric" value={minCr} onChange={(event) => setMinCr(event.target.value)} placeholder="e.g. 750" /></label>
            <label>Maximum ETH<input type="number" min="0" max="10000" step="0.001" inputMode="decimal" value={maxEth} onChange={(event) => setMaxEth(event.target.value)} placeholder="Any price" /></label>
            <label>Sort by<select value={sort} onChange={(event) => setSort(event.target.value)}><option value="best-value">Best value</option><option value="lowest-price">Lowest price</option><option value="highest-cr">Highest CR</option></select></label>
            <label>Results<select value={limit} onChange={(event) => setLimit(event.target.value)}><option value="25">25</option><option value="50">50</option><option value="100">100</option></select></label>
          </div>
          <div className="cr-results-head"><div><p className="cr-kicker">Loose CREDITS</p><h2>OpenSea-verified listings</h2></div>{data && <span>{data.credits.items.length} shown · {data.credits.matchingListings.toLocaleString()} verified in {data.credits.freshCandidatesChecked.toLocaleString()} checked · {data.credits.snapshotMatchingListings.toLocaleString()} snapshot matches</span>}</div>
          {data && data.credits.items.length === 0 && <p className="cr-empty">No verified listings were found in the checked candidate window{data.credits.moreCandidatesRemain ? '; additional snapshot candidates remain unchecked.' : '.'}</p>}
          {data && data.credits.items.length > 0 && <CreditResults rows={data.credits.items} />}
        </section>
      ) : (
        <section id="statements-panel" role="tabpanel" aria-labelledby="statements-tab">
          <div className="cr-results-head"><div><p className="cr-kicker">Statements</p><h2>Top 10 verified values</h2></div>{data?.statements.available && <span>{data.statements.metadataCoverage.matched}/{data.statements.metadataCoverage.listed} orders matched daily metadata · {data.statements.listingPages} page{data.statements.listingPages === 1 ? '' : 's'}</span>}</div>
          {data?.statements.available && <p className="cr-scope-note">Orders checked {relativeTime(data.statements.listingCheckedAt, now)} · Statement metadata from {new Date(data.statements.snapshotAsOf).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short', timeZone: 'UTC' })} UTC</p>}
          {data && !data.statements.available && <div className="cr-alert"><strong>Statements unavailable for live purchase research.</strong><span>{data.statements.reason}</span></div>}
          {data?.statements.available && data.statements.items.length === 0 && <p className="cr-empty">No active Statement listings matched the verified daily metadata.</p>}
          {data?.statements.available && data.statements.items.length > 0 && <StatementResults rows={data.statements.items} />}
        </section>
      )}

      {data && <p className="cr-caution">CR means Credit Rating. Lower ETH per 1K CR ranks more rating for less ETH; it is not a return estimate. {data.caution} Approximate USD uses the Coinbase ETH-USD ticker fetched with this request. Visible tabs recheck every 15 minutes; hidden tabs pause and recheck on return.</p>}
    </div>
  );
}

function CreditResults({ rows }: { rows: CreditRow[] }) {
  return <>
    <div className="cr-table-wrap"><table><thead><tr><th>Token</th><th>Credit Rating</th><th>Official rank</th><th>ETH</th><th>Approx. USD</th><th>ETH / 1K CR</th><th>Listing</th></tr></thead><tbody>{rows.map((row) => <tr key={row.tokenId}><td>#{row.tokenId}</td><td>{truncateRating(row.creditRating)}</td><td>#{row.officialRank.toLocaleString()}</td><td>{row.priceEth.toFixed(4)}</td><td>{money(row.priceUsd)}</td><td>{row.ethPer1kCr.toFixed(4)}</td><td><ExternalLink url={row.url} label={`Open CREDITS token ${row.tokenId} on OpenSea`} /></td></tr>)}</tbody></table></div>
    <div className="cr-card-list">{rows.map((row) => <article key={row.tokenId}><header><strong>CREDIT #{row.tokenId}</strong><span>Rank #{row.officialRank.toLocaleString()}</span></header><dl><div><dt>Credit Rating</dt><dd>{truncateRating(row.creditRating)}</dd></div><div><dt>Price</dt><dd>{row.priceEth.toFixed(4)} ETH</dd></div><div><dt>Approx. USD</dt><dd>{money(row.priceUsd)}</dd></div><div><dt>ETH / 1K CR</dt><dd>{row.ethPer1kCr.toFixed(4)}</dd></div></dl><ExternalLink url={row.url} label={`Open CREDITS token ${row.tokenId} on OpenSea`} /></article>)}</div>
  </>;
}

function StatementResults({ rows }: { rows: StatementRow[] }) {
  return <>
    <div className="cr-table-wrap"><table><thead><tr><th>ID</th><th>Format / stage</th><th>Credits / layers</th><th>CR</th><th>ETH</th><th>Approx. USD</th><th>ETH / 1K CR</th><th>Listing</th></tr></thead><tbody>{rows.map((row) => <tr key={row.tokenId}><td>#{row.tokenId}</td><td>{row.format}<small>{row.stage}</small></td><td>{row.credits} / {row.layers}</td><td>{row.creditRating.toLocaleString()}</td><td>{row.priceEth.toFixed(4)}</td><td>{money(row.priceUsd)}</td><td>{row.ethPer1kCr.toFixed(4)}</td><td><ExternalLink url={row.url} label={`Open Statement ${row.tokenId} on OpenSea`} /></td></tr>)}</tbody></table></div>
    <div className="cr-card-list">{rows.map((row) => <article key={row.tokenId}><header><strong>STATEMENT #{row.tokenId}</strong><span>{row.format} · {row.stage}</span></header><dl><div><dt>Credits / layers</dt><dd>{row.credits} / {row.layers}</dd></div><div><dt>Credit Rating</dt><dd>{row.creditRating.toLocaleString()}</dd></div><div><dt>Price</dt><dd>{row.priceEth.toFixed(4)} ETH</dd></div><div><dt>Approx. USD</dt><dd>{money(row.priceUsd)}</dd></div><div><dt>ETH / 1K CR</dt><dd>{row.ethPer1kCr.toFixed(4)}</dd></div></dl><ExternalLink url={row.url} label={`Open Statement ${row.tokenId} on OpenSea`} /></article>)}</div>
  </>;
}
