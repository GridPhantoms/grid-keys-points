import type { Metadata } from 'next';
import SiteFooter from '../components/SiteFooter';
import SiteNav from '../components/SiteNav';
import CitizenSubnav from './CitizenSubnav';
import CitizenTerminal from './CitizenTerminal';
import './citizen.css';

export const metadata: Metadata = {
  title: 'Citizen Interlink | Neo Tokyo Market Intelligence',
  description: 'Citizen lookup, staking scenarios, component floors and Elite S1 listings for Neo Tokyo.',
};

export default function CitizenTerminalPage() {
  return <div className="ct-page"><div className="ct-topline" aria-hidden="true" /><SiteNav active="citizen" /><CitizenSubnav active="overview" /><CitizenTerminal /><SiteFooter /></div>;
}
