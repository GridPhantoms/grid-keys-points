'use client';

/* eslint-disable @next/next/no-img-element -- role icons and shared season art retain the existing direct sources */

import Link from 'next/link';
import { useState, useEffect } from 'react';
import { PHANTOM_REWARD_FILES } from '@/lib/phantom-reward-files';
import { getGridClearance } from '@/lib/grid-clearance';
import { KEY_TRAIT_POINTS } from '@/lib/key-trait-points';

const GENESIS_CONTRACT = "0xF26e168D053F6779f7172A1d0b0A6cD8d7446493".toLowerCase();
const EXODUS_CONTRACT = "0xddF1d5f3A79ccbA74e284fD5b9Ee0FAdDB8993aa".toLowerCase();

const GENESIS_IMAGE = "/key-art/genesis.webp";
const EXODUS_IMAGE = "/key-art/exodus.webp";

const WALLET_COOKIE_NAME = 'gridphantoms_last_wallet';

type KeyData = {
  tokenId: string;
  collection: 'Genesis Keys' | 'Exodus Keys';
  image: string;
  points: number;
  traitsAvailable: boolean;
  topTrait: string;
  topTraitPoints: number;
};

type WalletNft = {
  tokenId: string | number;
  contract?: { address?: string };
};

type SupportDataState = 'loading' | 'available' | 'unavailable';
type LookupErrorKind = 'validation' | 'service' | 'empty' | null;

function setCookie(name: string, value: string) {
  document.cookie = `${name}=${encodeURIComponent(value)}; path=/; SameSite=Lax; Max-Age=315360000`;
}

function getCookie(name: string): string | null {
  const match = document.cookie.match(new RegExp('(^| )' + name + '=([^;]+)'));
  return match ? decodeURIComponent(match[2]) : null;
}

