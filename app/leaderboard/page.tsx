'use client';

import SiteNav from '../components/SiteNav';
import SiteFooter from '../components/SiteFooter';
import { useState, useEffect } from 'react';
import { PHANTOM_REWARD_FILES } from '@/lib/phantom-reward-files';

type BytesLeaderboardEntry = { wallet: string; bytes: number };
type KeyholderLeaderboardEntry = { wallet: string; totalKeys: number; genesisQty: number; exodusQty: number };

export default function Leaderboard() {
  const [activeTab, setActiveTab] = useState<'bytes' | 'points'>('bytes');
  const [bytesLeaderboard, setBytesLeaderboard] = useState<BytesLeaderboardEntry[]>([]);
  const [keyholderLeaderboard, setKeyholderLeaderboard] = useState<KeyholderLeaderboardEntry[]>([]);
  const [loadingBytes, setLoadingBytes] = useState(true);
  const [errorBytes, setErrorBytes] = useState('');
  const [loadingKeyholders, setLoadingKeyholders] = useState(false);
  const [errorKeyholders, setErrorKeyholders] = useState('');
  const [lastSnapshot, setLastSnapshot] = useState('Timestamp unavailable');
  const [copiedWallet, setCopiedWallet] = useState<string | null>(null);

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedWallet(text);
      setTimeout(() => setCopiedWallet(null), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  const truncateWallet = (wallet: string) => {
    if (!wallet || wallet.length < 12) return wallet;
    return `0x${wallet.slice(2, 4)}...${wallet.slice(-6)}`;
  };

  const getOpenSeaProfile = (wallet: string) => {
    return `https://opensea.io/${wallet}`;
  };

  // Load BYTES leaderboard
  useEffect(() => {
    const loadBytes = async () => {
      try {
        const lookup: Record<string, number> = {};

        for (const file of PHANTOM_REWARD_FILES) {
          const res = await fetch(file);
          if (!res.ok) throw new Error(`Reward archive unavailable: ${file}`);
          const text = await res.text();
          text.trim().split('\n').forEach(line => {
            if (!line.trim()) return;
            const [wallet, amtStr] = line.split(',');
            if (wallet && amtStr) {
              const norm = wallet.trim().toLowerCase();
              const amount = parseFloat(amtStr.trim());
              if (!Number.isFinite(amount)) throw new Error(`Invalid reward archive: ${file}`);
              lookup[norm] = (lookup[norm] || 0) + amount;
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
        setBytesLeaderboard([]);
        setErrorBytes('Reward history is temporarily unavailable. Please try again later.');
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
    setLastSnapshot('Timestamp unavailable');

    try {
      const [res, metaRes] = await Promise.all([
        fetch('/holders-snapshot.csv'),
        fetch('/holders-snapshot.meta.json'),
      ]);
      if (!res.ok) throw new Error('Holder snapshot unavailable');
      const text = await res.text();

      if (metaRes.ok) {
        const metadata = await metaRes.json();
        if (typeof metadata.capturedAt === 'string' && Number.isFinite(Date.parse(metadata.capturedAt))) {
          setLastSnapshot(new Intl.DateTimeFormat('en-US', {
            month: 'long', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit',
            hourCycle: 'h23', timeZone: 'UTC', timeZoneName: 'short',
          }).format(new Date(metadata.capturedAt)));
        }
      }

      const holders: KeyholderLeaderboardEntry[] = [];

      text.trim().split('\n').slice(1).forEach(line => {
        if (!line.trim()) return;
        const [walletRaw, genesisQtyStr, exodusQtyStr] = line.split(',');
        if (!walletRaw) return;

        const wallet = walletRaw.trim().toLowerCase();
        const genesisQty = parseInt(genesisQtyStr || '0') || 0;
        const exodusQty = parseInt(exodusQtyStr || '0') || 0;
        const totalKeys = genesisQty + exodusQty;

        if (totalKeys > 0) {
          holders.push({ wallet, totalKeys, genesisQty, exodusQty });
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

  return (
    <div className="min-h-screen bg-black text-white flex flex-col">
      <SiteNav active="leaderboard" />

      <div className="w-full min-w-0 max-w-7xl mx-auto px-6 py-12 flex-1">
        <h1 className="text-4xl sm:text-5xl font-bold tracking-[-2px] mb-2">LEADERBOARDS</h1>
        <p className="text-zinc-500 mb-10">Keyholder rankings across Grid Phantoms</p>

        <div className="grid grid-cols-2 border-b border-zinc-800 mb-8">
          <button 
            onClick={() => setActiveTab('bytes')} 
            className={`min-w-0 px-2 sm:px-8 py-4 text-sm sm:text-lg leading-tight font-medium transition-colors ${activeTab === 'bytes' ? 'text-cyan-400 border-b-2 border-cyan-400' : 'text-zinc-400 hover:text-white'}`}
          >
            Rewards Leaderboard
          </button>
          <button 
            onClick={() => { setActiveTab('points'); loadKeyholderLeaderboard(); }} 
            className={`min-w-0 px-2 sm:px-8 py-4 text-sm sm:text-lg leading-tight font-medium transition-colors ${activeTab === 'points' ? 'text-cyan-400 border-b-2 border-cyan-400' : 'text-zinc-400 hover:text-white'}`}
          >
            Keyholder Leaderboard
          </button>
        </div>

        {/* BYTES TAB */}
        {activeTab === 'bytes' && (
          <div>
            <h2 className="text-2xl font-semibold mb-2 whitespace-nowrap overflow-hidden text-ellipsis">
              Top Lifetime Phantom Rewards
            </h2>
            <div className="text-xs text-zinc-500 mb-6">
              Current ranking of the top 50 reward recipients.
            </div>

            <div className="space-y-3">
              {loadingBytes ? (
                <p className="text-zinc-500" aria-live="polite">Loading...</p>
              ) : errorBytes ? (
                <p className="rounded-xl border border-red-500/40 bg-red-500/10 p-5 text-red-300" role="alert">{errorBytes}</p>
              ) : bytesLeaderboard.length === 0 ? (
                <p className="text-zinc-500">No reward recipients in the loaded archive.</p>
              ) : (
                bytesLeaderboard.map((entry, i) => (
                  <div key={i} className="bg-zinc-950 border border-zinc-900 rounded-2xl p-5 overflow-hidden">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        <span className="text-2xl font-mono text-zinc-500 w-12 flex-shrink-0 text-right">#{i+1}</span>
                        
                        <div className="flex items-center gap-2 flex-1 min-w-0">
                          <span className="font-mono text-sm text-zinc-400 truncate">
                            {truncateWallet(entry.wallet)}
                          </span>
                          <button
                            onClick={() => copyToClipboard(entry.wallet)}
                            className="text-white hover:text-cyan-300 text-xl leading-none transition-colors flex-shrink-0"
                            title="Copy address"
                          >
                            {copiedWallet === entry.wallet ? '✓' : '❏'}
                          </button>
                        </div>

                        <a 
                          href={getOpenSeaProfile(entry.wallet)} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="text-xs text-cyan-400 hover:text-cyan-300 transition-colors whitespace-nowrap flex-shrink-0"
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

        {/* KEYHOLDER TAB */}
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
                  <div key={i} className="bg-zinc-950 border border-zinc-900 rounded-2xl p-5 overflow-hidden">
                    <div className="flex items-center gap-3">
                      <span className="text-2xl font-mono text-zinc-500 w-12 flex-shrink-0 text-right">#{i+1}</span>
                      
                      <div className="flex items-center gap-2 flex-1 min-w-0">
                        <span className="font-mono text-sm text-zinc-400 truncate">
                          {truncateWallet(entry.wallet)}
                        </span>
                        <button
                          onClick={() => copyToClipboard(entry.wallet)}
                          className="text-white hover:text-cyan-300 text-xl leading-none transition-colors flex-shrink-0"
                          title="Copy address"
                        >
                          {copiedWallet === entry.wallet ? '✓' : '❏'}
                        </button>
                      </div>

                      <a 
                        href={getOpenSeaProfile(entry.wallet)} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="text-xs text-cyan-400 hover:text-cyan-300 transition-colors whitespace-nowrap flex-shrink-0"
                      >
                        [OpenSea Profile]
                      </a>
                    </div>

                    <div className="grid grid-cols-3 gap-4 text-center mt-4">
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

      <SiteFooter />
    </div>
  );
}