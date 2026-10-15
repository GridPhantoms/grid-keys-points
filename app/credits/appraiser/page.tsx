import type { Metadata } from 'next';
import Link from 'next/link';
import CreditsHeader from '../CreditsHeader';
import WalletAppraiser from './WalletAppraiser';

export const metadata: Metadata = {
  title: 'CREDITS Wallet Appraiser | Read-Only',
  description: 'Look up an Ethereum wallet or ENS name to see its loose CREDITS, Statements, total Credit Rating and listing-based replacement range.',
  alternates: { canonical: '/credits/appraiser' },
  referrer: 'no-referrer',
  openGraph: {
    type: 'website',
    url: '/credits/appraiser',
    title: 'CREDITS Wallet Appraiser | Read-Only',
    description: 'Appraise loose CREDITS and Statements with separate listing-based Credit Rating benchmarks. No wallet connection or signing.',
    images: [{
      url: '/credits/appraiser/opengraph-image',
      width: 1200,
      height: 630,
      alt: 'CREDITS Wallet Appraiser: loose CREDITS and Statements, read-only',
    }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'CREDITS Wallet Appraiser | Read-Only',
    description: 'Appraise loose CREDITS and Statements with separate listing-based Credit Rating benchmarks. No wallet connection or signing.',
    images: ['/credits/appraiser/opengraph-image'],
  },
};

export default function CreditsAppraiserPage() {
  return (
    <>
      <CreditsHeader active="appraiser" />
      <div className="cr-creditline"><Link href="/">Market intelligence provided by GridPhantoms <span aria-hidden="true">↗</span></Link></div>
      <main className="cr-main cr-wallet-main">
        <section className="cr-wallet-hero">
          <div>
            <p className="cr-kicker">Read-only collector tool · CREDITS + Statements</p>
            <h1>Wallet Appraiser</h1>
            <p>Enter an Ethereum address or ENS name to see the wallet’s loose CREDITS and Statements, total Credit Rating, and estimated replacement range based on current listings.</p>
          </div>
          <aside>
            <span>Tool scope</span>
            <strong>Read-only</strong>
            <small>Wallet or ENS lookup<br />No signing · No storage</small>
          </aside>
        </section>
        <WalletAppraiser />
      </main>
      <footer className="cr-footer">Listing-based replacement research—not a bid, offer, expected sale price or guaranteed value.</footer>
    </>
  );
}
