'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import Image from 'next/image';

export default function TraitCharts() {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div className="min-h-screen bg-black text-white flex flex-col">
      {/* UPDATED NAV - consistent with all other pages */}
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
            <Link 
              href="/trait-charts" 
              className={`${pathname === '/trait-charts' ? 'text-cyan-400 font-medium' : 'hover:text-cyan-400 transition-colors'}`}
            >
              Trait Charts
            </Link>
            <Link href="/raffle" className="hover:text-cyan-400 transition-colors">Raffle Tracker</Link>
            <Link href="/mint-progress" className="hover:text-cyan-400 transition-colors">Mint Progress</Link>
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
              <Link 
                href="/trait-charts" 
                onClick={() => setMenuOpen(false)} 
                className={`${pathname === '/trait-charts' ? 'text-cyan-400 font-medium' : 'hover:text-cyan-400'}`}
              >
                Trait Charts
              </Link>
              <Link href="/raffle" onClick={() => setMenuOpen(false)} className="hover:text-cyan-400 transition-colors">Raffle Tracker</Link>
              <Link href="/mint-progress" onClick={() => setMenuOpen(false)} className="hover:text-cyan-400 transition-colors">Mint Progress</Link>
            </div>
          </div>
        )}
      </nav>

      <div className="max-w-7xl mx-auto px-6 py-12 flex-1">
        <h1 className="text-5xl font-bold tracking-[-2px] mb-10 text-center">Trait Charts</h1>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
          {/* Genesis Chart */}
          <div>
            <h2 className="text-2xl font-semibold mb-4 text-center">Genesis Keys</h2>
            <div className="bg-zinc-950 border border-zinc-900 rounded-3xl p-4">
              <Image 
                src="/charts/genesis-trait-charts.png" 
                alt="Genesis Keys Trait Point Chart" 
                width={1200} 
                height={800} 
                className="w-full h-auto rounded-2xl"
                priority
              />
            </div>
          </div>

          {/* Exodus Chart */}
          <div>
            <h2 className="text-2xl font-semibold mb-4 text-center">Exodus Keys</h2>
            <div className="bg-zinc-950 border border-zinc-900 rounded-3xl p-4">
              <Image 
                src="/charts/exodus-trait-charts.png" 
                alt="Exodus Keys Trait Point Chart" 
                width={1200} 
                height={800} 
                className="w-full h-auto rounded-2xl"
                priority
              />
            </div>
          </div>
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