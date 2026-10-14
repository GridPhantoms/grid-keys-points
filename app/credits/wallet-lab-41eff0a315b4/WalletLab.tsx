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

type Appraisal = {
  wallet: string;
  ens: string | null;
  capturedAt: string;
  ethUsd: number;
  methodology: string;
  benchmark: {
    sampleTokenIds: number[];
    lowEthPer1kCr: number;
    midEthPer1kCr: number;
    highEthPer1kCr: number;
  };
  summary: {
    count: number;
    totalCr: number;
    estimateEth: number;
    estimateUsd: number;
    rangeLowEth: number;
    rangeHighEth: number;
    rangeLowUsd: number;
    rangeHighUsd: number;
  };
  credits: CreditRow[];
  ownership: { source: string; count: number };
  market: {
    source: string;
    sourceUpdatedAt: string | null;
    candidatesChecked: number;
    verifiedCount: number;
    confidence: 'moderate' | 'limited';
    ethUsdSource: string;
    ethUsdCheckedAt: string;
  };
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
          <button type="submit" disabled={loading || !wallet.trim()}>{loading ? 'Checking wallet…' : 'Appraise CREDITS'}</button>
        </div>
        <small>Read-only lookup. No wallet connection, signature or approval.</small>
      </form>

      {error && <div className="cr-alert" role="alert"><strong>Lookup unavailable.</strong><span>{error}</span></div>}
      {loading && <div className="cr-wallet-loading" role="status"><span /><div><strong>Reading holdings and verifying the market</strong><small>Ownership, official ratings and current asks are checked independently.</small></div></div>}

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

          {data.summary.count === 0 ? (
            <div className="cr-wallet-empty">
              <strong>No loose CREDITS found</strong>
              <p>OpenSea returned no visible direct CREDITS holdings for this wallet. Manually hidden assets and CREDITS already burned into Statements are outside this prototype.</p>
            </div>
          ) : (
            <>
              <div className="cr-appraisal-grid">
                <article><span>Loose CREDITS</span><strong>{data.summary.count.toLocaleString()}</strong><small>direct holdings</small></article>
                <article><span>Total Credit Rating</span><strong>{cr(data.summary.totalCr)}</strong><small>official CR</small></article>
                <article className="is-primary"><span>Ask-based estimate</span><strong>{eth(data.summary.estimateEth)}Ξ</strong><small>{money(data.summary.estimateUsd)}</small></article>
              </div>

              <div className="cr-range-card">
                <div><span>Current CR replacement range</span><strong>{eth(data.summary.rangeLowEth)}–{eth(data.summary.rangeHighEth)}Ξ</strong><small>{money(data.summary.rangeLowUsd)}–{money(data.summary.rangeHighUsd)}</small></div>
                <div><span>Benchmark</span><strong>{data.benchmark.midEthPer1kCr.toFixed(5)}Ξ</strong><small>per 1K CR</small></div>
              </div>

              <div className="cr-results-head cr-wallet-results-head">
                <div><p className="cr-kicker">Wallet inventory</p><h2>Individual estimates</h2></div>
                <span>Ranked by official CREDITS rank</span>
              </div>
              <div className="cr-table-wrap"><table><thead><tr><th>Token</th><th>Official rank</th><th>Credit Rating</th><th>Rating-implied estimate</th><th>Approx. USD</th><th>Asset</th></tr></thead><tbody>{data.credits.map((credit) => <tr key={credit.tokenId}><td>#{credit.tokenId}</td><td>#{credit.officialRank.toLocaleString()}</td><td>{cr(credit.creditRating)}</td><td>{eth(credit.estimateEth)}Ξ</td><td>{money(credit.estimateUsd)}</td><td><a href={credit.url} target="_blank" rel="noopener noreferrer">OpenSea ↗</a></td></tr>)}</tbody></table></div>
              <div className="cr-card-list">{data.credits.map((credit) => <article key={credit.tokenId}><header><strong>CREDIT #{credit.tokenId}</strong><span>Rank #{credit.officialRank.toLocaleString()}</span></header><dl><div><dt>Credit Rating</dt><dd>{cr(credit.creditRating)}</dd></div><div><dt>Estimate</dt><dd>{eth(credit.estimateEth)}Ξ</dd></div><div><dt>Approx. USD</dt><dd>{money(credit.estimateUsd)}</dd></div></dl><a href={credit.url} target="_blank" rel="noopener noreferrer">OpenSea ↗</a></article>)}</div>
            </>
          )}

          <div className="cr-appraisal-notes">
            <p><strong>How this prototype reads value.</strong> {data.methodology}</p>
            <p>Benchmark band: {data.benchmark.lowEthPer1kCr.toFixed(5)}–{data.benchmark.highEthPer1kCr.toFixed(5)}Ξ per 1K CR · {data.market.verifiedCount} current asks verified from {data.market.candidatesChecked} candidates · Confidence: {data.market.confidence} · ETH/USD via {data.market.ethUsdSource}</p>
            <p>Loose CREDITS only. Statement appraisal and completed-sale calibration are not included in this first private build.</p>
          </div>
        </section>
      )}
    </div>
  );
}
