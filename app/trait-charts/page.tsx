'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useState } from 'react';

export default function TraitCharts() {
  const [menuOpen, setMenuOpen] = useState(false);

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
            <Link href="/trait-charts" className="text-cyan-400 font-medium">Trait Charts</Link>
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
        <h1 className="text-5xl font-bold tracking-[-2px] mb-8">Trait Charts</h1>
        <p className="text-zinc-500 mb-12 max-w-2xl">
          Complete point value reference for all traits in both collections.
        </p>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12">
          {/* Genesis */}
          <div>
            <h2 className="text-3xl font-semibold mb-6 flex items-center gap-3">
              Genesis Keys
              <span className="text-cyan-400 text-xl">•</span>
            </h2>
            <div className="bg-zinc-950 border border-zinc-900 rounded-2xl overflow-hidden shadow-2xl">
              <Image 
                src="/charts/genesis-trait-charts.png" 
                alt="Genesis Keys Trait Point Chart" 
                width={1200} 
                height={800}
                className="w-full h-auto max-w-full"
                priority
              />
            </div>
          </div>

          {/* Exodus */}
          <div>
            <h2 className="text-3xl font-semibold mb-6 flex items-center gap-3">
              Exodus Keys
              <span className="text-cyan-400 text-xl">•</span>
            </h2>
            <div className="bg-zinc-950 border border-zinc-900 rounded-2xl overflow-hidden shadow-2xl">
              <Image 
                src="/charts/exodus-trait-charts.png" 
                alt="Exodus Keys Trait Point Chart" 
                width={1200} 
                height={800}
                className="w-full h-auto max-w-full"
              />
            </div>
          </div>
        </div>

        <div className="mt-16 text-center text-zinc-500 text-sm">
          These charts show every trait category and its corresponding point value.
        </div>
      </div>
    </div>
  );
}