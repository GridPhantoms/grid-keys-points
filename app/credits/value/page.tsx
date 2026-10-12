import type { Metadata } from 'next';
import CreditsHeader from '../CreditsHeader';
import ValueFinder from './ValueFinder';

export const metadata: Metadata = {
  title: 'CREDITS Value Finder | Live Listings',
  description: 'Find current CREDITS and Statement listings by Credit Rating, price and ETH per 1,000 CR.',
  alternates: { canonical: '/credits/value' },
};

export default function CreditsValuePage() {
  return (
    <>
      <CreditsHeader active="value" />
      <main className="cr-main cr-value-main">
        <section className="cr-value-hero">
          <p className="cr-kicker">Live collector tool</p>
          <h1>Value Finder</h1>
          <p>Compare active listings on the same basis. Opening a result takes you directly to OpenSea.</p>
        </section>
        <ValueFinder />
      </main>
      <footer className="cr-footer">Read-only research. Verify every listing on OpenSea before purchase.</footer>
    </>
  );
}
