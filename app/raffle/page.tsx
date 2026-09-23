'use client';

import SiteNav from '../components/SiteNav';
import SiteFooter from '../components/SiteFooter';
import { useState, useEffect } from 'react';
import Image from 'next/image';

type RaffleEntrant = {
  wallet: string;
  tickets: number;
  firstPrizeOdds: number;
  anyPrizeOdds: number;
};

const RAFFLE_PRIZE_COUNT = 7;

// Exact wallet inclusion odds for sequential ticket draws. Wallets with the
// same ticket count are symmetric; grouping them keeps the calculation small
// while preserving the one-wallet-one-prize removal rule.
function calculateAnyPrizeOdds(ticketCounts: number[], prizeCount: number) {
  const groupedCounts = new Map<number, number>();

  ticketCounts.forEach((tickets) => {
    groupedCounts.set(tickets, (groupedCounts.get(tickets) || 0) + 1);
  });

  const classes = [...groupedCounts.entries()]
    .map(([tickets, wallets]) => ({ tickets, wallets }))
    .sort((a, b) => a.tickets - b.tickets);

  type OddsState = { selected: number[]; probability: number };
  let states = new Map<string, OddsState>();
  const initialSelected = classes.map(() => 0);
  states.set(initialSelected.join(','), { selected: initialSelected, probability: 1 });

  const draws = Math.min(prizeCount, ticketCounts.length);

  for (let draw = 0; draw < draws; draw += 1) {
    const nextStates = new Map<string, OddsState>();

    states.forEach(({ selected, probability }) => {
      const remainingTicketWeight = classes.reduce(
        (sum, ticketClass, index) =>
          sum + (ticketClass.wallets - selected[index]) * ticketClass.tickets,
        0
      );

      classes.forEach((ticketClass, index) => {
        const remainingWallets = ticketClass.wallets - selected[index];
        if (remainingWallets <= 0 || remainingTicketWeight <= 0) return;

        const nextSelected = [...selected];
        nextSelected[index] += 1;
        const key = nextSelected.join(',');
        const transitionProbability =
          (remainingWallets * ticketClass.tickets) / remainingTicketWeight;
        const nextProbability = probability * transitionProbability;
        const existing = nextStates.get(key);

        nextStates.set(key, {
          selected: nextSelected,
          probability: (existing?.probability || 0) + nextProbability,
        });
      });
    });

    states = nextStates;
  }

  const oddsByTicketCount = new Map<number, number>();

  classes.forEach((ticketClass, index) => {
    let expectedWinningWallets = 0;
    states.forEach(({ selected, probability }) => {
      expectedWinningWallets += selected[index] * probability;
    });

    oddsByTicketCount.set(
      ticketClass.tickets,
      (expectedWinningWallets / ticketClass.wallets) * 100
    );
  });

  return oddsByTicketCount;
}

