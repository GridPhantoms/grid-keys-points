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
    </div>
  );
}
