'use client';

import { FormEvent, useRef, useState } from 'react';

type CreditRow = {
  tokenId: number;
  creditRating: number;
  officialRank: number;
  estimateEth: number;
  estimateUsd: number;
  url: string;
};

type StatementRow = {
  tokenId: number;
  format: string;
  stage: string;
  credits: number;
  layers: number;
  creditRating: number;
  estimateEth: number;
  estimateUsd: number;
  url: string;
};

type Benchmark = {
  sampleTokenIds: number[];
  lowEthPer1kCr: number;
  midEthPer1kCr: number;
  highEthPer1kCr: number;
};

type ValueSummary = {
  count: number;
  totalCr: number;
  estimateEth: number;
  estimateUsd: number;
  rangeLowEth: number;
  rangeHighEth: number;
  rangeLowUsd: number;
  rangeHighUsd: number;
};

type Appraisal = {
  wallet: string;
  ens: string | null;
  capturedAt: string;
  ethUsd: number;
  methodology: string;
  benchmark: Benchmark;
  statementBenchmark: Benchmark | null;
  summary: ValueSummary;
  statementSummary: ValueSummary;
  portfolio: Omit<ValueSummary, 'count'> & { assetCount: number };
  credits: CreditRow[];
  statements: StatementRow[];
  ownership: { source: string; credits: number; statements: number };
  market: {
    source: string;
    sourceUpdatedAt: string | null;
    candidatesChecked: number;
    verifiedCount: number;
    confidence: 'moderate' | 'limited';
    ethUsdSource: string;
    ethUsdCheckedAt: string;
  };
  statementMarket: {
    source: string;
    listingCheckedAt: string;
    listingCount: number;
    pages: number;
    sampleCount: number;
    confidence: 'moderate' | 'limited';
  } | null;
};

function money(value: number) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: value >= 100 ? 0 : 2,
  }).format(value);
}

function eth(value: number) {
  return value.toLocaleString('en-US', { minimumFractionDigits: 4, maximumFractionDigits: 4 });
}