export default function RaffleTracker() {
  const [totalTickets, setTotalTickets] = useState<number | null>(null);
  const [entrants, setEntrants] = useState<RaffleEntrant[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [raffleError, setRaffleError] = useState('');
  const [lastSnapshot] = useState("September 23, 2026 00:59 UTC");

  // Exact timestamp of the 30th eligible mint. Updated by the raffle snapshot generator once reached.
  const RAFFLE_30TH_MINT_TIMESTAMP: number | null = null; // milliseconds
  const RAFFLE_END_LABEL = "TBD — 7 days after the 30th eligible Exodus Key mint";

  useEffect(() => {
    const loadSnapshot = async () => {
      try {
        const res = await fetch('/raffle-snapshot.csv');
        if (!res.ok) throw new Error('Raffle snapshot unavailable');
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

        const anyPrizeOddsByTicketCount = calculateAnyPrizeOdds(
          Object.values(ownerMap),
          RAFFLE_PRIZE_COUNT
        );

        const sortedEntrants = Object.entries(ownerMap)
          .map(([wallet, tickets]) => ({
            wallet,
            tickets,
            firstPrizeOdds: total > 0 ? (tickets / total) * 100 : 0,
            anyPrizeOdds: anyPrizeOddsByTicketCount.get(tickets) || 0,
          }))
          .sort((a, b) => b.tickets - a.tickets);

        setTotalTickets(total);
        setEntrants(sortedEntrants);
      } catch (err) {
        console.error("Failed to load raffle snapshot:", err);
        setRaffleError('Raffle snapshot is temporarily unavailable. Please try again later.');
        setTotalTickets(null);
        setEntrants(null);
      } finally {
        setLoading(false);
      }
    };

    loadSnapshot();
  }, []);

  // Live countdown
  const [countdown, setCountdown] = useState("Calculating...");

  useEffect(() => {
    const updateCountdown = () => {
      const now = Date.now();
      const thirtiethMintTimestamp = RAFFLE_30TH_MINT_TIMESTAMP;
      if (!thirtiethMintTimestamp) {
        setCountdown("Countdown begins after the 30th eligible mint");
        return;
      }

      const endTime = thirtiethMintTimestamp + 7 * 24 * 60 * 60 * 1000;

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
      <SiteNav active="raffle" />

      <div className="max-w-5xl mx-auto px-4 md:px-6 py-12 flex-1">
        <h1 className="text-4xl md:text-5xl font-bold text-center mb-12">Grid Phantoms Raffle Tracker</h1>
        {/* Prize cards */}
        <div className="mb-12">
          <h2 className="text-3xl font-bold text-center mb-8">Up for Raffle</h2>
          
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 max-w-5xl mx-auto">
            {/* First Prize */}
            <div className="text-center bg-zinc-950 border border-zinc-900 rounded-3xl p-6">
              <Image 
                src="/images/first-prize-3984.jpg" 
                alt="Neo Tokyo Citizen #3984" 
                width={798} 
                height={800} 
                className="w-full max-w-[280px] mx-auto h-auto rounded-3xl shadow-2xl"
                priority
              />
              <p className="mt-6 font-semibold text-lg">First Prize</p>
              <p className="text-xl">Neo Tokyo Citizen #3984</p>
              <a 
                href="https://opensea.io/item/ethereum/0xb9951b43802dcf3ef5b14567cb17adf367ed1c0f/3984" 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-cyan-400 hover:text-cyan-300 text-lg mt-2 inline-block"
              >
                View on OpenSea →
              </a>
            </div>

            {/* Second Prize */}
            <div className="text-center bg-zinc-950 border border-zinc-900 rounded-3xl p-6">
              <Image 
                src="/images/second-prize-3220.jpg" 
                alt="Neo Tokyo Outer Citizen #3220" 
                width={1040} 
                height={1036} 
                className="w-full max-w-[280px] mx-auto h-auto rounded-3xl shadow-2xl"
                priority
              />
              <p className="mt-6 font-semibold text-lg">Second Prize</p>
              <p className="text-xl">Neo Tokyo Outer Citizen #3220</p>
              <a 
                href="https://opensea.io/item/ethereum/0x4481507cc228fa19d203bd42110d679571f7912e/3220" 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-cyan-400 hover:text-cyan-300 text-lg mt-2 inline-block"
              >
                View on OpenSea →
              </a>
            </div>

            {/* Prizes 3–7 */}
            <div className="text-center bg-zinc-950 border border-zinc-900 rounded-3xl p-6">
              <Image
                src="/images/third-prize-credits.jpg"
                alt="Five Jack Butcher CREDITS held by the Grid Phantoms Vault"
                width={1206}
                height={804}
                className="w-full max-w-[280px] mx-auto h-auto rounded-3xl shadow-2xl"
                priority
              />
              <p className="mt-6 font-semibold text-lg">Prizes 3–7</p>
              <p className="text-xl">Jack Butcher CREDITS ×5</p>
              <a
                href="https://opensea.io/0x6a1bc919e847c12725904965e05971b818b47ad0"
                target="_blank"
                rel="noopener noreferrer"
                className="text-cyan-400 hover:text-cyan-300 text-lg mt-2 inline-block"
              >
                View Vault on OpenSea →
              </a>
            </div>
          </div>
        </div>

        {/* Status */}
        <div className="bg-zinc-950 border border-zinc-900 rounded-3xl p-6 md:p-8 mb-10">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-semibold">Raffle Status</h2>
            <span className="text-sm bg-zinc-900 px-4 py-1 rounded-full">{raffleError ? 'Unavailable' : loading ? 'Loading' : 'Live'}</span>
          </div>

          {loading ? (
            <p className="py-10 text-center text-zinc-500" aria-live="polite">Loading raffle snapshot…</p>
          ) : raffleError ? (
            <p className="py-10 text-center text-red-400" role="alert">{raffleError}</p>
          ) : totalTickets !== null ? (<>
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
              <p className="text-3xl md:text-5xl font-mono font-bold text-white tracking-normal break-words">
                {countdown}
              </p>
              <p className="text-sm text-zinc-500 mt-3">
                ({RAFFLE_END_LABEL})
              </p>
            </div>
          )}
          </>) : null}
        </div>

        <div className="bg-zinc-950 border border-zinc-900 rounded-3xl p-6 md:p-8 mb-10 text-center">
          <h2 className="text-2xl font-semibold mb-6">Haven&apos;t entered?</h2>
          <p className="text-lg text-white">1 Exodus Key mint = 1 ticket</p>
          <a
            href="https://manifold.xyz/@gridphantoms/id/4067746032"
            target="_blank"
            rel="noopener noreferrer"
            className="text-cyan-400 hover:text-cyan-300 text-lg mt-4 inline-block"
          >
            Mint Exodus Key →
          </a>
          <div>
            <a
              href="https://discord.com/channels/1396395056587477012/1444817291286937735"
              target="_blank"
              rel="noopener noreferrer"
              className="text-cyan-400 hover:text-cyan-300 text-lg mt-2 inline-block"
            >
              More details in Discord →
            </a>
          </div>
        </div>

        {/* Entrant Ledger */}
        <div className="bg-zinc-950 border border-zinc-900 rounded-3xl p-6 md:p-8">
          <h2 className="text-2xl font-semibold mb-1">Entrant Ledger</h2>
          <p className="text-sm text-zinc-500 mb-5">Snapshot: {lastSnapshot}</p>

          <div className="border border-zinc-800 rounded-2xl p-4 mb-6 text-sm">
            <p className="font-semibold text-white mb-1">Live wallet odds · 7 unique winners</p>
            <p className="text-zinc-400">
              “1st prize” is the wallet&apos;s chance in the first drawing. “Any prize” is its chance of winning once across all seven drawings. One wallet can win only one prize; after winning, all of its remaining tickets are removed.
            </p>
            <p className="text-xs text-zinc-500 mt-2">
              Odds reflect the current snapshot and update as new tickets enter. Final odds are not locked until the raffle closes.
            </p>
          </div>
          
          <div className="space-y-4">
            {loading ? (
              <p className="text-zinc-500 text-center py-12" aria-live="polite">Loading entrant ledger…</p>
            ) : raffleError ? (
              <p className="text-red-400 text-center py-12" role="alert">Entrant ledger unavailable.</p>
            ) : entrants && entrants.length === 0 ? (
              <p className="text-zinc-500 text-center py-12">No entrants yet — be the first to mint!</p>
            ) : entrants ? (
              entrants.map((entrant, i) => (
                <div key={i} className="bg-black/50 border border-zinc-800 rounded-2xl p-5 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                  <div className="font-mono text-sm text-zinc-400 break-all">
                    {entrant.wallet}
                  </div>
                  <div className="w-full md:w-auto md:min-w-[290px]">
                    <p className="text-3xl font-bold text-white">
                      {entrant.tickets} {entrant.tickets === 1 ? 'ticket' : 'tickets'}
                    </p>
                    <div className="grid grid-cols-2 gap-2 mt-3">
                      <div className="border border-zinc-800 rounded-xl px-3 py-2">
                        <p className="text-[10px] uppercase tracking-wider text-zinc-500">1st prize</p>
                        <p className="text-lg font-semibold text-white">{entrant.firstPrizeOdds.toFixed(2)}%</p>
                      </div>
                      <div className="border border-cyan-950 rounded-xl px-3 py-2">
                        <p className="text-[10px] uppercase tracking-wider text-zinc-500">Any prize</p>
                        <p className="text-lg font-semibold text-cyan-400">{entrant.anyPrizeOdds.toFixed(2)}%</p>
                      </div>
                    </div>
                  </div>
                </div>
              ))
            ) : null}
          </div>
        </div>
      </div>

      <SiteFooter />
    </div>
  );
}