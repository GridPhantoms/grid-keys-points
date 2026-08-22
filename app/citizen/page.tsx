import type { Metadata } from 'next';
import SiteNav from '../components/SiteNav';
import CitizenTerminal from './CitizenTerminal';
import './citizen.css';

export const metadata: Metadata = {
  title: 'Citizen Terminal | Neo Tokyo Market Intelligence',
  description: 'Citizen lookup, staking scenarios, component floors and Elite S1 listings for Neo Tokyo.',
};

export default function CitizenTerminalPage() {
  return <div className="ct-page"><div className="ct-topline" aria-hidden="true" /><SiteNav active="citizen" /><CitizenTerminal /><footer className="ct-footer"><p>Citizen Terminal · Neo Tokyo Market Intelligence</p><span>Independent market reference tooling by Grid Phantoms. Not financial advice.</span></footer></div>;
}
