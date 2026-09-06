import Image from 'next/image';
import Link from 'next/link';
import SiteNav from '../components/SiteNav';
import SiteFooter from '../components/SiteFooter';
import { GRID_CLEARANCE_LEVELS } from '@/lib/grid-clearance';
import { TRAIT_POINT_GROUPS, type KeySeason } from '@/lib/key-trait-points';

const CATEGORY_INTELLIGENCE: Record<string, string> = {
  'Grid Dominion': 'Offensive pressure and territorial control protocols for coordinated action inside the Grid.',
  'Cloaking Power': 'Concealment, counter-surveillance and identity masking for movement through monitored sectors.',
  'Code Stratagem': 'Intrusion planning, credential reconstruction and exploitation of Syndicate systems.',
  'Veil Assault': 'Breach and sabotage doctrine for breaking fortified digital and physical barriers.',
  'Pulse Fortitude': 'Endurance, resilience and command stability under hostile network pressure.',
  'Aerial Domain': 'Vertical access, elevated reconnaissance and routes that bypass street-level controls.',
  'Grid Speed': 'Rapid insertion, evasion and extraction before a compromised route can close.',
  'Exodus Sovereignty': 'Independent command protocols recovered from the uprising against Syndicate control.',
  'Veiled Power': 'Concealed force projection for operations that must remain invisible until impact.',
  'Phantom Weapon': 'Encoded armament systems ranging from quiet field tools to high-energy breach weapons.',
  'Reward Modulation': 'Season-specific signal weight built into every Key and included in its total Trait Points.',
};

function formatPointRange(minimum: number, maximum: number | null) {
  if (maximum === null) return `${minimum.toLocaleString()}+`;
  if (minimum === 0) return '1,000–4,999';
  return `${minimum.toLocaleString()}–${maximum.toLocaleString()}`;
}

function TraitPointTable({ season }: { season: KeySeason }) {
  const groups = TRAIT_POINT_GROUPS.filter((group) => group.season === season);

  return (
    <details className="mt-5 rounded-2xl border border-zinc-800 bg-zinc-950 p-4">
      <summary className="cursor-pointer font-medium text-cyan-400">View accessible {season} point table</summary>
      <div className="mt-4 overflow-x-auto">
        <table className="w-full min-w-[420px] border-collapse text-left text-sm">
          <caption className="sr-only">{season} Key trait point values</caption>
          <thead>
            <tr className="border-b border-zinc-700 text-zinc-400">
              <th className="px-3 py-2">Trait category</th>
              <th className="px-3 py-2">Trait</th>
              <th className="px-3 py-2 text-right">Point value</th>
            </tr>
          </thead>
          <tbody>
            {groups.flatMap((group) =>
              group.traits.map(([trait, points], index) => (
                <tr key={`${group.category}-${trait}`} className="border-b border-zinc-900">
                  <th scope="row" className="px-3 py-2 font-medium text-zinc-300">
                    {index === 0 ? group.category : <span className="sr-only">{group.category}</span>}
                  </th>
                  <td className="px-3 py-2 text-zinc-400">{trait}</td>
                  <td className="px-3 py-2 text-right font-mono text-cyan-400">{points.toLocaleString()}</td>
                </tr>
              )),
            )}
          </tbody>
        </table>
      </div>
    </details>
  );
}

function CategoryArchive({ season }: { season: KeySeason }) {
  const groups = TRAIT_POINT_GROUPS.filter((group) => group.season === season);

  return (
    <section aria-labelledby={`${season.toLowerCase()}-protocols`}>
      <div className="mb-5 flex items-end justify-between gap-4 border-b border-zinc-800 pb-4">
        <div>
          <p className="font-mono text-[10px] tracking-[.18em] text-cyan-400">{season.toUpperCase()} PROTOCOL SET</p>
          <h2 id={`${season.toLowerCase()}-protocols`} className="mt-2 text-2xl font-semibold">{season} operational roles</h2>
        </div>
        <span className="font-mono text-xs text-zinc-600">{groups.length} CATEGORIES</span>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {groups.map((group) => {
          const firstTrait = group.traits[0]?.[0];
          const lastTrait = group.traits.at(-1)?.[0];
          return (
            <article key={`${season}-${group.category}`} className="border border-zinc-800 bg-zinc-950/80 p-5">
              <p className="font-mono text-[9px] tracking-[.16em] text-zinc-600">TACTICAL CATEGORY</p>
              <h3 className="mt-2 text-lg font-semibold text-zinc-100">{group.category}</h3>
              <p className="mt-3 text-sm leading-6 text-zinc-400">{CATEGORY_INTELLIGENCE[group.category]}</p>
              <p className="mt-4 border-t border-zinc-900 pt-3 font-mono text-[9px] leading-5 text-cyan-500/80">
                {firstTrait}{firstTrait !== lastTrait ? ` → ${lastTrait}` : ''}
              </p>
            </article>
          );
        })}
      </div>
    </section>
  );
}

