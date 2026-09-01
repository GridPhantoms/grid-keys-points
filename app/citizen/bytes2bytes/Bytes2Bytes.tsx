'use client';

import Image from 'next/image';
import { FormEvent, useEffect, useState } from 'react';

type CitizenPosition = {
  season: 's1' | 's2'; citizenId: string; stakedBytes: number; timelockEndTime: number; points: number; vaultId: string | null; hasVault: boolean | null;
};
type WalletResult = {
  input: string; resolvedAddress: string; chain: string; sourceBlock: number; sourceBlockHash: string; asOf: string;
  summary: { walletBalance: number; citizenBytesStaked: number; pendingRewards: number; totalBytes: number; citizenCount: number; s1Count: number; s2Count: number };
  pendingByPool: { s1: number; s2: number };
  pendingDaoTaxByPool: { s1: number; s2: number };
  s1Citizens: CitizenPosition[]; s2Citizens: CitizenPosition[]; notes: string[];
};
type BytesMetrics = { metrics?: { bytesPriceUsd?: { value?: number; asOf?: string; availability?: string } } };

const REMEMBERED_WALLET_KEY = 'gridphantoms:bytes2bytes:wallet';
const number = (value: number, digits = 2) => value.toLocaleString('en-US', { maximumFractionDigits: digits });
const usd = (value: number | null) => value == null ? '—' : value.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: value < 10 ? 2 : 0 });
const shortened = (value: string) => `${value.slice(0, 8)}…${value.slice(-6)}`;
const lockLabel = (timestamp: number) => {
  if (!timestamp || timestamp * 1_000 <= Date.now()) return 'LOCK CLEARED';
  return `LOCKED UNTIL ${new Date(timestamp * 1_000).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' }).toUpperCase()}`;
};

function SummaryMetric({ label, value, price, accent = false }: { label: string; value: number; price: number | null; accent?: boolean }) {
  return <article className={`b2b-summary-card ${accent ? 'accent' : ''}`}><span>{label}</span><strong>{number(value, 4)}</strong><small>{price == null ? 'PRICE SOURCE UNAVAILABLE' : `${usd(value * price)} AT CURRENT SPOT`}</small></article>;
}

function CitizenCard({ position }: { position: CitizenPosition }) {
  return <article className="b2b-citizen-card">
    <div className="b2b-citizen-image"><Image unoptimized src={`/api/citizen-terminal/image?season=${position.season}&tokenId=${encodeURIComponent(position.citizenId)}`} alt={`${position.season.toUpperCase()} Citizen #${position.citizenId}`} width={360} height={360} /></div>
    <div className="b2b-citizen-data">
      <div className="b2b-citizen-top"><span>{position.season.toUpperCase()} CITIZEN</span><b>{lockLabel(position.timelockEndTime)}</b></div>
      <h3>#{position.citizenId}</h3>
      <dl>
        <div><dt>$BYTES staked</dt><dd>{number(position.stakedBytes, 2)}</dd></div>
        <div><dt>Staking points</dt><dd>{number(position.points, 2)}</dd></div>
        {position.season === 's1' && <div><dt>Vault</dt><dd>{position.hasVault ? 'Vault Detected' : 'Vaultless'}</dd></div>}
      </dl>
    </div>
  </article>;
}

