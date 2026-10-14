import type { Metadata } from 'next';
import Link from 'next/link';
import CreditsHeader from '../CreditsHeader';
import ValueFinder from './ValueFinder';

export const metadata: Metadata = {
  title: 'CREDITS Value Finder | Live Listings',
  description: 'Find current CREDITS and Statement listings by Credit Rating, price and ETH per 1,000 CR.',
  alternates: { canonical: '/credits/value' },
  openGraph: {
    type: 'website',
    url: '/credits/value',
    title: 'CREDITS Value Finder | Live Listings',
    description: 'A public collector tool for comparing CREDITS and Statements by rating, ask and ETH per 1K CR.',
    images: [{ url: '/credits/value/opengraph-image', width: 1200, height: 630, alt: 'CREDITS Intelligence Value Finder: compare Credit Rating value' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'CREDITS Value Finder | Live Listings',
    description: 'Compare CREDITS and Statements by rating, ask and ETH per 1K CR.',
    images: ['/credits/value/opengraph-image'],
  },
};

export default function CreditsValuePage() {
  return (
    <>
      <CreditsHeader active="value" />
      <div className="cr-creditline"><Link href="/">Market intelligence provided by GridPhantoms <span aria-hidden="true">↗</span></Link></div>
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
