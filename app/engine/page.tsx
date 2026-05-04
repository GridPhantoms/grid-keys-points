'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

function AnimatedNumber({ 
  value, 
  duration = 1800, 
  prefix = "", 
  suffix = "", 
  decimals = false 
}: { 
  value: number; 
  duration?: number; 
  prefix?: string; 
  suffix?: string;
  decimals?: boolean;
}) {
  const [displayValue, setDisplayValue] = useState(0);

  useEffect(() => {
    if (value <= 0) {
      setDisplayValue(value);
      return;
    }

    let start = 0;
    const increment = decimals 
      ? Math.max(0.01, value / (duration / 16)) 
      : Math.max(1, Math.ceil(value / (duration / 16)));

    const timer = setInterval(() => {
      start += increment;
      if (start >= value) {
        setDisplayValue(value);
        clearInterval(timer);
      } else {
        setDisplayValue(start);
      }
    }, 16);

    return () => clearInterval(timer);
  }, [value, duration, decimals]);

  const liveFormatted = decimals 
    ? displayValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    : Math.floor(displayValue).toLocaleString('en-US');

  const finalFormatted = decimals 
    ? value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    : Math.floor(value).toString();

  return (
    <span className="tabular-nums">
      {prefix}{displayValue >= value ? finalFormatted : liveFormatted}{suffix}
    </span>
  );
}

