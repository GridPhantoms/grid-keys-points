import type { Metadata } from 'next';
import SiteFooter from '../components/SiteFooter';
import SiteNav from '../components/SiteNav';
import CitizenSubnav from './CitizenSubnav';
import CitizenOverview from './CitizenOverview';
import CitizenLegacyHashRedirect from './CitizenLegacyHashRedirect';
import './citizen.css';

export const metadata: Metadata = {
  title: 'Citizen Interlink | Neo Tokyo Market Intelligence',
  description: 'A connected suite of Citizen, wallet, ownership and market intelligence for Neo Tokyo.',
};

export default function CitizenTerminalPage() {
  return <div className="ct-page"><div className="ct-topline" aria-hidden="true" /><SiteNav active="citizen" /><CitizenSubnav active="overview" /><CitizenLegacyHashRedirect /><CitizenOverview /><SiteFooter /></div>;
}
