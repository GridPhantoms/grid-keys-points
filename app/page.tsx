'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

const GENESIS_CONTRACT = "0xF26e168D053F6779f7172A1d0b0A6cD8d7446493".toLowerCase();
const EXODUS_CONTRACT = "0xddF1d5f3A79ccbA74e284fD5b9Ee0FAdDB8993aa".toLowerCase();

const GENESIS_IMAGE = "https://i.imgur.com/UW7D5Ja.jpg";
const EXODUS_IMAGE = "https://i.imgur.com/ticSkU9.jpg";

const WALLET_COOKIE_NAME = 'gridphantoms_last_wallet';

export default function GridKeysPoints() {
  const [address, setAddress] = useState('');
  const [rememberWallet, setRememberWallet] = useState(false);
  const [loading, setLoading] = useState(false);
  const [keys, setKeys] = useState<any[]>([]);
  const [phantomRewards, setPhantomRewards] = useState<number | null>(null);
  const [error, setError] = useState('');
  const [traitLookup, setTraitLookup] = useState<Record<string, string[]>>({});
  const [rewardsLookup, setRewardsLookup] = useState<Record<string, number>>({});
  const [sortMode, setSortMode] = useState<'key' | 'points'>('key');
  const [menuOpen, setMenuOpen] = useState(false);

  const pointsMap: Record<string, number> = {
    "Grid Dominion - Whispering Strike": 200,
    "Grid Dominion - Steady Barrage": 400,
    "Grid Dominion - Ambush Onslaught": 600,
    "Grid Dominion - Intense Blitz": 800,
    "Grid Dominion - Phantom Conquest": 1000,
    "Cloaking Power - Quiet Shadow": 200,
    "Cloaking Power - Fading Mist": 400,
    "Cloaking Power - Stealth Barrier": 600,
    "Cloaking Power - Deep Camouflage": 800,
    "Cloaking Power - Phantom Invisibility": 1000,
    "Code Stratagem - Emerging Tactic": 200,
    "Code Stratagem - Partial Scheme": 400,
    "Code Stratagem - Intact Blueprint": 600,
    "Code Stratagem - Masterful Hack": 800,
    "Code Stratagem - Phantom Stratagem": 1000,
    "Veil Assault - Subtle Slash": 200,
    "Veil Assault - Surgical Strike": 400,
    "Veil Assault - Fierce Breach": 600,
    "Veil Assault - Radiant Charge": 800,
    "Veil Assault - Phantom Overthrow": 1000,
    "Pulse Fortitude - Silent Endurance": 200,
    "Pulse Fortitude - Iron Constitution": 400,
    "Pulse Fortitude - Resonant Stamina": 600,
    "Pulse Fortitude - Radiant Tenacity": 800,
    "Pulse Fortitude - Phantom Command": 1000,
    "Reward Modulation - Genesis": 1000,

    "Aerial Domain - Silent Drift": 100,
    "Aerial Domain - Shadow Split": 200,
    "Aerial Domain - Fading Horizon": 300,
    "Aerial Domain - Veil Shatter": 400,
    "Aerial Domain - Exodus Flight": 500,
    "Grid Speed - Chrome Blitz": 100,
    "Grid Speed - Holo Sprint": 200,
    "Grid Speed - Flux Burst": 300,
    "Grid Speed - Ghost Overdrive": 400,
    "Grid Speed - Exodus Warp": 500,
    "Exodus Sovereignty - Silent Ascendancy": 100,
    "Exodus Sovereignty - Umbral Rule": 200,
    "Exodus Sovereignty - Spectral Decree": 300,
    "Exodus Sovereignty - Shadow Insurrection": 400,
    "Exodus Sovereignty - Exodus Dominion": 500,
    "Veiled Power - Veil Rend": 100,
    "Veiled Power - Oblivion Strike": 200,
    "Veiled Power - Grid Surge": 300,
    "Veiled Power - Eternal Edict": 400,
    "Veiled Power - Exodus Sprawl": 500,
    "Phantom Weapon - Echo Dagger": 100,
    "Phantom Weapon - Ghostwire Rifle": 200,
    "Phantom Weapon - Reaper Katanas": 300,
    "Phantom Weapon - Nebula Cannon": 400,
    "Phantom Weapon - Quantum Raygun": 500,
    "Reward Modulation - Exodus": 500,
  };

  // Load traits CSVs
  useEffect(() => {
    const loadCSVs = async () => {
      try {
        const [genesisRes, exodusRes] = await Promise.all([
          fetch('/genesis-traits.csv'),
          fetch('/exodus-traits.csv')
        ]);

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

        setTraitLookup(lookup);
      } catch (e) {
        console.error("Failed to load traits CSVs:", e);
      }
    };

    loadCSVs();
  }, []);

  // Load airdrop CSVs
  useEffect(() => {
    const loadAirdrops = async () => {
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
          const lines = text.trim().split('\n');

          lines.forEach(line => {
            if (!line.trim()) return;
            const [wallet, amountStr] = line.split(',');
            if (!wallet || !amountStr) return;
            const normalized = wallet.trim().toLowerCase();
            const amount = parseFloat(amountStr.trim());
            lookup[normalized] = (lookup[normalized] || 0) + amount;
          });
        }

        setRewardsLookup(lookup);
      } catch (e) {
        console.error("Failed to load airdrop CSVs:", e);
      }
    };

    loadAirdrops();
  }, []);

  // Load saved wallet from cookie
  useEffect(() => {
    const savedWallet = getCookie(WALLET_COOKIE_NAME);
    if (savedWallet) {
      setAddress(savedWallet);
      setRememberWallet(true);
    }
  }, []);

  const setCookie = (name: string, value: string) => {
    document.cookie = `${name}=${encodeURIComponent(value)}; path=/; SameSite=Lax; Max-Age=315360000`;
  };

  const getCookie = (name: string): string | null => {
    const match = document.cookie.match(new RegExp('(^| )' + name + '=([^;]+)'));
    return match ? decodeURIComponent(match[2]) : null;
  };

  const deleteCookie = (name: string) => {
    document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;`;
  };

  const calculatePointsAndTopTrait = (traits: string[]) => {
    let total = 0;
    let highestPoints = 0;
    let topTrait = 'None';
    let topTraitPoints = 0;

    traits.forEach(trait => {
      if (trait === "Genesis" || trait === "Exodus") {
        const points = pointsMap[`Reward Modulation - ${trait}`] || 0;
        total += points;
        return;
      }
      let points = pointsMap[trait] || 0;
      if (points === 0) {
        const match = Object.keys(pointsMap).find(k => k.endsWith(` - ${trait}`));
        if (match) points = pointsMap[match];
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

    setLoading(true);
    setError('');
    setKeys([]);
    setPhantomRewards(null);

    try {
      const apiKey = process.env.NEXT_PUBLIC_ALCHEMY_API_KEY;
      if (!apiKey) throw new Error("Alchemy API key is missing");

      const url = `https://eth-mainnet.g.alchemy.com/nft/v3/${apiKey}/getNFTsForOwner?owner=${address}&contractAddresses[]=${GENESIS_CONTRACT}&contractAddresses[]=${EXODUS_CONTRACT}&withMetadata=true&limit=100`;

      const response = await fetch(url);
      if (!response.ok) throw new Error("Alchemy request failed");

      const data = await response.json();
      const nfts = data.ownedNfts || [];

      const processedKeys: any[] = [];

      nfts.forEach((nft: any) => {
        const tokenId = nft.tokenId.toString();
        const contract = nft.contract?.address?.toLowerCase();
        const isGenesis = contract === GENESIS_CONTRACT;

        const lookupKey = `${isGenesis ? "Genesis" : "Exodus"}-${tokenId}`;
        const traits = traitLookup[lookupKey];

        if (!traits || traits.length === 0) return;

        const { points, topTrait, topTraitPoints } = calculatePointsAndTopTrait(traits);

        const openseaUrl = isGenesis 
          ? `https://opensea.io/assets/ethereum/${GENESIS_CONTRACT}/${tokenId}`
          : `https://opensea.io/assets/ethereum/${EXODUS_CONTRACT}/${tokenId}`;

        processedKeys.push({
          tokenId,
          collection: isGenesis ? "Genesis Keys" : "Exodus Keys",
          image: isGenesis ? GENESIS_IMAGE : EXODUS_IMAGE,
          points,
          topTrait,
          topTraitPoints,
          openseaUrl
        });
      });

      setKeys(processedKeys);

      if (processedKeys.length > 0) {
        const normalizedWallet = address.toLowerCase();
        const rewards = rewardsLookup[normalizedWallet] || 0;
        setPhantomRewards(rewards);

        if (rememberWallet) setCookie(WALLET_COOKIE_NAME, address);
      } else {
        setError("No Keys found in this wallet.\n\nMint Exodus Keys here.");
      }

    } catch (err: any) {
      console.error(err);
      setError(err.message || "Failed to load keys.");
    } finally {
      setLoading(false);
    }
  };

  const handleClear = () => {
    setAddress('');
    setKeys([]);
    setPhantomRewards(null);
    setError('');
    deleteCookie(WALLET_COOKIE_NAME);
    setRememberWallet(false);
  };

  const getSortedKeys = (collectionKeys: any[]) => {
    return [...collectionKeys].sort((a, b) => {
      if (sortMode === 'key') return parseInt(a.tokenId) - parseInt(b.tokenId);
      return b.points - a.points;
    });
  };

  const sortedGenesis = getSortedKeys(keys.filter(k => k.collection === 'Genesis Keys'));
  const sortedExodus = getSortedKeys(keys.filter(k => k.collection === 'Exodus Keys'));

  const totalPoints = keys.reduce((sum, k) => sum + (k.points || 0), 0);
  const totalGenesis = sortedGenesis.length;
  const totalExodus = sortedExodus.length;
  const totalKeys = keys.length;

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
          </div>

          <button 
            onClick={() => setMenuOpen(!menuOpen)}
            className="md:hidden text-3xl text-white"
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
            </div>
          </div>
        )}
      </nav>

      <div className="max-w-7xl mx-auto px-6 py-8 flex-1">
        <div className="max-w-md mx-auto mb-10">
          <label className="block text-xs text-zinc-500 mb-2">WALLET ADDRESS</label>
          <div className="flex flex-col sm:flex-row gap-3">
            <input
              type="text"
              inputMode="text"
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="none"
              spellCheck="false"
              style={{ fontSize: '16px' }}
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              className="flex-1 bg-zinc-900 border border-zinc-800 rounded-xl px-5 py-4 text-sm font-mono focus:border-cyan-500 focus:outline-none"
              placeholder="0x..."
            />
            <button
              type="button"
              onClick={handleLoad}
              disabled={loading || !address}
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
            <div className="mt-6 text-center">
              <p className="text-red-400 text-lg font-medium">No Keys found in this wallet.</p>
              <a 
                href="https://manifold.xyz/@gridphantoms/id/4067746032" 
                target="_blank" 
                rel="noopener noreferrer"
                className="mt-3 inline-block text-cyan-400 hover:text-cyan-300 text-lg underline"
              >
                Mint Exodus Keys here.
              </a>
            </div>
          )}
        </div>

        {keys.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-5 gap-6 mb-12">
            <div className="md:col-span-4 bg-zinc-950 border border-zinc-900 rounded-2xl p-6">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
                <div>
                  <p className="text-[10px] text-zinc-500 mb-1">TOTAL POINT SUM</p>
                  <p className="text-4xl md:text-5xl font-bold text-cyan-400 tracking-tighter">{totalPoints.toLocaleString()}</p>
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

            <div className="bg-zinc-950 border border-cyan-500/30 rounded-2xl p-6 text-center flex flex-col justify-center">
              <p className="text-[10px] text-cyan-400 mb-1 tracking-widest">LIFETIME PHANTOM REWARDS</p>
              <p className="text-4xl md:text-5xl font-bold text-white tracking-tighter">
                {phantomRewards !== null ? phantomRewards.toLocaleString() : '—'}
              </p>
              <p className="text-sm text-cyan-400 mt-1">$BYTES</p>
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
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-7 gap-4">
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
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-7 gap-4">
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

      {/* Updated Footer - Centered on mobile, left/right on desktop */}
      <footer className="border-t border-zinc-900 bg-zinc-950 py-10 mt-auto">
        <div className="max-w-7xl mx-auto px-6">
          <div className="flex flex-col md:flex-row justify-center md:justify-between items-center gap-8">
            {/* Links - centered on mobile */}
            <div className="flex flex-wrap gap-8 text-sm justify-center md:justify-start">
              <a href="https://discord.gg/gridphantoms" target="_blank" rel="noopener noreferrer" className="hover:text-white transition-colors">Discord</a>
              <a href="https://x.com/GridPhantoms" target="_blank" rel="noopener noreferrer" className="hover:text-white transition-colors">X</a>
              <a href="https://opensea.io/collection/grid-phantoms-genesis-keys" target="_blank" rel="noopener noreferrer" className="hover:text-white transition-colors">OpenSea</a>
              <a href="https://snapshot.box/#/s:gridphantoms.eth" target="_blank" rel="noopener noreferrer" className="hover:text-white transition-colors">Snapshot</a>
              <a href="https://manifold.xyz/@gridphantoms/id/4067746032" target="_blank" rel="noopener noreferrer" className="hover:text-white transition-colors">Exodus Mint</a>
            </div>

            {/* Copyright */}
            <div className="text-xs text-zinc-500 text-center md:text-right">
              © 2026 Grid Phantoms Ltd. All rights reserved.
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}

