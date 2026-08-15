import SiteNav from '../components/SiteNav';
import Image from 'next/image';

export default function TraitCharts() {
  return (
    <div className="min-h-screen bg-black text-white flex flex-col">
      <SiteNav active="trait-charts" />

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