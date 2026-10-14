import type { Metadata } from 'next';
import Link from 'next/link';
import CreditsHeader from '../CreditsHeader';
import WalletLab from './WalletLab';

export const metadata: Metadata = {
  title: 'CREDITS Wallet Appraiser | Private Prototype',
  description: 'Private review prototype for read-only CREDITS wallet appraisal.',
  referrer: 'no-referrer',
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
            <p className="cr-kicker">Private review build · loose CREDITS</p>
            <h1>Wallet Appraiser</h1>
            <p>Look up a public wallet, total its official Credit Rating and compare it with a live band of verified asks. No connection required.</p>
          </div>
          <aside>
            <span>Prototype scope</span>
            <strong>Read-only</strong>
            <small>Wallet or ENS lookup<br />No signing · No storage</small>
          </aside>
        </section>
        <WalletLab />
      </main>
      <footer className="cr-footer">Private prototype. Ask-based research only—not a bid, offer or guaranteed sale value.</footer>
    </>
  );
}
