'use client';

import { useState, useEffect, useRef } from 'react';

type RewardKeyType = 'genesis' | 'exodus';

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
  { cycle: 'July 2026', distributed: 'August 3, 2026', bytes: '1,178.8', transfers: 27, hash: '0x65674cb20d3980ef4bf9e93eeeb0560a746030dc6aa1a48390c4cc6d4bf66efd' },
  { cycle: 'June 2026', distributed: 'July 13, 2026', bytes: '1,115.6', transfers: 28, hash: '0x1a00539906d2e1c7508a1c1aef64b0a7e66a2b55d15cc6f3361b74b8da36202d' },
  { cycle: 'May 2026', distributed: 'June 3, 2026', bytes: '2,050.8', transfers: 39, hash: '0xb6ed9da83476ef32e88d689ddc10e49380f8b699a874e97c88996da7c713e3c7' },
  { cycle: 'April 2026', distributed: 'May 8, 2026', bytes: '1,926', transfers: 48, hash: '0x7b95b4deb03f983eba105efdcb08cec4e58fb1189bfbbf02dbb633d16aee4573' },
  { cycle: 'March 2026', distributed: 'April 9, 2026', bytes: '1,625', transfers: 33, hash: '0x908d318eca4005fb12d3cf91140322c5370a256cc58fe5bb66f7561edf5602c7' },
  { cycle: 'February 2026', distributed: 'March 12, 2026', bytes: '1,998', transfers: 50, hash: '0x2e45a309833dabe4163941e1530ea3fa18a8eb8a8eb616914bbced25ae9e8d94' },
  { cycle: 'January 2026', distributed: 'February 7, 2026', bytes: '2,442', transfers: 62, hash: '0x760a3b5e043bff9551994ec06da51ff1a19ee6318824c30fbe20a0e8ee819411' },
  { cycle: 'December 2025', distributed: 'January 7, 2026', bytes: '3,476', transfers: 58, hash: '0xd870fe7d53f3c4eff2070a33e32615e876044347ae2d0eae02506446f618f5d8' },
  { cycle: 'November 2025', distributed: 'December 3, 2025', bytes: '3,020', transfers: 58, hash: '0xa21fece7a8c8515e759e491303c2a544f30b9e0e57807febac072c07229b2d38' },
  { cycle: 'October 2025', distributed: 'November 2, 2025', bytes: '2,216', transfers: 120, hash: '0x87264ae2abd230923efe3cc53236f5669040529c6a74c62b4672af0131871d21' },
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
  const [snapshot, setSnapshot] = useState<Record<string, number>>({});
  const [neoS1Count, setNeoS1Count] = useState(0);
  const [neoS2Count, setNeoS2Count] = useState(0);
  const [neoItemsCount, setNeoItemsCount] = useState(0);
  const [liberatedSlaves, setLiberatedSlaves] = useState(0);
  const [totalVotesCast, setTotalVotesCast] = useState(0);
  const [totalPhantomRewards, setTotalPhantomRewards] = useState(0);
  const [exodusMinted, setExodusMinted] = useState(0);
  const [voterParticipationRate, setVoterParticipationRate] = useState(0);
  const [loading, setLoading] = useState(true);
  const [rewardKeyType, setRewardKeyType] = useState<RewardKeyType>('genesis');
  const [hypotheticalBytesPrice, setHypotheticalBytesPrice] = useState('');
  const [rewardKeyCount, setRewardKeyCount] = useState('1');

  const TOTAL_GENESIS_KEYS = 555;
  const TOTAL_EXODUS_SUPPLY = 3333;

  const GENESIS_LAUNCH = new Date('2025-10-09T16:03:47Z').getTime();
  const LAST_SNAPSHOT = "August 23, 2026 00:08 UTC";
  const [currentTime] = useState(() => Date.now());

  useEffect(() => {
    const loadData = async () => {
      const airdropFiles = [
        '/airdrops/2025-12Airdrop.csv',
        '/airdrops/2025-10Airdrop.csv',
        '/airdrops/2026-01Airdrop.csv',
        '/airdrops/2025-11Airdrop.csv',
        '/airdrops/2026-02Airdrop.csv',
        '/airdrops/2026-03Airdrop.csv',
        '/airdrops/2026-04Airdrop.csv',
        '/airdrops/2026-05Airdrop.csv',
        '/airdrops/2026-06Airdrop.csv',
        '/airdrops/2026-07Airdrop.csv'
      ];

      try {
        const mintedPromise = fetch('/api/exodus-minted', { cache: 'no-store' }).then(async (res) => {
          const data = await res.json();

          if (!res.ok || typeof data.minted !== 'number') {
            throw new Error(data.error || 'Unable to load Exodus minted count');
          }

          return data.minted;
        });

        const neoCountsPromise = (async () => {
          try {
            const response = await fetch('/api/neo-vault-counts', { cache: 'no-store' });
            const data = await response.json();
            const counts = [data.s1, data.s2, data.items];

            if (
              !response.ok
              || counts.some((count) => !Number.isFinite(count) || count < 0)
            ) {
              throw new Error('Invalid vault holdings response');
            }

            return { s1: data.s1, s2: data.s2, items: data.items };
          } catch {
            console.error("Neo Tokyo vault holdings load failed");
            return { s1: 0, s2: 0, items: 0 };
          }
        })();

        const [snapshotText, holdersText, airdropTexts, minted, neoCounts] = await Promise.all([
          fetch('/vault-snapshot.csv').then((res) => res.text()),
          fetch('/holders-snapshot.csv').then((res) => res.text()),
          Promise.all(airdropFiles.map((file) => fetch(file).then((res) => res.text()))),
          mintedPromise,
          neoCountsPromise
        ]);

        const lines = snapshotText.trim().split('\n');
        const newSnapshot: Record<string, number> = {};
        lines.slice(1).forEach(line => {
          const [key, value] = line.split(',');
          if (key && value) newSnapshot[key.trim()] = parseFloat(value.trim());
        });

        const holderLines = holdersText.trim().split('\n').filter(l => l.trim());
        const holderCount = holderLines.length - 1;

        let totalRewards = 0;
        let totalVotes = 0;
        let totalRateSum = 0;
        let airdropCount = 0;

        airdropTexts.forEach((text) => {
          const recipientSet = new Set<string>();

          text.trim().split('\n').forEach(line => {
            if (!line.trim()) return;
            const [wallet, amtStr] = line.split(',');
            if (wallet && amtStr) {
              const amt = parseFloat(amtStr.trim());
              if (amt > 0) {
                totalRewards += amt;
                totalVotes += 1;
                recipientSet.add(wallet.trim().toLowerCase());
              }
            }
          });

          const uniqueInDrop = recipientSet.size;
          const rate = holderCount > 0 ? (uniqueInDrop / holderCount) * 100 : 0;
          totalRateSum += rate;
          airdropCount++;
        });

        setSnapshot(newSnapshot);
        setLiberatedSlaves(holderCount);
        setTotalPhantomRewards(Math.round(totalRewards));
        setTotalVotesCast(totalVotes);
        setVoterParticipationRate(airdropCount > 0 ? totalRateSum / airdropCount : 0);
        setExodusMinted(minted);
        setNeoS1Count(neoCounts.s1);
        setNeoS2Count(neoCounts.s2);
        setNeoItemsCount(neoCounts.items);
      } catch (err) {
        console.error("Engine Room load error:", err);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, []);

  // Dynamic Total Keys (live Exodus minted count)
  const TOTAL_KEYS = TOTAL_GENESIS_KEYS + exodusMinted;

  // Avg Keys per Phantom - calculated live
  const avgKeysPerPhantomCalc = liberatedSlaves > 0 
    ? TOTAL_KEYS / liberatedSlaves 
    : 0;

  const exodusMintProgress = TOTAL_EXODUS_SUPPLY > 0 
    ? (exodusMinted / TOTAL_EXODUS_SUPPLY) * 100 
    : 0;

  const daysSinceGenesis = Math.floor((currentTime - GENESIS_LAUNCH) / (1000 * 60 * 60 * 24));

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
          <div className="engine-snapshot-stamp">
            <strong>VAULT SNAPSHOT</strong>
            <span>Snapshot captured {LAST_SNAPSHOT}</span>
            <span>Reward totals through {REWARD_HISTORY_THROUGH}</span>
            <small>Reference inputs are independently sourced</small>
          </div>
        </header>

        <section className="engine-section engine-panel" aria-labelledby="vault-heading">
          <div className="engine-section-head">
            <div><p className="engine-eyebrow">01 / VAULT SNAPSHOT</p><h2 id="vault-heading">Vault capital at a glance</h2></div>
            <p>Estimated vault value, current Key supply and the resulting value represented per Key.</p>
          </div>
          <div className="engine-vault-grid">
            <article className="engine-metric engine-metric-primary">
              <div className="engine-metric-topline"><span>VALUE OF SAKURA&apos;S VAULT</span><small>REFERENCE VALUE</small></div>
              <p className="engine-metric-value engine-cyan"><AnimatedNumber value={totalVaultValue} prefix="$" duration={1800} decimals={true} ready={!loading} /></p>
              <p className="engine-metric-note">DeBank portfolio, Neo Tokyo asset references and the veBLACK position.</p>
            </article>
            <article className="engine-metric">
              <div className="engine-metric-topline"><span>TOTAL KEYS</span><small>CURRENT COUNT</small></div>
              <p className="engine-metric-value"><AnimatedNumber value={TOTAL_KEYS} duration={1400} decimals={false} ready={!loading} /></p>
              <p className="engine-metric-unit">GENESIS + MINTED EXODUS</p>
            </article>
            <article className="engine-metric">
              <div className="engine-metric-topline"><span>VAULT VALUE PER KEY</span><small>DERIVED</small></div>
              <p className="engine-metric-value"><AnimatedNumber value={vaultValuePerKey} prefix="$" duration={1600} decimals={true} ready={!loading} /></p>
              <p className="engine-metric-unit">TOTAL VALUE / TOTAL KEYS</p>
            </article>
          </div>
        </section>

        <section className="engine-section engine-panel" aria-labelledby="rewards-heading">
          <div className="engine-section-head">
            <div><p className="engine-eyebrow">02 / PHANTOM REWARD HISTORY</p><h2 id="rewards-heading">Completed distributions, in context</h2></div>
            <p>Historical discretionary distributions and their value at the current BYTES reference price.</p>
          </div>
          <div className="engine-reward-grid">
            <article className="engine-metric">
              <div className="engine-metric-topline"><span>COMPLETED PHANTOM REWARDS</span><small>THROUGH {REWARD_HISTORY_THROUGH.toUpperCase()}</small></div>
              <p className="engine-metric-value">{totalPhantomRewards.toLocaleString()}</p><p className="engine-metric-unit">$BYTES DISTRIBUTED</p>
            </article>
            <article className="engine-metric">
              <div className="engine-metric-topline"><span>CURRENT REFERENCE VALUE</span><small>PRICE-BASED</small></div>
              <p className="engine-metric-value">${airdropUSD.toFixed(0)}</p><p className="engine-metric-unit">USD AT CURRENT BYTES REFERENCE</p>
            </article>
          </div>
          <a href={`https://snowtrace.io/tx/${LATEST_REWARD_PROOF.hash}`} target="_blank" rel="noopener noreferrer" className="engine-proof-link">
            <span className="engine-proof-status">LATEST VERIFIED DISTRIBUTION</span>
            <span className="engine-proof-copy"><strong>{LATEST_REWARD_PROOF.cycle} Grid Cycle potential Phantom Rewards</strong><small>{LATEST_REWARD_PROOF.distributed} · {LATEST_REWARD_PROOF.bytes} BYTES · {LATEST_REWARD_PROOF.transfers} transfers</small></span>
            <b aria-hidden="true">↗</b>
          </a>
          <details className="engine-proof-shelf">
            <summary><span>HISTORICAL PROOF ARCHIVE</span><strong>VIEW 9 EARLIER PROOFS</strong><i aria-hidden="true">+</i></summary>
            <div className="engine-proof-archive">
              {EARLIER_REWARD_PROOFS.map((proof) => (
                <a key={proof.hash} href={`https://snowtrace.io/tx/${proof.hash}`} target="_blank" rel="noopener noreferrer">
                  <span><strong>{proof.cycle} Grid Cycle</strong><small>{proof.distributed}</small></span>
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
              <p className="engine-source-note">Current reference price: {snapshot.bytes_price_usd ? formatUsd(snapshot.bytes_price_usd) : 'Loading…'} per BYTES</p>
            </div>
            <div className="engine-output-panel" aria-live="polite">
              <div className="engine-output-grid">
                <div><span>COMPLETED REWARDS PER KEY</span><strong>{completedRewardsPerKey.toLocaleString()}</strong><small>BYTES</small></div>
                <div><span>HYPOTHETICAL VALUE PER KEY</span><strong className="engine-violet">{hasHypotheticalPrice ? formatUsd(hypotheticalValuePerKey) : '—'}</strong><small>{hasHypotheticalPrice ? `AT $${hypotheticalBytesPrice} PER BYTES` : 'ENTER ANY BYTES PRICE'}</small></div>
              </div>
              <div className="engine-output-total"><span>{`TOTAL ACROSS ${safeRewardKeyCount.toLocaleString()} ${safeRewardKeyCount === 1 ? 'KEY' : 'KEYS'}`}</span><strong>{hasHypotheticalPrice ? formatUsd(hypotheticalTotalValue) : '—'}</strong></div>
            </div>
          </div>
          <p className="engine-disclaimer">Completed distributions through {REWARD_HISTORY_THROUGH} only. User-entered prices are hypothetical and are not forecasts. Phantom Rewards are discretionary and never guaranteed.</p>
        </section>

        <section className="engine-section engine-panel" aria-labelledby="vitals-heading">
          <div className="engine-section-head">
            <div><p className="engine-eyebrow">04 / REBELLION VITALS</p><h2 id="vitals-heading">Participation and project activity</h2></div>
            <p>A compact operational read on holders, voting, mint progress and time in the Grid.</p>
          </div>
          <div className="engine-vitals-grid">
            <article><span>TOTAL LIBERATED SLAVES</span><strong>{liberatedSlaves}</strong><small>SNAPSHOT HOLDERS</small></article>
            <article><span>TOTAL VOTES CAST</span><strong>{totalVotesCast.toLocaleString()}</strong><small>REWARD ENTRIES</small></article>
            <article><span>AVG. KEYS PER PHANTOM</span><strong>{avgKeysPerPhantomCalc.toFixed(2)}</strong><small>KEYS / HOLDER</small></article>
            <article><span>EXODUS MINT PROGRESS</span><strong className="engine-cyan">{exodusMintProgress.toFixed(2)}%</strong><small>OF 3,333 SUPPLY</small></article>
            <article><span>AVG. VOTER PARTICIPATION</span><strong className="engine-cyan">{voterParticipationRate.toFixed(1)}%</strong><small>ACROSS COMPLETED CYCLES</small></article>
            <article><span>DAYS SINCE GENESIS</span><strong className="engine-cyan">{daysSinceGenesis}</strong><small>SINCE FIRST MINT</small></article>
          </div>
        </section>
      </div>
    </main>
  );
}
