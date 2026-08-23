'use client';

import { useState } from 'react';
import Link from 'next/link';

export type SiteNavActive =
  | 'home'
  | 'leaderboard'
  | 'trait-charts'
  | 'raffle'
  | 'mint-progress'
  | 'bytes'
  | 'citizen'
  | 'engine';

type SiteNavProps = {
  active: SiteNavActive;
};

const navItems: Array<{ href: string; label: string; active: SiteNavActive }> = [
  { href: '/', label: 'Home', active: 'home' },
  { href: '/leaderboard', label: 'Leaderboards', active: 'leaderboard' },
  { href: '/trait-charts', label: 'Trait Charts', active: 'trait-charts' },
  { href: '/raffle', label: 'Raffle Tracker', active: 'raffle' },
  { href: '/mint-progress', label: 'Mint Progress', active: 'mint-progress' },
  { href: '/bytes', label: '$BYTES Terminal', active: 'bytes' },
  { href: '/citizen', label: 'Citizen Interlink', active: 'citizen' },
  { href: '/engine', label: 'Engine Room', active: 'engine' },
];

const linkClassName = (isActive: boolean) =>
  isActive
    ? 'text-cyan-400 font-medium'
    : 'hover:text-cyan-400 transition-colors';

const mobileMenuId = 'site-nav-mobile-menu';

export default function SiteNav({ active }: SiteNavProps) {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <nav className="border-b border-zinc-900 bg-zinc-950 py-4 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-6 flex items-center justify-between">
        <Link href="/" className="font-bold text-2xl tracking-[-1px]">
          <span className="text-white">GRID</span>
          <span className="text-cyan-400">PHANTOMS</span>
        </Link>

        <div className="hidden lg:flex gap-5 xl:gap-8 text-sm">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={linkClassName(active === item.active)}
              aria-current={active === item.active ? 'page' : undefined}
            >
              {item.label}
            </Link>
          ))}
        </div>

        <button
          type="button"
          onClick={() => setMenuOpen(!menuOpen)}
          className="lg:hidden text-3xl text-white rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950"
          aria-label={menuOpen ? 'Close navigation menu' : 'Open navigation menu'}
          aria-expanded={menuOpen}
          aria-controls={mobileMenuId}
        >
          ☰
        </button>
      </div>

      {menuOpen && (
        <div
          id={mobileMenuId}
          className="lg:hidden bg-zinc-950 border-t border-zinc-900 py-6"
        >
          <div className="flex flex-col gap-6 px-6 text-lg">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setMenuOpen(false)}
                className={linkClassName(active === item.active)}
                aria-current={active === item.active ? 'page' : undefined}
              >
                {item.label}
              </Link>
            ))}
          </div>
        </div>
      )}
    </nav>
  );
}