function cr(value: number) {
  return value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function walletLabel(value: string) {
  return `${value.slice(0, 6)}…${value.slice(-4)}`;
}

export default function WalletLab() {
  const [wallet, setWallet] = useState('');
  const [data, setData] = useState<Appraisal | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const controller = useRef<AbortController | null>(null);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const input = wallet.trim();
    if (!input) return;
    controller.current?.abort();
    const request = new AbortController();
    controller.current = request;
    setLoading(true);
    setError(null);
    setData(null);
    try {
      const response = await fetch('/api/credits/wallet-lab-41eff0a315b4', {
        method: 'POST',
        cache: 'no-store',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ wallet: input }),
        signal: request.signal,
      });
      const payload = await response.json() as Appraisal & { error?: string };
      if (!response.ok) throw new Error(payload.error || 'Wallet appraisal is unavailable.');
      setData(payload);
    } catch (cause) {
      if (request.signal.aborted) return;
      setError(cause instanceof Error ? cause.message : 'Wallet appraisal is unavailable.');
    } finally {
      if (!request.signal.aborted) setLoading(false);
    }
  };

  return (
    <div className="cr-wallet-lab">
      <form className="cr-wallet-form" onSubmit={submit}>
        <label htmlFor="wallet-lab-input">Ethereum wallet or ENS</label>
        <div>
          <input
            id="wallet-lab-input"
            value={wallet}
            onChange={(event) => setWallet(event.target.value)}
            placeholder="0x… or name.eth"
            autoComplete="off"
            autoCapitalize="none"
            spellCheck={false}
            maxLength={128}
          />
          <button type="submit" disabled={loading || !wallet.trim()}>{loading ? 'Checking wallet…' : 'Appraise holdings'}</button>
        </div>
        <small>Read-only CREDITS and Statements lookup. No wallet connection, signature or approval.</small>
      </form>

      {error && <div className="cr-alert" role="alert"><strong>Lookup unavailable.</strong><span>{error}</span></div>}
      {loading && <div className="cr-wallet-loading" role="status"><span /><div><strong>Reading holdings and verifying both markets</strong><small>Ownership, official ratings, Statement metadata and current asks are checked independently.</small></div></div>}

      {data && (
        <section className="cr-appraisal" aria-live="polite">
          <div className="cr-appraisal-head">
            <div>
              <p className="cr-kicker">OpenSea-visible direct holdings</p>
              <h2>{data.ens || walletLabel(data.wallet)}</h2>
              {data.ens && <small>{walletLabel(data.wallet)}</small>}
            </div>
            <span>Checked {new Date(data.capturedAt).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}</span>
          </div>

          {data.portfolio.assetCount === 0 ? (
            <div className="cr-wallet-empty">
              <strong>No CREDITS or Statements found</strong>
              <p>OpenSea returned no visible direct holdings from either collection for this wallet. Manually hidden assets may not appear.</p>
            </div>
          ) : (
            <>
              <div className="cr-appraisal-grid">
                <article><span>Direct holdings</span><strong>{data.summary.count} + {data.statementSummary.count}</strong><small>CREDITS + Statements</small></article>
                <article><span>Total Credit Rating</span><strong>{cr(data.portfolio.totalCr)}</strong><small>across both collections</small></article>
                <article className="is-primary"><span>Portfolio estimate</span><strong>{eth(data.portfolio.estimateEth)}Ξ</strong><small>{money(data.portfolio.estimateUsd)}</small></article>
              </div>
              <div className="cr-range-card">
                <div><span>Current portfolio replacement range</span><strong>{eth(data.portfolio.rangeLowEth)}–{eth(data.portfolio.rangeHighEth)}Ξ</strong><small>{money(data.portfolio.rangeLowUsd)}–{money(data.portfolio.rangeHighUsd)}</small></div>
                <div><span>Assets appraised</span><strong>{data.portfolio.assetCount}</strong><small>{data.summary.count} loose · {data.statementSummary.count} assembled</small></div>
              </div>

              {data.summary.count > 0 && (
                <section className="cr-market-section">
                  <div className="cr-results-head cr-wallet-results-head">
                    <div><p className="cr-kicker">Loose CREDITS</p><h2>{eth(data.summary.estimateEth)}Ξ estimate</h2></div>
                    <span>{cr(data.summary.totalCr)} CR · {money(data.summary.estimateUsd)}</span>
                  </div>
                  <div className="cr-range-card cr-subrange-card">
                    <div><span>Loose replacement range</span><strong>{eth(data.summary.rangeLowEth)}–{eth(data.summary.rangeHighEth)}Ξ</strong><small>{money(data.summary.rangeLowUsd)}–{money(data.summary.rangeHighUsd)}</small></div>
                    <div><span>Loose benchmark</span><strong>{data.benchmark.midEthPer1kCr.toFixed(5)}Ξ</strong><small>per 1K CR</small></div>
                  </div>
                  <div className="cr-table-wrap"><table><thead><tr><th>Token</th><th>Official rank</th><th>Credit Rating</th><th>Rating-implied estimate</th><th>Approx. USD</th><th>Asset</th></tr></thead><tbody>{data.credits.map((credit) => <tr key={credit.tokenId}><td>#{credit.tokenId}</td><td>#{credit.officialRank.toLocaleString()}</td><td>{cr(credit.creditRating)}</td><td>{eth(credit.estimateEth)}Ξ</td><td>{money(credit.estimateUsd)}</td><td><a href={credit.url} target="_blank" rel="noopener noreferrer">OpenSea ↗</a></td></tr>)}</tbody></table></div>
                  <div className="cr-card-list">{data.credits.map((credit) => <article key={credit.tokenId}><header><strong>CREDIT #{credit.tokenId}</strong><span>Rank #{credit.officialRank.toLocaleString()}</span></header><dl><div><dt>Credit Rating</dt><dd>{cr(credit.creditRating)}</dd></div><div><dt>Estimate</dt><dd>{eth(credit.estimateEth)}Ξ</dd></div><div><dt>Approx. USD</dt><dd>{money(credit.estimateUsd)}</dd></div></dl><a href={credit.url} target="_blank" rel="noopener noreferrer">OpenSea ↗</a></article>)}</div>
                </section>
              )}

              {data.statementSummary.count > 0 && data.statementBenchmark && data.statementMarket && (
                <section className="cr-market-section cr-statement-appraisal">
                  <div className="cr-results-head cr-wallet-results-head">
                    <div><p className="cr-kicker">Statements</p><h2>{eth(data.statementSummary.estimateEth)}Ξ estimate</h2></div>
                    <span>{cr(data.statementSummary.totalCr)} CR · {money(data.statementSummary.estimateUsd)}</span>
                  </div>
                  <div className="cr-range-card cr-subrange-card">
                    <div><span>Statement replacement range</span><strong>{eth(data.statementSummary.rangeLowEth)}–{eth(data.statementSummary.rangeHighEth)}Ξ</strong><small>{money(data.statementSummary.rangeLowUsd)}–{money(data.statementSummary.rangeHighUsd)}</small></div>
                    <div><span>Statement benchmark</span><strong>{data.statementBenchmark.midEthPer1kCr.toFixed(5)}Ξ</strong><small>per 1K CR</small></div>
                  </div>
                  <div className="cr-table-wrap"><table><thead><tr><th>Statement</th><th>Format / stage</th><th>CREDITS / layers</th><th>Credit Rating</th><th>Rating-implied estimate</th><th>Approx. USD</th><th>Asset</th></tr></thead><tbody>{data.statements.map((statement) => <tr key={statement.tokenId}><td>#{statement.tokenId}</td><td>{statement.format}<small>{statement.stage}</small></td><td>{statement.credits} / {statement.layers}</td><td>{cr(statement.creditRating)}</td><td>{eth(statement.estimateEth)}Ξ</td><td>{money(statement.estimateUsd)}</td><td><a href={statement.url} target="_blank" rel="noopener noreferrer">OpenSea ↗</a></td></tr>)}</tbody></table></div>
                  <div className="cr-card-list">{data.statements.map((statement) => <article key={statement.tokenId}><header><strong>STATEMENT #{statement.tokenId}</strong><span>{statement.format} · {statement.stage}</span></header><dl><div><dt>CREDITS / layers</dt><dd>{statement.credits} / {statement.layers}</dd></div><div><dt>Credit Rating</dt><dd>{cr(statement.creditRating)}</dd></div><div><dt>Estimate</dt><dd>{eth(statement.estimateEth)}Ξ</dd></div><div><dt>Approx. USD</dt><dd>{money(statement.estimateUsd)}</dd></div></dl><a href={statement.url} target="_blank" rel="noopener noreferrer">OpenSea ↗</a></article>)}</div>
                </section>
              )}
            </>
          )}

          <div className="cr-appraisal-notes">
            <p><strong>How this prototype reads value.</strong> {data.methodology}</p>
            <p>Loose benchmark: {data.benchmark.lowEthPer1kCr.toFixed(5)}–{data.benchmark.highEthPer1kCr.toFixed(5)}Ξ per 1K CR · {data.market.verifiedCount} current asks verified from {data.market.candidatesChecked} candidates · Confidence: {data.market.confidence}</p>
            {data.statementBenchmark && data.statementMarket && <p>Statement benchmark: {data.statementBenchmark.lowEthPer1kCr.toFixed(5)}–{data.statementBenchmark.highEthPer1kCr.toFixed(5)}Ξ per 1K CR · {data.statementMarket.listingCount} current listings checked · {data.statementMarket.sampleCount} used · Confidence: {data.statementMarket.confidence}</p>}
            <p>Approximate USD uses {data.market.ethUsdSource}. Completed-sale calibration is not included in this private build.</p>
          </div>
        </section>
      )}
    </div>
  );
}