export default function Bytes2Bytes() {
  const [wallet, setWallet] = useState('');
  const [remember, setRemember] = useState(false);
  const [result, setResult] = useState<WalletResult | null>(null);
  const [price, setPrice] = useState<number | null>(null);
  const [priceAsOf, setPriceAsOf] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const restore = window.setTimeout(() => {
      const saved = window.localStorage.getItem(REMEMBERED_WALLET_KEY);
      if (saved) { setWallet(saved); setRemember(true); }
    }, 0);
    const controller = new AbortController();
    fetch('/api/bytes-metrics', { signal: controller.signal })
      .then(async (response) => response.ok ? response.json() as Promise<BytesMetrics> : null)
      .then((payload) => {
        const spot = payload?.metrics?.bytesPriceUsd?.value;
        if (typeof spot === 'number' && Number.isFinite(spot)) {
          setPrice(spot);
          setPriceAsOf(payload?.metrics?.bytesPriceUsd?.asOf ?? null);
        }
      })
      .catch(() => undefined);
    return () => { window.clearTimeout(restore); controller.abort(); };
  }, []);

  const lookup = async (event: FormEvent) => {
    event.preventDefault();
    const input = wallet.trim();
    if (!input) { setError('Enter an Ethereum address or ENS name.'); return; }
    setLoading(true); setError(''); setResult(null);
    try {
      const response = await fetch(`/api/citizen-terminal/bytes2bytes?address=${encodeURIComponent(input)}`, { cache: 'no-store' });
      const payload = await response.json() as WalletResult & { error?: string };
      if (!response.ok) throw new Error(payload.error ?? 'Wallet lookup failed.');
      setResult(payload);
      if (remember) window.localStorage.setItem(REMEMBERED_WALLET_KEY, input);
      else window.localStorage.removeItem(REMEMBERED_WALLET_KEY);
    } catch (lookupError) {
      setError(lookupError instanceof Error ? lookupError.message : 'Wallet lookup failed.');
    } finally { setLoading(false); }
  };

  const totalTax = result ? result.pendingDaoTaxByPool.s1 + result.pendingDaoTaxByPool.s2 : 0;
  return <main className="b2b-main">
    <section className="b2b-hero">
      <div><p className="b2b-kicker">CITIZEN INTERLINK // WALLET INTELLIGENCE</p><h1>Bytes<span>2</span>Bytes</h1><p>Read the wallet. Surface the stake. Account for every pending byte.</p></div>
    </section>

    <section className="b2b-tribute">
      <span>ARCHIVE SIGNAL // RESTORED UTILITY</span>
      <p>A modern homage to the Citizen-built <strong>$BYTES to $BYTES</strong> tool once hosted at <strong>bytestobytes.com</strong>—rebuilt as a first-party, source-pinned Interlink utility.</p>
    </section>

    <section className="b2b-lookup" aria-labelledby="wallet-lookup-title">
      <div><p>01 / WALLET LOOKUP</p><h2 id="wallet-lookup-title">Scan any Citizen wallet</h2><span>Enter a public Ethereum address or ENS name. Nothing connects and nothing can be signed.</span></div>
      <form onSubmit={lookup}>
        <label><span>WALLET OR ENS</span><input type="text" inputMode="text" value={wallet} onChange={(event) => setWallet(event.target.value)} autoComplete="off" autoCorrect="off" autoCapitalize="none" spellCheck={false} placeholder="0x… or citizen.eth" /></label>
        <label className="b2b-remember"><input type="checkbox" checked={remember} onChange={(event) => setRemember(event.target.checked)} /><span>Remember on this device</span></label>
        <button disabled={loading}>{loading ? 'SCANNING CONTRACT…' : 'SCAN WALLET'}</button>
      </form>
      {error && <p className="b2b-error">{error}</p>}
    </section>

    {result && <>
      <section className="b2b-result-head">
        <div><p>INTERLINK RESOLVED</p><h2>{result.input.toLowerCase().endsWith('.eth') ? result.input : shortened(result.resolvedAddress)}</h2><a href={`https://etherscan.io/address/${result.resolvedAddress}`} target="_blank" rel="noreferrer">{shortened(result.resolvedAddress)} ↗</a></div>
        <div><span>ETHEREUM BLOCK</span><b>{result.sourceBlock.toLocaleString()}</b><small>{new Date(result.asOf).toLocaleString()}</small></div>
      </section>

      <section className="b2b-bont-lore" aria-label="Bank of Neo Tokyo account services">
        <div className="b2b-bont-image"><Image src="/citizen/bont-lore.webp" alt="B.O.N.T. guards standing beside the Bank of Neo Tokyo vault" fill sizes="(max-width: 700px) calc(100vw - 24px), 52vw" priority /></div>
        <div><p>B.O.N.T. // ACCOUNT SERVICES</p><h2>Welcome to the Bank</h2><span>Citizen stakes and pending $BYTES, reconciled into one Bank of Neo Tokyo (B.O.N.T.) account statement.</span></div>
      </section>

      <section className="b2b-summary" aria-labelledby="summary-title">
        <header><p>02 / B.O.N.T. TELLER DESK</p><h2 id="summary-title">Account Statement</h2></header>
        <div className="b2b-summary-grid">
          <SummaryMetric label="LIQUID $BYTES IN WALLET // ETH" value={result.summary.walletBalance} price={price} />
          <SummaryMetric label="CITIZEN-STAKED $BYTES" value={result.summary.citizenBytesStaked} price={price} />
          <SummaryMetric label="PENDING $BYTES" value={result.summary.pendingRewards} price={price} />
          <SummaryMetric label="TOTAL $BYTES ACCOUNTED" value={result.summary.totalBytes} price={price} accent />
        </div>
        <div className="b2b-pending-breakdown"><span>PENDING $BYTES BY SEASON</span><div className="b2b-pending-stats"><b>S1 {number(result.pendingByPool.s1, 4)}</b><b>S2 {number(result.pendingByPool.s2, 4)}</b></div><small>DAO tax reported separately: {number(totalTax, 4)} $BYTES</small></div>
        {priceAsOf && <p className="b2b-source-line">USD references use $BYTES spot observed {new Date(priceAsOf).toLocaleString()}</p>}
      </section>

      <section className="b2b-staked" aria-labelledby="staked-title">
        <header><div><p>03 / STAKED CITIZENS</p><h2 id="staked-title">Account Holders</h2></div><div><b>{result.summary.citizenCount}</b><span>{result.summary.s1Count} S1 // {result.summary.s2Count} S2</span></div></header>
        {result.summary.citizenCount === 0 ? <div className="b2b-empty"><b>NO STAKED CITIZENS FOUND</b><span>This wallet may still hold liquid $BYTES.</span></div> : <>
          {result.s1Citizens.length > 0 && <div className="b2b-season"><h3>S1 CITIZENS <span>{result.s1Citizens.length}</span></h3><div className="b2b-citizen-grid">{result.s1Citizens.map((position) => <CitizenCard key={`s1-${position.citizenId}`} position={position} />)}</div></div>}
          {result.s2Citizens.length > 0 && <div className="b2b-season"><h3>S2 OUTER CITIZENS <span>{result.s2Citizens.length}</span></h3><div className="b2b-citizen-grid">{result.s2Citizens.map((position) => <CitizenCard key={`s2-${position.citizenId}`} position={position} />)}</div></div>}
        </>}
      </section>

      <section className="b2b-method">
        <p>04 / SOURCE NOTES</p>
        <div>{result.notes.map((note) => <span key={note}>{note}</span>)}</div>
        <small>Read from the verified NeoTokyoStaker and Ethereum $BYTES contracts at pinned block {result.sourceBlock.toLocaleString()}. Values can change after this snapshot.</small>
      </section>
    </>}
  </main>;
}
