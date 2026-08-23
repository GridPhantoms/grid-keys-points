import type { Metadata } from 'next';
import GridHome from './components/GridHome';
import './beta/grid-home-0823/home-beta.css';

export const metadata: Metadata = {
  title: 'Grid Phantoms | Keyholder Governance, Intelligence and Utility',
  description: 'Enter the Grid: Keyholder governance, treasury transparency, adopted $BYTES utility intelligence, Citizen market tools and read-only Key data.',
  alternates: { canonical: '/' },
  robots: { index: true, follow: true },
};

export default function HomePage() {
  return <GridHome />;
}
