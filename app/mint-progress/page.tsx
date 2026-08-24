'use client';

import SiteNav from '../components/SiteNav';
import SiteFooter from '../components/SiteFooter';
import { useState, useEffect } from 'react';

const TOTAL_EXODUS_SUPPLY = 3333;

export default function MintProgress() {
  const [exodusMinted, setExodusMinted] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [mintError, setMintError] = useState('');

  useEffect(() => {
    const fetchExodusCount = async () => {
      try {
        const res = await fetch('/api/exodus-minted', { cache: 'no-store' });
        const data = await res.json();

        if (!res.ok || typeof data.minted !== 'number') {
          throw new Error(data.error || 'Unable to load Exodus minted count');
        }

        setExodusMinted(data.minted);
      } catch (err) {
        console.error(err);
        setExodusMinted(null);
        setMintError('Mint count is temporarily unavailable. Please try again later.');
      } finally {
        setLoading(false);
      }
    };

    fetchExodusCount();
  }, []);

  const progress = exodusMinted === null
    ? null
    : Math.min((exodusMinted / TOTAL_EXODUS_SUPPLY) * 100, 100);

  return (
    <div className="min-h-screen bg-black text-white flex flex-col">
      <SiteNav active="mint-progress" />

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
                ) : mintError ? (
                  <span className="text-red-400">Unavailable</span>
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
                style={{ width: `${progress ?? 0}%` }}
              />
            </div>

            {mintError && <p className="mt-5 text-center text-red-400" role="alert">{mintError}</p>}

            <div className="flex justify-between text-sm mt-4 text-zinc-400">
              <div>{progress === null ? '—' : `${progress.toFixed(2)}% minted`}</div>
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

      <SiteFooter />
    </div>
  );
}