function Card({ keyData }: { keyData: any }) {
  const openseaUrl = keyData.collection === "Genesis Keys" 
    ? `https://opensea.io/assets/ethereum/${GENESIS_CONTRACT}/${keyData.tokenId}`
    : `https://opensea.io/assets/ethereum/${EXODUS_CONTRACT}/${keyData.tokenId}`;

  return (
    <div className="group bg-zinc-950 border border-zinc-900 hover:border-cyan-500/50 rounded-2xl overflow-hidden transition-all duration-300">
      <div className="relative aspect-square bg-black">
        <img src={keyData.image} alt={`Key #${keyData.tokenId}`} className="w-full h-full object-cover" />
        <div className="absolute top-3 right-3 bg-black/90 px-2.5 py-0.5 rounded text-[10px] font-mono tracking-widest">#{keyData.tokenId}</div>
      </div>

      <div className="p-4">
        <p className="text-[10px] text-zinc-500 tracking-widest">{keyData.collection}</p>
        <p className="font-semibold text-lg tracking-tight mt-1">Key #{keyData.tokenId}</p>

        <div className="mt-4">
          <p className="text-xs text-zinc-500">POINTS</p>
          <p className="text-3xl font-bold tracking-tighter">{keyData.points}</p>
        </div>

        {keyData.topTrait && keyData.topTrait !== 'None' && (
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
    </div>
  );
}