function deleteCookie(name: string) {
  document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;`;
}

export default function KeyholderConsole() {
  const [address, setAddress] = useState('');
  const [rememberWallet, setRememberWallet] = useState(false);
  const [loading, setLoading] = useState(false);
  const [keys, setKeys] = useState<KeyData[]>([]);
  const [phantomRewards, setPhantomRewards] = useState<number | null>(null);
  const [error, setError] = useState('');
  const [errorKind, setErrorKind] = useState<LookupErrorKind>(null);
  const [traitLookup, setTraitLookup] = useState<Record<string, string[]>>({});
  const [rewardsLookup, setRewardsLookup] = useState<Record<string, number>>({});
  const [traitDataState, setTraitDataState] = useState<SupportDataState>('loading');
  const [rewardDataState, setRewardDataState] = useState<SupportDataState>('loading');
  const [sortMode, setSortMode] = useState<'key' | 'points'>('key');


  // Load traits CSVs
  useEffect(() => {
    const loadCSVs = async () => {
      try {
        const [genesisRes, exodusRes] = await Promise.all([
          fetch('/genesis-traits.csv'),
          fetch('/exodus-traits.csv')
        ]);

        if (!genesisRes.ok || !exodusRes.ok) throw new Error('Trait data unavailable');

        const genesisText = await genesisRes.text();
        const exodusText = await exodusRes.text();

        const lookup: Record<string, string[]> = {};

        const genesisLines = genesisText.trim().split('\n');
        genesisLines.slice(1).forEach(line => {
          if (!line.trim()) return;
          const values = line.split(',');
          const name = values[0] || '';
          const match = name.match(/#(\d+)/);
          if (!match) return;
          const tokenId = match[1];
          const traits: string[] = [];
          for (let i = 3; i < values.length; i++) {
            const trait = values[i]?.trim();
            if (trait && trait !== '' && trait !== 'string') traits.push(trait);
          }
          lookup[`Genesis-${tokenId}`] = traits;
        });

        const exodusLines = exodusText.trim().split('\n');
        exodusLines.slice(1).forEach(line => {
          if (!line.trim()) return;
          const values = line.split(',');
          const name = values[0] || '';
          const match = name.match(/#(\d+)/);
          if (!match) return;
          const tokenId = match[1];
          const traits: string[] = [];
          for (let i = 3; i < values.length; i++) {
            const trait = values[i]?.trim();
            if (trait && trait !== '' && trait !== 'string') traits.push(trait);
          }
          lookup[`Exodus-${tokenId}`] = traits;
        });

        if (Object.keys(lookup).length === 0) throw new Error('Trait data is empty');
        setTraitLookup(lookup);
        setTraitDataState('available');
      } catch (e) {
        console.error("Failed to load traits CSVs:", e);
        setTraitDataState('unavailable');
      }
    };

    loadCSVs();
  }, []);

  // Load airdrop CSVs
  useEffect(() => {
    const loadAirdrops = async () => {
      try {
        const lookup: Record<string, number> = {};

        for (const file of PHANTOM_REWARD_FILES) {
          const res = await fetch(file);
          if (!res.ok) throw new Error(`Reward history unavailable: ${file}`);
          const text = await res.text();
          const lines = text.trim().split('\n');

          lines.forEach(line => {
            if (!line.trim()) return;
            const [wallet, amountStr] = line.split(',');
            if (!wallet || !amountStr) return;
            const normalized = wallet.trim().toLowerCase();
            const amount = parseFloat(amountStr.trim());
            if (!Number.isFinite(amount)) throw new Error(`Invalid reward history: ${file}`);
            lookup[normalized] = (lookup[normalized] || 0) + amount;
          });
        }

        setRewardsLookup(lookup);
        setRewardDataState('available');
      } catch (e) {
        console.error("Failed to load airdrop CSVs:", e);
        setRewardDataState('unavailable');
      }
    };

    loadAirdrops();
  }, []);

  // Load saved wallet from cookie
  useEffect(() => {
    const timer = window.setTimeout(() => {
      const savedWallet = getCookie(WALLET_COOKIE_NAME);
      if (savedWallet) {
        setAddress(savedWallet);
        setRememberWallet(true);
      }
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  const calculatePointsAndTopTrait = (traits: string[]) => {
    let total = 0;
    let highestPoints = 0;
    let topTrait = 'None';
    let topTraitPoints = 0;

    traits.forEach(trait => {
      if (trait === "Genesis" || trait === "Exodus") {
        const points = KEY_TRAIT_POINTS[`Reward Modulation - ${trait}`] || 0;
        total += points;
        return;
      }
      let points = KEY_TRAIT_POINTS[trait] || 0;
      if (points === 0) {
        const match = Object.keys(KEY_TRAIT_POINTS).find(k => k.endsWith(` - ${trait}`));
        if (match) points = KEY_TRAIT_POINTS[match];
      }
      total += points;
      if (points > highestPoints) {
        highestPoints = points;
        topTrait = trait;
        topTraitPoints = points;
      }
    });

    return { points: total, topTrait, topTraitPoints };
  };

  const handleLoad = async () => {
    if (!address) return;

    if (traitDataState === 'loading') {
      setErrorKind('service');
      setError('Trait data is still loading. Please try again in a moment.');
      return;
    }

    setLoading(true);
    setError('');
    setErrorKind(null);
    setKeys([]);
    setPhantomRewards(null);

    try {
      const response = await fetch(
        `/api/wallet-keys?owner=${encodeURIComponent(address.trim())}`,
        { cache: 'no-store' },
      );
      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          response.status === 400
            ? "Enter a valid Ethereum wallet address."
            : "Unable to load wallet Keys right now. Please try again.",
        );
      }

      const allNfts: WalletNft[] = Array.isArray(data.ownedNfts) ? data.ownedNfts : [];

      const processedKeys: KeyData[] = [];

      allNfts.forEach((nft) => {
        const tokenId = nft.tokenId.toString();
        const contract = nft.contract?.address?.toLowerCase();
        const isGenesis = contract === GENESIS_CONTRACT;

        const lookupKey = `${isGenesis ? "Genesis" : "Exodus"}-${tokenId}`;
        const traits = traitLookup[lookupKey];
        const traitsAvailable = Boolean(traits?.length);
        const { points, topTrait, topTraitPoints } = traitsAvailable
          ? calculatePointsAndTopTrait(traits ?? [])
          : { points: 0, topTrait: 'Trait data unavailable', topTraitPoints: 0 };

        processedKeys.push({
          tokenId,
          collection: isGenesis ? "Genesis Keys" : "Exodus Keys",
          image: isGenesis ? GENESIS_IMAGE : EXODUS_IMAGE,
          points,
          traitsAvailable,
          topTrait,
          topTraitPoints
        });
      });

      setKeys(processedKeys);

      if (processedKeys.length > 0) {
        const normalizedWallet = address.toLowerCase();
        setPhantomRewards(
          rewardDataState === 'available' ? (rewardsLookup[normalizedWallet] ?? 0) : null,
        );

        if (rememberWallet) setCookie(WALLET_COOKIE_NAME, address);
      } else {
        setErrorKind('empty');
        setError("No Keys found in this wallet.");
      }

    } catch (err: unknown) {
      console.error("Wallet Key load failed");
      const isValidation = err instanceof Error && err.message === "Enter a valid Ethereum wallet address.";
      setErrorKind(isValidation ? 'validation' : 'service');
      setError(isValidation ? err.message : "Unable to load wallet Keys right now. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleClear = () => {
    setAddress('');
    setKeys([]);
    setPhantomRewards(null);
    setError('');
    setErrorKind(null);
    deleteCookie(WALLET_COOKIE_NAME);
    setRememberWallet(false);
  };

  const getSortedKeys = (collectionKeys: KeyData[]) => {
    return [...collectionKeys].sort((a, b) => {
      if (sortMode === 'key') return parseInt(a.tokenId) - parseInt(b.tokenId);
      return b.points - a.points;
    });
  };

  const sortedGenesis = getSortedKeys(keys.filter(k => k.collection === 'Genesis Keys'));
  const sortedExodus = getSortedKeys(keys.filter(k => k.collection === 'Exodus Keys'));

  const totalPoints = keys.reduce((sum, k) => sum + (k.points || 0), 0);
  const hasIncompleteTraits = keys.some((key) => !key.traitsAvailable);
  const totalGenesis = sortedGenesis.length;
  const totalExodus = sortedExodus.length;
  const totalKeys = keys.length;
  const clearance = getGridClearance(totalPoints);

  return (
    <section className="kh-console-shell" id="keyholder-console" aria-labelledby="console-title">
      <div className="kh-console-inner">
        <header className="kh-console-head">
          <p className="hb-eyebrow">KEYHOLDER ACCESS // READ-ONLY</p>
          <h2 id="console-title">Reveal your position in the Grid.</h2>
          <p>Inspect Genesis and Exodus Keys, Trait Points, unlocked roles and Lifetime Phantom Rewards. No wallet connection, signature or transaction required.</p>
        </header>
        <div className="kh-console-form">
          <label htmlFor="wallet-address" className="block text-xs text-zinc-500 mb-2">WALLET ADDRESS</label>
          <div className="flex flex-col sm:flex-row gap-3">
            <input
              id="wallet-address"
              type="text"
              inputMode="text"
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="none"
              spellCheck="false"
              style={{ fontSize: '16px' }}
              value={address}
              onChange={(e) => { setAddress(e.target.value); setError(''); setErrorKind(null); }}
              className="flex-1 bg-zinc-900 border border-zinc-800 rounded-xl px-5 py-4 text-sm font-mono focus:border-cyan-500 focus:outline-none"
              placeholder="0x..."
            />
            <button
              type="button"
              onClick={handleLoad}
              disabled={loading || !address || traitDataState === 'loading' || rewardDataState === 'loading'}
              className="bg-cyan-500 hover:bg-cyan-600 px-8 py-4 rounded-xl font-medium text-sm disabled:bg-zinc-700 transition-colors whitespace-nowrap"
            >
              {loading ? 'LOADING...' : 'LOAD KEYS'}
            </button>
            <button
              type="button"
              onClick={handleClear}
              className="px-6 py-4 border border-zinc-700 rounded-xl text-sm hover:bg-zinc-900 transition-colors"
            >
              Clear
            </button>
          </div>

          <div className="mt-3 text-sm" aria-live="polite">
            {traitDataState === 'loading' && <p className="text-zinc-500">Loading Key trait data…</p>}
            {traitDataState === 'unavailable' && <p className="text-amber-400">Trait data is temporarily unavailable. Key ownership can still be checked; Trait Points will be marked unavailable.</p>}
            {rewardDataState === 'loading' && <p className="text-zinc-500">Loading Phantom Reward history…</p>}
            {rewardDataState === 'unavailable' && <p className="text-amber-400">Reward history is temporarily unavailable. Key ownership can still be checked.</p>}
          </div>

          <div className="mt-4 flex items-center gap-2">
            <input
              type="checkbox"
              id="remember"
              checked={rememberWallet}
              onChange={(e) => setRememberWallet(e.target.checked)}
              className="w-4 h-4 accent-cyan-500"
            />
            <label htmlFor="remember" className="text-sm text-zinc-400 cursor-pointer">
              Remember this wallet
            </label>
          </div>

          {error && (
            <div className="mt-6 text-center" role="alert">
              <p className="text-red-400 text-lg font-medium">{error}</p>
              {errorKind === 'empty' && (
                <a
                  href="https://manifold.xyz/@gridphantoms/id/4067746032"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-3 inline-block text-cyan-400 hover:text-cyan-300 text-lg underline"
                >
                  Mint Exodus Keys here.
                </a>
              )}
            </div>
          )}
        </div>

        {keys.length > 0 && (
          <div className="kh-results">
            {(rewardDataState === 'unavailable' || hasIncompleteTraits) && (
              <div className="mb-6 rounded-xl border border-amber-500/40 bg-amber-500/10 p-4 text-sm text-amber-200" role="alert">
                Partial data: Key ownership is available, but {hasIncompleteTraits ? 'some Trait Points' : 'Lifetime Phantom Rewards'} {hasIncompleteTraits && rewardDataState === 'unavailable' ? 'and Lifetime Phantom Rewards are' : 'are'} temporarily unavailable.
              </div>
            )}
            {/* Main Stats + Grid Clearance + Lifetime Rewards */}
            <div className="kh-summary-grid mb-10">
              <div className="kh-stat-panel bg-zinc-950 border border-zinc-900 rounded-2xl p-6">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
                  <div>
                    <p className="text-[10px] text-zinc-500 mb-1">TOTAL POINT SUM</p>
                    <p className="text-4xl md:text-5xl font-bold text-cyan-400 tracking-tighter">{hasIncompleteTraits ? '—' : totalPoints.toLocaleString()}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-zinc-500 mb-1">GENESIS KEYS</p>
                    <p className="text-4xl md:text-5xl font-bold">{totalGenesis}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-zinc-500 mb-1">EXODUS KEYS</p>
                    <p className="text-4xl md:text-5xl font-bold">{totalExodus}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-zinc-500 mb-1">TOTAL KEYS</p>
                    <p className="text-4xl md:text-5xl font-bold">{totalKeys}</p>
                  </div>
                </div>
              </div>

              <div className="kh-clearance-panel bg-zinc-950 border border-cyan-500/40 rounded-2xl p-6">
                {hasIncompleteTraits ? (
                  <>
                    <p className="text-[10px] text-cyan-400 tracking-widest">GRID CLEARANCE</p>
                    <p className="mt-4 text-2xl font-bold">UNAVAILABLE</p>
                    <p className="mt-3 text-xs leading-relaxed text-amber-300">Complete Trait Point data is required to reconstruct Clearance.</p>
                  </>
                ) : (
                  <>
                    <p className="text-[10px] text-cyan-400 tracking-widest">GRID CLEARANCE</p>
                    <div className="kh-clearance-level">
                      <strong>LEVEL {clearance.level}</strong>
                      <span>{clearance.name}</span>
                    </div>

                    <div className="kh-clearance-support">
                      <span>CURRENT HAZARD SUPPORT SCHEDULE</span>
                      <strong>+{clearance.hazardSupport} BYTES</strong>
                      <small>WHEN ACTIVATED</small>
                    </div>

                    {clearance.nextLevel && clearance.pointsToNextLevel !== null ? (
                      <div className="kh-clearance-progress">
                        <div><span>POINTS TO LEVEL {clearance.nextLevel.level}</span><strong>{clearance.pointsToNextLevel.toLocaleString()}</strong></div>
                        <div className="kh-clearance-track" aria-label={`${clearance.progressPercent.toFixed(0)}% progress to Level ${clearance.nextLevel.level}`}>
                          <span style={{ width: `${clearance.progressPercent}%` }} />
                        </div>
                      </div>
                    ) : (
                      <div className="kh-clearance-classified">
                        <span>MAXIMUM ACTIVE CLEARANCE</span>
                        <strong>LEVEL 5 // CLASSIFIED</strong>
                      </div>
                    )}

                    <p className="kh-clearance-rule">Points determine Clearance. Participation activates it.</p>
                    <p className="kh-clearance-note">The current schedule applies once per eligible wallet only when participation qualifies and a discretionary potential Phantom Reward distribution is approved. Points follow current Key ownership.</p>
                    <Link href="/trait-charts" className="kh-clearance-link">OPEN TRAIT INTELLIGENCE ARCHIVE →</Link>
                  </>
                )}
              </div>

              <div className="kh-reward-panel bg-zinc-950 border border-cyan-500/30 rounded-2xl p-6 text-center flex flex-col justify-center">
                <p className="text-[10px] text-cyan-400 mb-1 tracking-widest">LIFETIME PHANTOM REWARDS</p>
                <p className="text-4xl md:text-5xl font-bold text-white tracking-tighter">
                  {phantomRewards !== null ? phantomRewards.toLocaleString() : '—'}
                </p>
                <p className="text-sm text-cyan-400 mt-1">$BYTES</p>
                {rewardDataState === 'unavailable' && <p className="mt-2 text-xs text-amber-400">Lifetime Phantom Rewards unavailable</p>}
              </div>
            </div>

            {/* ROLE BADGES */}
            <div className="kh-roles mb-12 bg-zinc-950 border border-zinc-900 rounded-2xl p-6">
              <p className="text-[10px] text-cyan-400 mb-4 tracking-widest">ROLES UNLOCKED</p>
              
              <div className="flex flex-wrap gap-4">
                {totalGenesis >= 69 && (
                  <div className="flex items-center gap-3 bg-black/50 border border-zinc-800 rounded-2xl px-5 py-3">
                    <img src="/roles/genesis-keylord.png" alt="" className="w-8 h-8" />
                    <span className="font-medium text-sm">Genesis Keylord</span>
                  </div>
                )}
                {totalGenesis >= 21 && (
                  <div className="flex items-center gap-3 bg-black/50 border border-zinc-800 rounded-2xl px-5 py-3">
                    <img src="/roles/genesis-keymaster.png" alt="" className="w-8 h-8" />
                    <span className="font-medium text-sm">Genesis Keymaster</span>
                  </div>
                )}
                {totalGenesis >= 3 && (
                  <div className="flex items-center gap-3 bg-black/50 border border-zinc-800 rounded-2xl px-5 py-3">
                    <img src="/roles/genesis-strategist.png" alt="" className="w-8 h-8" />
                    <span className="font-medium text-sm">Genesis Strategist</span>
                  </div>
                )}
                {totalGenesis >= 1 && (
                  <div className="flex items-center gap-3 bg-black/50 border border-zinc-800 rounded-2xl px-5 py-3">
                    <img src="/roles/genesis-keyholder.png" alt="" className="w-8 h-8" />
                    <span className="font-medium text-sm">Genesis Keyholder</span>
                  </div>
                )}

                {totalExodus >= 69 && (
                  <div className="flex items-center gap-3 bg-black/50 border border-zinc-800 rounded-2xl px-5 py-3">
                    <img src="/roles/exodus-keylord.png" alt="" className="w-8 h-8" />
                    <span className="font-medium text-sm">Exodus Keylord</span>
                  </div>
                )}
                {totalExodus >= 42 && (
                  <div className="flex items-center gap-3 bg-black/50 border border-zinc-800 rounded-2xl px-5 py-3">
                    <img src="/roles/exodus-keywarden.png" alt="" className="w-8 h-8" />
                    <span className="font-medium text-sm">Exodus Keywarden</span>
                  </div>
                )}
                {totalExodus >= 21 && (
                  <div className="flex items-center gap-3 bg-black/50 border border-zinc-800 rounded-2xl px-5 py-3">
                    <img src="/roles/exodus-keymaster.png" alt="" className="w-8 h-8" />
                    <span className="font-medium text-sm">Exodus Keymaster</span>
                  </div>
                )}
                {totalExodus >= 3 && (
                  <div className="flex items-center gap-3 bg-black/50 border border-zinc-800 rounded-2xl px-5 py-3">
                    <img src="/roles/exodus-strategist.png" alt="" className="w-8 h-8" />
                    <span className="font-medium text-sm">Exodus Strategist</span>
                  </div>
                )}
                {totalExodus >= 1 && (
                  <div className="flex items-center gap-3 bg-black/50 border border-zinc-800 rounded-2xl px-5 py-3">
                    <img src="/roles/exodus-keyholder.png" alt="" className="w-8 h-8" />
                    <span className="font-medium text-sm">Exodus Keyholder</span>
                  </div>
                )}

                {(totalGenesis >= 21 || totalExodus >= 21) && (
                  <div className="flex items-center gap-3 bg-black/50 border border-zinc-800 rounded-2xl px-5 py-3">
                    <img src="/roles/grid-council.png" alt="" className="w-8 h-8" />
                    <span className="font-medium text-sm">Grid Council</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {sortedGenesis.length > 0 && (
          <div className="mb-16">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-medium text-zinc-400">GENESIS KEYS ({totalGenesis})</h2>
              <select value={sortMode} onChange={(e) => setSortMode(e.target.value as 'key' | 'points')} className="bg-zinc-900 border border-zinc-800 text-sm rounded-xl px-4 py-2 text-zinc-400 focus:outline-none focus:border-cyan-500">
                <option value="key">Sort by Key #</option>
                <option value="points">Sort by Points (High to Low)</option>
              </select>
            </div>
            <div className="kh-key-grid grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-7 gap-4">
              {sortedGenesis.map((key) => <Card key={key.tokenId} keyData={key} />)}
            </div>
          </div>
        )}

        {sortedExodus.length > 0 && (
          <div>
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-medium text-zinc-400">EXODUS KEYS ({totalExodus})</h2>
              <select value={sortMode} onChange={(e) => setSortMode(e.target.value as 'key' | 'points')} className="bg-zinc-900 border border-zinc-800 text-sm rounded-xl px-4 py-2 text-zinc-400 focus:outline-none focus:border-cyan-500">
                <option value="key">Sort by Key #</option>
                <option value="points">Sort by Points (High to Low)</option>
              </select>
            </div>
            <div className="kh-key-grid grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-7 gap-4">
              {sortedExodus.map((key) => <Card key={key.tokenId} keyData={key} />)}
            </div>
          </div>
        )}

        {keys.length === 0 && !loading && !error && (
          <div className="text-center py-20 text-zinc-500">
            Enter a wallet address and click LOAD KEYS
          </div>
        )}
      </div>

    </section>
  );
}

function Card({ keyData }: { keyData: KeyData }) {
  const openseaUrl = keyData.collection === "Genesis Keys" 
    ? `https://opensea.io/assets/ethereum/${GENESIS_CONTRACT}/${keyData.tokenId}`
    : `https://opensea.io/assets/ethereum/${EXODUS_CONTRACT}/${keyData.tokenId}`;

  return (
    <article className="kh-key-card group bg-zinc-950 border border-zinc-900 hover:border-cyan-500/50 rounded-2xl overflow-hidden transition-all duration-300">
      <div className="relative aspect-square bg-black">
        <img src={keyData.image} alt={`${keyData.collection} shared artwork for Key #${keyData.tokenId}`} className="w-full h-full object-cover" />
        <div className="absolute top-3 right-3 bg-black/90 px-2.5 py-0.5 rounded text-[10px] font-mono tracking-widest">#{keyData.tokenId}</div>
      </div>

      <div className="p-4">
        <p className="text-[10px] text-zinc-500 tracking-widest">{keyData.collection}</p>
        <p className="font-semibold text-lg tracking-tight mt-1">Key #{keyData.tokenId}</p>

        <div className="mt-4">
          <p className="text-xs text-zinc-500">POINTS</p>
          <p className="text-3xl font-bold tracking-tighter">{keyData.traitsAvailable ? keyData.points : '—'}</p>
          {!keyData.traitsAvailable && <p className="mt-1 text-xs text-amber-400">Trait Points unavailable</p>}
        </div>

        {keyData.traitsAvailable && keyData.topTrait && keyData.topTrait !== 'None' && (
          <div className="mt-4 pt-4 border-t border-zinc-900">
            <p className="text-xs text-cyan-400 tracking-widest">HOT TRAIT</p>
            <p className="text-base font-medium text-white mt-1">{keyData.topTrait}</p>
            <p className="text-sm text-cyan-500 mt-0.5">Point Value: {keyData.topTraitPoints}</p>
          </div>
        )}

        <div className="mt-4 pt-3 border-t border-zinc-900">
          <a href={openseaUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-cyan-400 hover:text-cyan-300 transition-colors">
            View on OpenSea
          </a>
        </div>
      </div>
    </article>
  );
}