function Chart({ season, src }: { season: KeySeason; src: string }) {
  return (
    <section aria-labelledby={`${season.toLowerCase()}-chart-title`}>
      <h2 id={`${season.toLowerCase()}-chart-title`} className="mb-4 text-center text-2xl font-semibold">{season} Keys</h2>
      <div className="rounded-3xl border border-zinc-900 bg-zinc-950 p-4">
        <a href={src} target="_blank" rel="noopener noreferrer">
          <Image
            src={src}
            alt={`${season} Keys trait point chart. A complete text table follows.`}
            width={1200}
            height={800}
            className="h-auto w-full rounded-2xl"
            priority
          />
        </a>
      </div>
      <p className="mt-3 text-center text-sm">
        <a href={src} target="_blank" rel="noopener noreferrer" className="text-cyan-400 underline hover:text-cyan-300">
          Open full-resolution {season} chart ↗
        </a>
      </p>
      <TraitPointTable season={season} />
    </section>
  );
}

export default function TraitCharts() {
  return (
    <div className="min-h-screen bg-black text-white flex flex-col">
      <SiteNav active="trait-charts" />

      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-12 md:px-6 md:py-20">
        <header className="relative overflow-hidden border border-cyan-950 bg-[radial-gradient(circle_at_80%_10%,rgba(34,211,238,.13),transparent_30%),linear-gradient(145deg,#080d10,#030506)] px-6 py-12 md:px-12 md:py-16">
          <div className="absolute inset-0 opacity-20 [background-image:linear-gradient(rgba(34,211,238,.08)_1px,transparent_1px),linear-gradient(90deg,rgba(34,211,238,.08)_1px,transparent_1px)] [background-size:32px_32px]" aria-hidden="true" />
          <div className="relative max-w-4xl">
            <p className="font-mono text-[10px] font-bold tracking-[.24em] text-emerald-300">SAKURA INTELLIGENCE FILE // DECLASSIFIED</p>
            <h1 className="mt-5 text-4xl font-bold tracking-[-2px] sm:text-5xl md:text-7xl">Trait Intelligence Archive</h1>
            <p className="mt-6 max-w-3xl text-base leading-8 text-zinc-300 md:text-lg">
              Every Key carries fragments of authorization code and tactical doctrine recovered from the Grid. Trait Points measure the strength of those fragments. Combined wallet points determine the active Grid Clearance Sakura can reconstruct.
            </p>
            <p className="mt-6 font-mono text-sm font-semibold tracking-[.08em] text-cyan-300">Points determine Clearance. Participation activates it.</p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/#keyholder-console" className="border border-cyan-300 bg-cyan-300 px-5 py-3 font-mono text-[10px] font-bold tracking-[.13em] text-black hover:bg-cyan-200">LOAD YOUR KEYS →</Link>
              <Link href="#trait-charts" className="border border-zinc-700 px-5 py-3 font-mono text-[10px] font-bold tracking-[.13em] text-zinc-300 hover:border-cyan-700 hover:text-cyan-300">VIEW POINT CHARTS ↓</Link>
            </div>
          </div>
        </header>

        <section className="mt-12 grid gap-4 md:grid-cols-3" aria-label="Grid Clearance mechanics">
          {[
            ['01', 'Keys contain fragments', 'Each Genesis and Exodus Key contains a fixed metadata-derived tactical loadout. Rare protocols carry greater point strength.'],
            ['02', 'Wallets compile Clearance', 'Points follow current Key ownership. Sakura combines every held Key into one wallet-level Grid Clearance credential.'],
            ['03', 'Participation activates utility', 'Clearance alone promises nothing. A qualifying action and an approved discretionary distribution are required before Hazard Support can apply.'],
          ].map(([step, title, copy]) => (
            <article key={step} className="border border-zinc-800 bg-zinc-950 p-6">
              <span className="font-mono text-[10px] text-cyan-500">{step}</span>
              <h2 className="mt-5 text-xl font-semibold">{title}</h2>
              <p className="mt-3 text-sm leading-6 text-zinc-400">{copy}</p>
            </article>
          ))}
        </section>

        <section className="mt-16" aria-labelledby="clearance-schedule">
          <div className="grid gap-5 border-b border-zinc-800 pb-7 md:grid-cols-[1fr_.65fr] md:items-end">
            <div>
              <p className="font-mono text-[10px] font-bold tracking-[.2em] text-emerald-300">ACTIVE PROTOCOL</p>
              <h2 id="clearance-schedule" className="mt-3 text-3xl font-bold tracking-tight md:text-5xl">Current Hazard Support Schedule</h2>
            </div>
            <p className="text-sm leading-6 text-zinc-500 md:text-right">Effective until superseded for a future Grid Cycle. A completed cycle is never changed retroactively or after its eligibility snapshot.</p>
          </div>

          <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            {GRID_CLEARANCE_LEVELS.map((clearance) => (
              <article key={clearance.level} className={`border p-5 ${clearance.level === 4 ? 'border-violet-500/50 bg-violet-950/20' : 'border-zinc-800 bg-zinc-950'}`}>
                <p className="font-mono text-[9px] tracking-[.16em] text-zinc-500">CLEARANCE</p>
                <strong className="mt-3 block text-3xl tracking-[-.04em]">LEVEL {clearance.level}</strong>
                <span className="mt-2 block min-h-10 text-xs font-semibold uppercase leading-5 tracking-[.08em] text-cyan-400">{clearance.name}</span>
                <dl className="mt-5 space-y-3 border-t border-zinc-800 pt-4 font-mono text-[10px]">
                  <div><dt className="text-zinc-600">TRAIT POINTS</dt><dd className="mt-1 text-zinc-300">{formatPointRange(clearance.minimumPoints, clearance.maximumPoints)}</dd></div>
                  <div><dt className="text-zinc-600">HAZARD SUPPORT</dt><dd className="mt-1 text-emerald-300">+{clearance.hazardSupport} BYTES</dd></div>
                </dl>
              </article>
            ))}
          </div>

          <div className="mt-3 border border-dashed border-violet-500/40 bg-[linear-gradient(90deg,rgba(76,29,149,.12),transparent)] px-5 py-4 font-mono text-sm text-violet-300">
            LEVEL 5 // CLASSIFIED <span className="ml-2 text-[10px] text-zinc-600">THRESHOLD UNDISCLOSED · INACTIVE</span>
          </div>
          <p className="mt-5 max-w-4xl text-xs leading-6 text-zinc-500">Hazard Support is a fixed amount applied once per eligible wallet under the schedule used for that cycle. It is not multiplied by Key count, does not increase voting power or raffle odds, and remains part of a discretionary potential Phantom Reward distribution. No future distribution or amount is guaranteed.</p>
        </section>

        <section className="mt-20" aria-labelledby="protocol-archive">
          <div className="mb-8 max-w-3xl">
            <p className="font-mono text-[10px] font-bold tracking-[.2em] text-emerald-300">TACTICAL TAXONOMY</p>
            <h2 id="protocol-archive" className="mt-3 text-3xl font-bold tracking-tight md:text-5xl">What the fragments encode</h2>
            <p className="mt-5 text-sm leading-7 text-zinc-400">Trait names are not decoration. They describe the doctrines stored inside each Key—from Whispering Strike and Deep Camouflage to Masterful Hack, Ghost Overdrive, Shadow Insurrection and Quantum Raygun.</p>
          </div>
          <div className="grid gap-12 lg:grid-cols-2">
            <CategoryArchive season="Genesis" />
            <CategoryArchive season="Exodus" />
          </div>
        </section>

        <section id="trait-charts" className="mt-20 scroll-mt-24" aria-labelledby="point-index">
          <div className="mb-10 max-w-3xl">
            <p className="font-mono text-[10px] font-bold tracking-[.2em] text-emerald-300">POINT INDEX</p>
            <h2 id="point-index" className="mt-3 text-3xl font-bold tracking-tight md:text-5xl">Canonical trait charts</h2>
            <p className="mt-5 text-sm leading-7 text-zinc-400">Inspect the visual charts or open the searchable tables. Every Key score is the sum of five tactical categories plus its season-specific Reward Modulation.</p>
          </div>
          <div className="grid grid-cols-1 gap-12 lg:grid-cols-2">
            <Chart season="Genesis" src="/charts/genesis-trait-charts.png" />
            <Chart season="Exodus" src="/charts/exodus-trait-charts.png" />
          </div>
        </section>

        <section className="mt-20 border border-cyan-900/60 bg-cyan-950/10 p-7 text-center md:p-10">
          <p className="font-mono text-[10px] tracking-[.18em] text-cyan-500">WALLET-LEVEL RECONSTRUCTION</p>
          <h2 className="mt-4 text-2xl font-semibold md:text-3xl">Find your current position in the Grid</h2>
          <p className="mx-auto mt-4 max-w-2xl text-sm leading-7 text-zinc-400">Load a read-only wallet to see its current Key inventory, combined Trait Points, active Clearance, distance to the next level, and completed Lifetime Phantom Rewards.</p>
          <Link href="/#keyholder-console" className="mt-7 inline-block border border-cyan-300 bg-cyan-300 px-6 py-3 font-mono text-[10px] font-bold tracking-[.13em] text-black hover:bg-cyan-200">LOAD KEYS →</Link>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}
