import type { Metadata } from 'next';
import SiteFooter from '../../components/SiteFooter';
import SiteNav from '../../components/SiteNav';
import CitizenSubnav from '../CitizenSubnav';
import CitizenModuleHero from '../CitizenModuleHero';
import { CitizenHolderLeaderboard, CitizenHolderSummary } from '../CitizenHolderMap';
import '../citizen.css';

export const metadata: Metadata = {
  title: 'Holders & Provenance | Citizen Interlink',
  description: 'Neo Tokyo Citizen beneficial ownership, Original Upload provenance and holder leaderboard intelligence.',
  alternates: { canonical: '/citizen/holders' },
};

export default function CitizenHoldersPage() {
  return <div className="ct-page"><div className="ct-topline" aria-hidden="true" /><SiteNav active="citizen" /><CitizenSubnav active="holders" /><main className="ct-main">
    <CitizenModuleHero eyebrow="CITIZEN INTERLINK // INTELLIGENCE" title="Holders & Provenance" description="Beneficial ownership, Day 1 lineage and the largest current Citizen positions." badges={['Holder map', 'Original Upload', 'Leaderboard']} />
    <CitizenHolderSummary />
    <CitizenHolderLeaderboard />
  </main><SiteFooter /></div>;
}
