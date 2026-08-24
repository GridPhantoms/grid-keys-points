import SiteNav from '../components/SiteNav';
import SiteFooter from '../components/SiteFooter';
import Image from 'next/image';
import { TRAIT_POINT_GROUPS, type KeySeason } from '@/lib/key-trait-points';

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

function Chart({
  season,
  src,
}: {
  season: KeySeason;
  src: string;
}) {
  return (
    <section aria-labelledby={`${season.toLowerCase()}-chart-title`}>
      <h2 id={`${season.toLowerCase()}-chart-title`} className="text-2xl font-semibold mb-4 text-center">{season} Keys</h2>
      <div className="bg-zinc-950 border border-zinc-900 rounded-3xl p-4">
        <a href={src} target="_blank" rel="noopener noreferrer">
          <Image
            src={src}
            alt={`${season} Keys trait point chart. A complete text table follows.`}
            width={1200}
            height={800}
            className="w-full h-auto rounded-2xl"
            priority
          />
        </a>
      </div>
      <p className="mt-3 text-center text-sm">
        <a href={src} target="_blank" rel="noopener noreferrer" className="text-cyan-400 hover:text-cyan-300 underline">
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

      <main className="max-w-7xl mx-auto px-4 md:px-6 py-12 flex-1">
        <h1 className="text-4xl md:text-5xl font-bold tracking-[-2px] mb-4 text-center">Trait Charts</h1>
        <p className="mx-auto mb-10 max-w-2xl text-center text-zinc-500">
          Visual charts and equivalent searchable point tables for every Genesis and Exodus trait.
        </p>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
          <Chart season="Genesis" src="/charts/genesis-trait-charts.png" />
          <Chart season="Exodus" src="/charts/exodus-trait-charts.png" />
        </div>
      </main>

      <SiteFooter />
    </div>
  );
}
