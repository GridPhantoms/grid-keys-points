'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

const EXODUS_CONTRACT = "0xddF1d5f3A79ccbA74e284fD5b9Ee0FAdDB8993aa".toLowerCase();
const TOTAL_EXODUS_SUPPLY = 3333;

export default function MintProgress() {
  const pathname = usePathname();
  const [exodusMinted, setExodusMinted] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    const fetchExodusCount = async () => {
      try {
        const apiKey = process.env.NEXT_PUBLIC_ALCHEMY_API_KEY;
        if (!apiKey) throw new Error("Alchemy API key missing");

        let total = 0;
        let pageKey: string | undefined;

        do {
          const url = `https://eth-mainnet.g.alchemy.com/nft/v3/${apiKey}/getNFTsForContract?contractAddress=${EXODUS_CONTRACT}&withMetadata=false&limit=100${pageKey ? `&pageKey=${pageKey}` : ''}`;
          const res = await fetch(url);
          const data = await res.json();

          total += (data.nfts || []).length;
          pageKey = data.pageKey;
        } while (pageKey);

        setExodusMinted(total);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    fetchExodusCount();
  }, []);

  const progress = Math.min((exodusMinted / TOTAL_EXODUS_SUPPLY) * 100, 100);

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
      <Link href="/raffle" className="hover:text-cyan-400 transition-colors">Raffle Tracker</Link>
      <Link 
        href="/mint-progress" 
        className={`${pathname === '/mint-progress' ? 'text-cyan-400 font-medium' : 'hover:text-cyan-400 transition-colors'}`}
      >
        Mint Progress
      </Link>
      <Link 
        href="/engine" 
        className="hover:text-cyan-400 transition-colors"
      >
        Engine Room
      </Link>
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
        <Link href="/raffle" onClick={() => setMenuOpen(false)} className="hover:text-cyan-400 transition-colors">Raffle Tracker</Link>
        <Link 
          href="/mint-progress" 
          onClick={() => setMenuOpen(false)} 
          className={`${pathname === '/mint-progress' ? 'text-cyan-400 font-medium' : 'hover:text-cyan-400 transition-colors'}`}
        >
          Mint Progress
        </Link>
        <Link 
          href="/engine" 
          onClick={() => setMenuOpen(false)} 
          className="hover:text-cyan-400 transition-colors"
        >
          Engine Room
        </Link>
      </div>
    </div>
  )}
</nav>

      <div className="max-w-5xl mx-auto px-6 py-16 flex-1">
        <h1 className="text-5xl font-bold tracking-[-2px] mb-12 text-center">
          Grid Phantoms Mint Progress
        </h1>

        {/* Quote Box */}
<div className="my-12 mx-auto max-w-5xl">
  <div className="bg-zinc-950 border border-zinc-900 rounded-2xl p-6 md:p-8 text-center">
    <p className="text-sm italic text-zinc-500 leading-relaxed">
      Stack Keys. Run vote subroutine. Gather $BYTES. Embrace your boredom. The Code favors the patient.
    </p>
  </div>
</div>

        <div className="space-y-24">
          {/* Genesis */}
          <div className="w-full">
            <div className="flex justify-between items-baseline mb-6">
              <h2 className="text-2xl font-semibold">Genesis Keys</h2>
              <div className="text-right">
                <span className="text-cyan-400 font-mono">555 / 555</span>
                <span className="text-xs text-zinc-500 ml-2">COMPLETED</span>
              </div>
            </div>
            <div className="h-6 bg-zinc-900 rounded-2xl overflow-hidden w-full">
              <div className="h-full w-full bg-gradient-to-r from-cyan-400 to-cyan-300" />
            </div>
          </div>

          {/* Exodus */}
          <div className="w-full">
            <div className="flex justify-between items-baseline mb-6">
              <h2 className="text-2xl font-semibold">Exodus Keys</h2>
              <div className="text-right font-mono">
                {loading ? (
                  <span className="text-zinc-400">Loading...</span>
                ) : (
                  <>
                    <span className="text-cyan-400">{exodusMinted}</span>
                    <span className="text-zinc-500"> / {TOTAL_EXODUS_SUPPLY}</span>
                  </>
                )}
              </div>
            </div>

            <div className="h-6 bg-zinc-900 rounded-2xl overflow-hidden w-full">
              <div 
                className="h-full bg-gradient-to-r from-cyan-400 to-cyan-300 transition-all duration-1000"
                style={{ width: `${progress}%` }}
              />
            </div>

            <div className="flex justify-between text-sm mt-4 text-zinc-400">
              <div>{loading ? '—' : `${progress.toFixed(2)}% minted`}</div>
              <div>
                {exodusMinted !== null ? `${TOTAL_EXODUS_SUPPLY - exodusMinted} remaining` : '—'}
              </div>
            </div>
          </div>
        </div>

        <div className="mt-20 text-center">
          <a
            href="https://manifold.xyz/@gridphantoms/id/4067746032"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-block bg-cyan-500 hover:bg-cyan-400 transition-colors text-black font-semibold text-xl px-14 py-6 rounded-2xl tracking-wider"
          >
            MINT NOW
          </a>
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