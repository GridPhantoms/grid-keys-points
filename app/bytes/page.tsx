import type { Metadata } from 'next';
import SiteNav from '../components/SiteNav';
import BytesDashboard from './BytesDashboard';
import './bytes.css';

export const metadata: Metadata = {
  title: '$BYTES Terminal | Grid Phantoms',
  description: 'Observed BYTES emissions, transparent decay models, projected issuance scenarios, and source verification status.',
};

export default function BytesPage() {
  return (
    <div className="bytes-page">
      <div className="bytes-topline" aria-hidden="true" />
      <SiteNav active="bytes" />
      <BytesDashboard />
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
