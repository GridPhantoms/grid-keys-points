import type { Metadata } from 'next';
import Link from 'next/link';
import CreditsHeader from '../CreditsHeader';
import WalletLab from './WalletLab';

export const metadata: Metadata = {
  title: 'CREDITS Wallet Appraiser | Read-Only',
  description: 'Look up any Ethereum wallet or ENS and estimate loose CREDITS and Statements using separate ask-based Credit Rating benchmarks.',
  referrer: 'no-referrer',
  openGraph: {
    type: 'website',
    url: '/credits/wallet-lab-41eff0a315b4',
    title: 'CREDITS Wallet Appraiser | Read-Only',
    description: 'Appraise loose CREDITS and Statements with separate ask-based Credit Rating benchmarks. No wallet connection or signing.',
    images: [{
      url: '/credits/wallet-lab-41eff0a315b4/opengraph-image',
      width: 1200,
      height: 630,
      alt: 'CREDITS Wallet Appraiser: loose CREDITS and Statements, read-only',
    }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'CREDITS Wallet Appraiser | Read-Only',
    description: 'Appraise loose CREDITS and Statements with separate ask-based Credit Rating benchmarks. No wallet connection or signing.',
    images: ['/credits/wallet-lab-41eff0a315b4/opengraph-image'],
  },
  robots: {
    index: false,
    follow: false,
    nocache: true,
    noarchive: true,
    noimageindex: true,
  },
};

export default function CreditsWalletLabPage() {
  return (
    <>
      <CreditsHeader />
      <div className="cr-creditline"><Link href="/credits/value">Private prototype · return to Value Finder <span aria-hidden="true">↗</span></Link></div>
      <main className="cr-main cr-wallet-main">
        <section className="cr-wallet-hero">
          <div>
            <p className="cr-kicker">Private review build · CREDITS + Statements</p>
            <h1>Wallet Appraiser</h1>
            <p>Look up a public wallet, total its official Credit Rating across loose CREDITS and Statements, then compare each collection with its own live band of verified asks.</p>
          </div>
          <aside>
            <span>Prototype scope</span>
            <strong>Read-only</strong>
            <small>Wallet or ENS lookup<br />No signing · No storage</small>
          </aside>
        </section>
        <WalletLab />
      </main>
      <footer className="cr-footer">Private prototype. Separate CREDITS and Statement ask-based research—not a bid, offer or guaranteed sale value.</footer>
    </>
  );
}
