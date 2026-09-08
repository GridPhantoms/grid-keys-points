import type { Metadata } from 'next';
import SiteFooter from '../../components/SiteFooter';
import SiteNav from '../../components/SiteNav';
import CitizenSubnav from '../CitizenSubnav';
import CitizenTerminal from '../CitizenTerminal';
import '../citizen.css';

export const metadata: Metadata = {
  title: 'Market Dashboard | Citizen Interlink',
  description: 'Neo Tokyo collection references, modeled ecosystem value and current Elite S1 listings.',
  alternates: { canonical: '/citizen/market' },
};

export default function CitizenMarketPage() {
  return <div className="ct-page"><div className="ct-topline" aria-hidden="true" /><SiteNav active="citizen" /><CitizenSubnav active="market" /><CitizenTerminal view="market" /><SiteFooter /></div>;
}
