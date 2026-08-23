import type { Metadata } from 'next';
import GridHome from '../../components/GridHome';
import './home-beta.css';

export const metadata: Metadata = {
  title: 'Grid Phantoms Homepage Beta Mirror',
  description: 'Unlisted mirror of the current Grid Phantoms homepage.',
  robots: { index: false, follow: false, nocache: true },
};

export default function GridHomeBeta() {
  return <GridHome beta />;
}
