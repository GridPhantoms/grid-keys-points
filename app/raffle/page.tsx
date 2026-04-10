'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';

export default function RaffleTracker() {
  const [totalTickets, setTotalTickets] = useState(0);
  const [entrants, setEntrants] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastSnapshot] = useState("April 10, 2026 02:12 UTC");
  const [menuOpen, setMenuOpen] = useState(false);

  // Exact timestamp of the 30th mint (Token #406) — 2026-04-10 02:10:23 UTC
  const RAFFLE_30TH_MINT_TIMESTAMP = 1775787023000; // milliseconds

  useEffect(() => {
    const loadSnapshot = async () => {
      try {
        const res = await fetch('/raffle-snapshot.csv');
        const text = await res.text();

        const ownerMap: Record<string, number> = {};

        text.trim().split('\n').slice(1).forEach(line => {
          if (!line.trim()) return;
          const [walletRaw, qtyStr] = line.split(',');
          if (!walletRaw) return;

          const wallet = walletRaw.trim().toLowerCase();
          const qty = parseInt(qtyStr || '0') || 0;

          if (qty > 0) {
            ownerMap[wallet] = qty;
          }
        });

        const total = Object.values(ownerMap).reduce((sum, qty) => sum + qty, 0);

        const sortedEntrants = Object.entries(ownerMap)
          .map(([wallet, tickets]) => ({
            wallet,
            tickets,
            odds: total > 0 ? (tickets / total) * 100 : 0
          }))
          .sort((a, b) => b.tickets - a.tickets);

        setTotalTickets(total);
        setEntrants(sortedEntrants);
      } catch (err) {
        console.error("Failed to load raffle snapshot:", err);
      } finally {
        setLoading(false);
      }
    };

    loadSnapshot();
  }, []);

  // Live countdown (updates every second)
  const [countdown, setCountdown] = useState("Calculating...");

  useEffect(() => {
    const updateCountdown = () => {
      const now = Date.now();
      const endTime = RAFFLE_30TH_MINT_TIMESTAMP + 7 * 24 * 60 * 60 * 1000; // +7 days

      const diff = endTime - now;

      if (diff <= 0) {
        setCountdown("Raffle has ended");
        return;
      }

      const days = Math.floor(diff / (1000 * 60 * 60 * 24));
      const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((diff % (1000 * 60)) / 1000);

      setCountdown(`${days}d ${hours}h ${minutes}m ${seconds}s`);
    };

    updateCountdown();
    const interval = setInterval(updateCountdown, 1000);

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="min-h-screen bg-black text-white flex flex-col">
      {/* Nav with Hamburger Menu */}
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
            <Link href="/raffle" className="text-cyan-400 font-medium">Raffle Tracker</Link>
          </div>

          <button 
            onClick={() => setMenuOpen(!menuOpen)} 
            className="md:hidden text-3xl text-white focus:outline-none"
          >
            ☰
          </button>
        </div>

        {menuOpen && (
          <div className="md:hidden bg-zinc-950 border-t border-zinc-900 py-6">
            <div className="flex flex-col gap-6 px-6 text-lg">
              <Link href="/" onClick={() => setMenuOpen(false)} className="hover:text-cyan-400 transition-colors">Home</Link>
              <Link href="/leaderboard" onClick={() => setMenuOpen(false)} className="hover:text-cyan-400 transition-colors">Leaderboards</Link>
              <Link href="/trait-charts" onClick={() => setMenuOpen(false)} className="hover:text-cyan-400 transition-colors">Trait Charts</Link>
              <Link href="/raffle" onClick={() => setMenuOpen(false)} className="text-cyan-400 font-medium">Raffle Tracker</Link>
            </div>
          </div>
        )}
      </nav>

      <div className="max-w-4xl mx-auto px-4 md:px-6 py-12 flex-1">
        {/* Prize Showcase */}
        <div className="text-center mb-12">
          <Image 
            src="/images/phantoms-s1.png" 
            alt="Neo Tokyo Citizen #3989" 
            width={800} 
            height={800} 
            className="w-full max-w-[280px] md:max-w-lg mx-auto h-auto rounded-3xl shadow-2xl border border-cyan-500/30"
            priority
          />
          <h1 className="text-4xl font-bold mt-8">Up for raffle is Neo Tokyo Citizen #3989</h1>
          <a 
            href="https://opensea.io/item/ethereum/0xb9951b43802dcf3ef5b14567cb17adf367ed1c0f/3989" 
            target="_blank" 
            rel="noopener noreferrer"
            className="text-cyan-400 hover:text-cyan-300 text-lg mt-2 inline-block"
          >
            View on OpenSea →
          </a>
        </div>

        {/* Status */}
<div className="bg-zinc-950 border border-zinc-900 rounded-3xl p-6 md:p-8 mb-10">
  <div className="flex justify-between items-center mb-6">
    <h2 className="text-2xl font-semibold">Raffle Status</h2>
    <span className="text-sm bg-zinc-900 px-4 py-1 rounded-full">Live</span>
  </div>

  <div className="text-center">
    <p className="text-6xl font-bold text-cyan-400">{totalTickets}</p>
    <p className="text-zinc-500">Exodus Keys minted during raffle window</p>
  </div>

  {totalTickets < 30 ? (
    <div className="mt-8 text-center">
      <p className="text-xl text-amber-400">
        {30 - totalTickets} more Exodus Key mints needed before 7-day countdown begins
      </p>
    </div>
  ) : (
    <div className="mt-8 text-center">
      <p className="text-sm text-zinc-400 mb-2">Raffle ends in</p>
      <p className="text-5xl font-mono font-bold text-white tracking-widest">
        {countdown}
      </p>
      <p className="text-sm text-zinc-500 mt-3">
        (ends April 17, 2026 at 02:10:23 UTC)
      </p>
    </div>
  )}
</div>

        {/* Entrant Ledger */}
        <div className="bg-zinc-950 border border-zinc-900 rounded-3xl p-6 md:p-8">
          <h2 className="text-2xl font-semibold mb-1">Entrant Ledger</h2>
          <p className="text-sm text-zinc-500 mb-6">Snapshot: {lastSnapshot}</p>
          
          <div className="space-y-4">
            {entrants.map((entrant, i) => (
              <div key={i} className="bg-black/50 border border-zinc-800 rounded-2xl p-5 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div className="font-mono text-sm text-zinc-400 break-all">
                  {entrant.wallet}
                </div>
                <div className="flex flex-col items-end md:items-start">
                  <p className="text-3xl font-bold text-white">
                    {entrant.tickets} {entrant.tickets === 1 ? 'ticket' : 'tickets'}
                  </p>
                  <p className="text-xs text-cyan-400">{entrant.odds.toFixed(2)}% odds</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="text-center mt-12">
          <a 
            href="https://x.com/GridPhantoms/status/2042036764567593115" 
            target="_blank" 
            rel="noopener noreferrer"
            className="text-cyan-400 hover:text-cyan-300 underline"
          >
            Raffle entry requirements can be found here →
          </a>
        </div>
      </div>

      {/* Footer */}
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