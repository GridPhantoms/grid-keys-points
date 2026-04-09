'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';

const EXODUS_CONTRACT = "0xddF1d5f3A79ccbA74e284fD5b9Ee0FAdDB8993aa".toLowerCase();
const RAFFLE_START_TIMESTAMP = 1775694420; // April 8, 2026 19:27 CDT (Unix seconds)

export default function RaffleTracker() {
  const [totalTickets, setTotalTickets] = useState(0);
  const [entrants, setEntrants] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [countdownEnd, setCountdownEnd] = useState<number | null>(null);

  // Dummy data for now — we'll replace with real onchain fetch in next step
  useEffect(() => {
    // TODO: Replace this dummy data with real Alchemy fetch
    const dummyEntrants = [
      { wallet: "0x1313B6e1b3cDF50B680E58D7890", tickets: 4, odds: 44.44 },
      { wallet: "0xe3846863823A23795c0195Eb421", tickets: 1, odds: 11.11 },
      { wallet: "0xDE350cE2A0F5B9074ec2199bd5", tickets: 4, odds: 44.44 },
    ];

    setTotalTickets(9);
    setEntrants(dummyEntrants);
    setLoading(false);

    // Dummy countdown (remove once we have real 30th mint timestamp)
    setCountdownEnd(Date.now() + 7 * 24 * 60 * 60 * 1000);
  }, []);

  const formatCountdown = (endTime: number) => {
    const diff = Math.max(0, endTime - Date.now());
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    return `${days}d ${hours}h ${minutes}m`;
  };

  return (
    <div className="min-h-screen bg-black text-white flex flex-col">
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
        </div>
      </nav>

      <div className="max-w-4xl mx-auto px-6 py-12 flex-1">
        {/* Prize Showcase */}
        <div className="text-center mb-12">
          <Image 
            src="/images/phantoms-s1.png" 
            alt="Neo Tokyo Citizen #3989" 
            width={600} 
            height={600} 
            className="mx-auto rounded-3xl shadow-2xl border border-cyan-500/30"
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
        <div className="bg-zinc-950 border border-zinc-900 rounded-3xl p-8 mb-10">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-semibold">Raffle Status</h2>
            <span className="text-sm bg-zinc-900 px-4 py-1 rounded-full">Live</span>
          </div>

          <div className="text-center">
            <p className="text-6xl font-bold text-cyan-400">{totalTickets}</p>
            <p className="text-zinc-500">Exodus Keys minted since raffle start</p>
          </div>

          {totalTickets < 30 ? (
            <div className="mt-8 text-center">
              <p className="text-xl text-amber-400">
                {30 - totalTickets} more Exodus Keys needed before 7-day countdown begins
              </p>
            </div>
          ) : (
            <div className="mt-8 text-center">
              <p className="text-sm text-zinc-400 mb-2">Raffle ends in</p>
              <p className="text-5xl font-mono font-bold text-white tracking-widest">
                {countdownEnd ? formatCountdown(countdownEnd) : '—'}
              </p>
            </div>
          )}
        </div>

        {/* Entrant Ledger */}
        <div className="bg-zinc-950 border border-zinc-900 rounded-3xl p-8">
          <h2 className="text-2xl font-semibold mb-6">Entrant Ledger</h2>
          <div className="space-y-4">
            {entrants.map((entrant, i) => (
              <div key={i} className="flex items-center justify-between bg-black/50 rounded-2xl px-6 py-5">
                <div>
                  <p className="font-mono text-sm text-zinc-400">{entrant.wallet}</p>
                </div>
                <div className="text-right">
                  <p className="text-3xl font-bold text-white">{entrant.tickets} tickets</p>
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

      <footer className="border-t border-zinc-900 bg-zinc-950 py-10 mt-auto">
        <div className="max-w-7xl mx-auto px-6 text-center text-xs text-zinc-500">
          © 2026 Grid Phantoms Ltd. All rights reserved.
        </div>
      </footer>
    </div>
  );
}