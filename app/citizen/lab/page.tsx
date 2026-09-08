import type { Metadata } from 'next';
import SiteFooter from '../../components/SiteFooter';
import SiteNav from '../../components/SiteNav';
import CitizenSubnav from '../CitizenSubnav';
import CitizenTerminal from '../CitizenTerminal';
import '../citizen.css';

export const metadata: Metadata = {
  title: 'Citizen Lab | Citizen Interlink',
  description: 'Decode Neo Tokyo Citizens and model their staking positions in one connected workspace.',
  alternates: { canonical: '/citizen/lab' },
};

export default function CitizenLabPage() {
  return <div className="ct-page"><div className="ct-topline" aria-hidden="true" /><SiteNav active="citizen" /><CitizenSubnav active="lab" /><CitizenTerminal view="lab" /><SiteFooter /></div>;
}