export default function EngineRoom() {
  const pathname = usePathname();
  const [snapshot, setSnapshot] = useState<any>({});
  const [neoS1Count, setNeoS1Count] = useState(0);
  const [neoS2Count, setNeoS2Count] = useState(0);
  const [neoItemsCount, setNeoItemsCount] = useState(0);
  const [liberatedSlaves, setLiberatedSlaves] = useState(0);
  const [totalVotesCast, setTotalVotesCast] = useState(0);
  const [avgKeysPerPhantom, setAvgKeysPerPhantom] = useState(0);
  const [totalPhantomRewards, setTotalPhantomRewards] = useState(0);
  const [exodusMinted, setExodusMinted] = useState(0);
  const [voterParticipationRate, setVoterParticipationRate] = useState(0);
  const [loading, setLoading] = useState(true);
  const [menuOpen, setMenuOpen] = useState(false);

  const TOTAL_GENESIS_KEYS = 555;
  const TOTAL_EXODUS_SUPPLY = 3333;

  const GENESIS_LAUNCH = new Date('2025-10-09T16:03:47Z').getTime();
  const LAST_SNAPSHOT = "May 4, 2026 12:52 UTC";

  useEffect(() => {
    const loadData = async () => {
      try {
        const snapshotRes = await fetch('/vault-snapshot.csv');
        const snapshotText = await snapshotRes.text();
        const lines = snapshotText.trim().split('\n');
        const newSnapshot: any = {};
        lines.slice(1).forEach(line => {
          const [key, value] = line.split(',');
          if (key && value) newSnapshot[key.trim()] = parseFloat(value.trim());
        });
        setSnapshot(newSnapshot);

        const holdersRes = await fetch('/holders-snapshot.csv');
        const holdersText = await holdersRes.text();
        const holderLines = holdersText.trim().split('\n').filter(l => l.trim());
        setLiberatedSlaves(holderLines.length - 1);

        const airdropFiles = [
          '/airdrops/2025-12Airdrop.csv',
          '/airdrops/2025-10Airdrop.csv',
          '/airdrops/2026-01Airdrop.csv',
          '/airdrops/2025-11Airdrop.csv',
          '/airdrops/2026-02Airdrop.csv',
          '/airdrops/2026-03Airdrop.csv'
        ];

        let totalRewards = 0;
        let totalVotes = 0;
        let totalRateSum = 0;
        let airdropCount = 0;

        for (const file of airdropFiles) {
          const res = await fetch(file);
          const text = await res.text();
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
          const rate = (holderLines.length - 1) > 0 ? (uniqueInDrop / (holderLines.length - 1)) * 100 : 0;
          totalRateSum += rate;
          airdropCount++;
        }

        setTotalPhantomRewards(Math.round(totalRewards));
        setTotalVotesCast(totalVotes);
        setVoterParticipationRate(airdropCount > 0 ? totalRateSum / airdropCount : 0);

        const mintedRes = await fetch('/api/exodus-minted', { cache: 'no-store' });
        const mintedData = await mintedRes.json();

        if (!mintedRes.ok || typeof mintedData.minted !== 'number') {
          throw new Error(mintedData.error || 'Unable to load Exodus minted count');
        }

        setExodusMinted(mintedData.minted);

        const apiKey = process.env.NEXT_PUBLIC_ALCHEMY_API_KEY;
        if (apiKey) {
          const wallet = "0x6a1bc919e847c12725904965e05971b818b47ad0";
          const [s1Res, s2Res, itemsRes] = await Promise.all([
            fetch(`https://eth-mainnet.g.alchemy.com/nft/v3/${apiKey}/getNFTsForOwner?owner=${wallet}&contractAddresses[]=0xb9951b43802dcf3ef5b14567cb17adf367ed1c0f&limit=100`),
            fetch(`https://eth-mainnet.g.alchemy.com/nft/v3/${apiKey}/getNFTsForOwner?owner=${wallet}&contractAddresses[]=0x4481507cc228fa19d203bd42110d679571f7912e&limit=100`),
            fetch(`https://eth-mainnet.g.alchemy.com/nft/v3/${apiKey}/getNFTsForOwner?owner=${wallet}&contractAddresses[]=0xe7489ea1847395d7eead33e9c85fe327d513d249&limit=100`)
          ]);

          const s1Data = await s1Res.json();
          const s2Data = await s2Res.json();
          const itemsData = await itemsRes.json();

          setNeoS1Count(s1Data.ownedNfts?.length || 0);
          setNeoS2Count(s2Data.ownedNfts?.length || 0);
          setNeoItemsCount(itemsData.ownedNfts?.length || 0);
        }

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

  const daysSinceGenesis = Math.floor((Date.now() - GENESIS_LAUNCH) / (1000 * 60 * 60 * 24));

  const neoValue = 
    (neoS1Count * (snapshot.neo_s1_floor_usd || 0)) +
    (neoS2Count * (snapshot.neo_s2_floor_usd || 0)) +
    (neoItemsCount * (snapshot.neo_items_cache_floor_usd || 0));

  const totalVaultValue = (snapshot.debank_portfolio_usd || 0) + neoValue + ((snapshot.veblack_balance || 0) * (snapshot.black_price_usd || 0));

  const vaultValuePerKey = TOTAL_KEYS > 0 ? totalVaultValue / TOTAL_KEYS : 0;

  const airdropUSD = totalPhantomRewards * (snapshot.bytes_price_usd || 0);

  return (
    <div className="min-h-screen bg-black text-white flex flex-col">
      {/* Nav */}
      <nav className="border-b border-zinc-900 bg-zinc-950 py-4 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 flex items-center justify-between">
          <Link href="/" className="font-bold text-2xl tracking-[-1px]">
            <span className="text-white">GRID</span>
            <span className="text-cyan-400">PHANTOMS</span>
          </Link>

          <div className="hidden md:flex gap-8 text-sm">
            <Link href="/" className="hover:text-cyan-400 transition-colors">Home</Link>
            <Link href="/leaderboard" className="hover:text-cyan-400 transition-colors">Leaderboards</Link>
            <Link href="/trait-charts" className="hover:text-cyan-400 transition-colors">Trait Charts</Link>
            <Link href="/raffle" className="hover:text-cyan-400 transition-colors">Raffle Tracker</Link>
            <Link href="/mint-progress" className="hover:text-cyan-400 transition-colors">Mint Progress</Link>
            <Link href="/engine" className={`${pathname === '/engine' ? 'text-cyan-400 font-medium' : 'hover:text-cyan-400 transition-colors'}`}>Engine Room</Link>
          </div>

          <button onClick={() => setMenuOpen(!menuOpen)} className="md:hidden text-3xl text-white focus:outline-none">☰</button>
        </div>

        {menuOpen && (
          <div className="md:hidden bg-zinc-950 border-t border-zinc-900 py-6">
            <div className="flex flex-col gap-6 px-6 text-lg">
              <Link href="/" onClick={() => setMenuOpen(false)}>Home</Link>
              <Link href="/leaderboard" onClick={() => setMenuOpen(false)}>Leaderboards</Link>
              <Link href="/trait-charts" onClick={() => setMenuOpen(false)}>Trait Charts</Link>
              <Link href="/raffle" onClick={() => setMenuOpen(false)}>Raffle Tracker</Link>
              <Link href="/mint-progress" onClick={() => setMenuOpen(false)}>Mint Progress</Link>
              <Link href="/engine" onClick={() => setMenuOpen(false)} className="text-cyan-400 font-medium">Engine Room</Link>
            </div>
          </div>
        )}
      </nav>

      <div className="max-w-5xl mx-auto px-6 py-12 flex-1">
        <div className="text-center mb-12">
          <h1 className="text-5xl font-bold tracking-[-2px] mb-3">Engine Room</h1>
          <p className="text-xl text-zinc-400">Vault Metrics • Rebellion Vitals</p>
          <p className="text-sm text-zinc-500 mt-2">Last Snapshot: {LAST_SNAPSHOT}</p>
        </div>

        {/* Top Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-zinc-950 border border-zinc-900 rounded-3xl p-8 text-center">
            <p className="text-sm text-zinc-500 mb-2">VALUE OF SAKURA'S VAULT</p>
            <p className="text-5xl font-bold text-cyan-400 tracking-tighter">
              <AnimatedNumber value={totalVaultValue} prefix="$" duration={1800} decimals={true} />
            </p>
          </div>

          <div className="bg-zinc-950 border border-zinc-900 rounded-3xl p-8 text-center">
            <p className="text-sm text-zinc-500 mb-2">TOTAL KEYS</p>
            <p className="text-5xl font-bold text-white tracking-tighter">
              <AnimatedNumber value={TOTAL_KEYS} duration={1400} decimals={false} />
            </p>
          </div>

          <div className="bg-zinc-950 border border-zinc-900 rounded-3xl p-8 text-center">
            <p className="text-sm text-zinc-500 mb-2">VAULT VALUE PER KEY</p>
            <p className="text-5xl font-bold text-white tracking-tighter">
              <AnimatedNumber value={vaultValuePerKey} prefix="$" duration={1600} decimals={true} />
            </p>
          </div>
        </div>

        {/* Airdrop Stats */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-16">
          <div className="bg-zinc-950 border border-zinc-900 rounded-3xl p-8 text-center">
            <p className="text-sm text-zinc-500 mb-3">TOTAL PHANTOM REWARDS AIRDROPPED</p>
            <p className="text-5xl font-bold text-white tracking-tighter">
              {totalPhantomRewards.toLocaleString()}
            </p>
            <p className="text-lg text-zinc-400 mt-1">$BYTES</p>
          </div>

          <div className="bg-zinc-950 border border-zinc-900 rounded-3xl p-8 text-center">
            <p className="text-sm text-zinc-500 mb-3">CURRENT VALUE OF AIRDROPS</p>
            <p className="text-5xl font-bold text-white tracking-tighter">
              ${airdropUSD.toFixed(0)}
            </p>
            <p className="text-lg text-zinc-400 mt-1">USD</p>
          </div>
        </div>

        {/* Rebellion Vitals */}
        <div className="bg-zinc-950 border border-zinc-900 rounded-3xl p-8 mb-12">
          <p className="text-sm text-cyan-400 mb-8 tracking-widest text-center">REBELLION VITALS</p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-10 text-center">
            <div>
              <p className="text-sm text-zinc-500">Total Liberated Slaves</p>
              <p className="text-4xl font-bold text-white">{liberatedSlaves}</p>
            </div>
            <div>
              <p className="text-sm text-zinc-500">Total Votes Cast</p>
              <p className="text-4xl font-bold text-white">{totalVotesCast.toLocaleString()}</p>
            </div>
            <div>
              <p className="text-sm text-zinc-500">Avg. Keys per Phantom</p>
              <p className="text-4xl font-bold text-white">{avgKeysPerPhantomCalc.toFixed(2)}</p>
            </div>

            <div>
              <p className="text-sm text-zinc-500">Exodus Mint Progress</p>
              <p className="text-4xl font-bold text-cyan-400">{exodusMintProgress.toFixed(2)}%</p>
            </div>
            <div>
              <p className="text-sm text-zinc-500">Avg. Voter Participation</p>
              <p className="text-4xl font-bold text-cyan-400">{voterParticipationRate.toFixed(1)}%</p>
            </div>
            <div>
              <p className="text-sm text-zinc-500">Days Since Genesis</p>
              <p className="text-4xl font-bold text-cyan-400">{daysSinceGenesis}</p>
            </div>
          </div>
        </div>
      </div>

      <footer className="border-t border-zinc-900 bg-zinc-950 py-10 mt-auto">
        <div className="max-w-7xl mx-auto px-6">
          <div className="flex flex-col md:flex-row justify-center md:justify-between items-center gap-8">
            <div className="flex flex-wrap gap-8 text-sm justify-center md:justify-start">
              <a href="https://discord.gg/gridphantoms" target="_blank" rel="noopener noreferrer" className="hover:text-white transition-colors">Discord</a>
              <a href="https://x.com/GridPhantoms" target="_blank" rel="noopener noreferrer" className="hover:text-white transition-colors">X</a>
              <a href="https://opensea.io/collection/grid-phantoms-genesis-keys" target="_blank" rel="noopener noreferrer" className="hover:text-white transition-colors">OpenSea</a>
              <a href="https://snapshot.box/#/s:gridphantoms.eth" target="_blank" rel="noopener noreferrer" className="hover:text-white transition-colors">Snapshot</a>
              <a href="https://manifold.xyz/@gridphantoms/id/4067746032" target="_blank" rel="noopener noreferrer" className="hover:text-white transition-colors">Exodus Mint</a>
            </div>
            <div className="text-xs text-zinc-500 text-center md:text-right">
              © 2026 Grid Phantoms Ltd. All rights reserved.
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}