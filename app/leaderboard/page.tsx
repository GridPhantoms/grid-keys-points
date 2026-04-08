'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

export default function Leaderboard() {
  const [activeTab, setActiveTab] = useState<'bytes' | 'points'>('bytes');
  const [bytesLeaderboard, setBytesLeaderboard] = useState<any[]>([]);
  const [keyholderLeaderboard, setKeyholderLeaderboard] = useState<any[]>([]);
  const [loadingBytes, setLoadingBytes] = useState(true);
  const [loadingKeyholders, setLoadingKeyholders] = useState(false);
  const [errorKeyholders, setErrorKeyholders] = useState('');
  const [lastSnapshot] = useState("April 7, 2026");
  const [menuOpen, setMenuOpen] = useState(false);

  // Load BYTES leaderboard
  useEffect(() => {
    const loadBytes = async () => {
      try {
        const files = [
          '/airdrops/2025-12Airdrop.csv',
          '/airdrops/2025-10Airdrop.csv',
          '/airdrops/2026-01Airdrop.csv',
          '/airdrops/2025-11Airdrop.csv',
          '/airdrops/2026-02Airdrop.csv'
        ];
        const lookup: Record<string, number> = {};

        for (const file of files) {
          const res = await fetch(file);
          const text = await res.text();
          text.trim().split('\n').forEach(line => {
            if (!line.trim()) return;
            const [wallet, amtStr] = line.split(',');
            if (wallet && amtStr) {
              const norm = wallet.trim().toLowerCase();
              lookup[norm] = (lookup[norm] || 0) + parseFloat(amtStr.trim());
            }
          });
        }

        const sorted = Object.entries(lookup)
          .map(([wallet, bytes]) => ({ wallet, bytes }))
          .sort((a, b) => b.bytes - a.bytes)
          .slice(0, 50);

        setBytesLeaderboard(sorted);
      } catch (e) {
        console.error(e);
      } finally {
        setLoadingBytes(false);
      }
    };
    loadBytes();
  }, []);

  const loadKeyholderLeaderboard = async () => {
    setLoadingKeyholders(true);
    setErrorKeyholders('');
    setKeyholderLeaderboard([]);

    try {
      const res = await fetch('/holders-snapshot.csv');
      const text = await res.text();

      const holders: any[] = [];

      text.trim().split('\n').slice(1).forEach(line => {
        if (!line.trim()) return;
        const [walletRaw, genesisQtyStr, exodusQtyStr] = line.split(',');
        if (!walletRaw) return;

        const wallet = walletRaw.trim().toLowerCase();
        const genesisQty = parseInt(genesisQtyStr || '0') || 0;
        const exodusQty = parseInt(exodusQtyStr || '0') || 0;
        const totalKeys = genesisQty + exodusQty;

        if (totalKeys > 0) {
          holders.push({
            wallet,
            totalKeys,
            genesisQty,
            exodusQty
          });
        }
      });

      const sorted = holders.sort((a, b) => b.totalKeys - a.totalKeys);
      setKeyholderLeaderboard(sorted);

    } catch (e) {
      console.error(e);
      setErrorKeyholders("Could not load holders-snapshot.csv");
    } finally {
      setLoadingKeyholders(false);
    }
  };

  const truncateWallet = (wallet: string) => {
    if (!wallet || wallet.length < 12) return wallet;
    return `${wallet.slice(0, 6)}...${wallet.slice(-6)}`;
  };

  const getOpenSeaProfile = (wallet: string) => {
    return `https://opensea.io/${wallet}`;
  };

  return (
    <div className="min-h-screen bg-black text-white">
      <nav className="border-b border-zinc-900 bg-zinc-950 py-4 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 flex items-center justify-between">
          <Link href="/" className="font-bold text-2xl tracking-[-1px]">
            <span className="text-white">GRID</span>
            <span className="text-cyan-400">PHANTOMS</span>
          </Link>

          {/* Desktop Nav */}
          <div className="hidden md:flex gap-8 text-sm">
            <Link href="/" className="hover:text-cyan-400 transition-colors">Home</Link>
            <Link href="/leaderboard" className="hover:text-cyan-400 transition-colors">Leaderboards</Link>
            <Link href="/trait-charts" className="hover:text-cyan-400 transition-colors">Trait Charts</Link>
          </div>

          {/* Mobile Hamburger */}
          <button 
            onClick={() => setMenuOpen(!menuOpen)}
            className="md:hidden text-3xl text-white"
          >
            ☰
          </button>
        </div>

        {/* Mobile Menu */}
        {menuOpen && (
          <div className="md:hidden bg-zinc-950 border-t border-zinc-900 py-6">
            <div className="flex flex-col gap-6 px-6 text-lg">
              <Link href="/" onClick={() => setMenuOpen(false)} className="hover:text-cyan-400 transition-colors">Home</Link>
              <Link href="/leaderboard" onClick={() => setMenuOpen(false)} className="hover:text-cyan-400 transition-colors">Leaderboards</Link>
              <Link href="/trait-charts" onClick={() => setMenuOpen(false)} className="hover:text-cyan-400 transition-colors">Trait Charts</Link>
            </div>
          </div>
        )}
      </nav>

      <div className="max-w-7xl mx-auto px-6 py-12">
        <h1 className="text-5xl font-bold tracking-[-2px] mb-2">LEADERBOARDS</h1>
        <p className="text-zinc-500 mb-10">Keyholder rankings across Grid Phantoms</p>

        <div className="flex border-b border-zinc-800 mb-8">
          <button 
            onClick={() => setActiveTab('bytes')} 
            className={`px-8 py-4 text-lg font-medium transition-colors ${activeTab === 'bytes' ? 'text-cyan-400 border-b-2 border-cyan-400' : 'text-zinc-400 hover:text-white'}`}
          >
            Rewards Leaderboard
          </button>
          <button 
            onClick={() => { setActiveTab('points'); loadKeyholderLeaderboard(); }} 
            className={`px-8 py-4 text-lg font-medium transition-colors ${activeTab === 'points' ? 'text-cyan-400 border-b-2 border-cyan-400' : 'text-zinc-400 hover:text-white'}`}
          >
            Keyholder Leaderboard
          </button>
        </div>

        {activeTab === 'bytes' && (
          <div>
            <h2 className="text-2xl font-semibold mb-6">Top Lifetime Phantom Rewards</h2>
            <div className="space-y-3">
              {loadingBytes ? (
                <p className="text-zinc-500">Loading...</p>
              ) : (
                bytesLeaderboard.map((entry, i) => (
                  <div 
                    key={i} 
                    className="bg-zinc-950 border border-zinc-900 rounded-2xl p-5"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        <span className="text-2xl font-mono text-zinc-500 w-12 flex-shrink-0 text-right">#{i+1}</span>
                        <span className="font-mono text-sm text-zinc-400 truncate flex-1">
                          {truncateWallet(entry.wallet)}
                        </span>
                        <a 
                          href={getOpenSeaProfile(entry.wallet)} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="text-xs text-cyan-400 hover:text-cyan-300 transition-colors ml-2 whitespace-nowrap flex-shrink-0"
                        >
                          [OpenSea Profile]
                        </a>
                      </div>

                      <div className="text-right sm:text-left flex-shrink-0">
                        <div className="text-3xl font-bold text-cyan-400">
                          {entry.bytes.toLocaleString()}
                        </div>
                        <div className="text-sm text-zinc-500">$BYTES</div>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {activeTab === 'points' && (
          <div>
            <h2 className="text-2xl font-semibold mb-6">Keyholder Leaderboard</h2>
            
            <div className="text-xs text-zinc-500 mb-6">
              Last snapshot: {lastSnapshot}
            </div>

            {loadingKeyholders && <p className="text-cyan-400">Loading holders...</p>}
            {errorKeyholders && <p className="text-red-400">{errorKeyholders}</p>}

            {keyholderLeaderboard.length > 0 && (
              <div className="space-y-4">
                {keyholderLeaderboard.map((entry, i) => (
                  <div key={i} className="bg-zinc-950 border border-zinc-900 rounded-2xl p-5">
                    <div className="flex items-center gap-3 mb-4">
                      <span className="text-2xl font-mono text-zinc-500 w-12 flex-shrink-0 text-right">#{i+1}</span>
                      <span className="font-mono text-sm text-zinc-400 truncate flex-1 min-w-0">
                        {truncateWallet(entry.wallet)}
                      </span>
                      <a 
                        href={getOpenSeaProfile(entry.wallet)} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="text-xs text-cyan-400 hover:text-cyan-300 transition-colors ml-1 whitespace-nowrap flex-shrink-0"
                      >
                        [OpenSea Profile]
                      </a>
                    </div>

                    <div className="grid grid-cols-3 gap-4 text-center">
                      <div>
                        <div className="text-2xl font-bold text-white">{entry.totalKeys}</div>
                        <div className="text-xs text-zinc-500">Total Keys</div>
                      </div>
                      <div>
                        <div className="text-2xl font-bold text-cyan-400">{entry.genesisQty}</div>
                        <div className="text-xs text-zinc-500">Genesis Keys</div>
                      </div>
                      <div>
                        <div className="text-2xl font-bold text-cyan-400">{entry.exodusQty}</div>
                        <div className="text-xs text-zinc-500">Exodus Keys</div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}