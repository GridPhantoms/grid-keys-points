import type { Metadata } from 'next';
import Link from 'next/link';
import overview from '@/data/credits-overview.json';
import CreditsHeader from './CreditsHeader';

export const metadata: Metadata = {
  title: 'CREDITS Intelligence | Market Overview',
  description: 'A streamlined view of CREDITS supply, Statements and collector value signals.',
  alternates: { canonical: '/credits' },
};

const integer = new Intl.NumberFormat('en-US');
const percent = new Intl.NumberFormat('en-US', { maximumFractionDigits: 1 });
const eth = new Intl.NumberFormat('en-US', { minimumFractionDigits: 3, maximumFractionDigits: 3 });

export default function CreditsOverviewPage() {
  const statementDiscount = (1 - overview.buildVsBuy.statementFloorEth / overview.buildVsBuy.looseBasketEth) * 100;
  return (
    <>
      <CreditsHeader active="overview" />
      <main className="cr-main">
        <section className="cr-hero">
          <div>
            <p className="cr-kicker">Collector market view</p>
            <h1>See what CREDITS are worth.</h1>
            <p className="cr-lede">Compare loose CREDITS and assembled Statements with current listings, Credit Rating and cost per 1,000 CR.</p>
            <Link href="/credits/value" className="cr-primary">Open Value Finder <span aria-hidden="true">→</span></Link>
          </div>
          <aside className="cr-status" aria-label="Snapshot status">
            <span><i /> Verified snapshot</span>
            <strong>{new Date(overview.snapshotAsOf).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'UTC' })} UTC</strong>
            <small>Live listings are checked in Value Finder.</small>
          </aside>
        </section>

        <section className="cr-section" aria-labelledby="market-pulse">
          <div className="cr-section-head"><div><p className="cr-kicker">Market pulse</p><h2 id="market-pulse">The latest verified baseline</h2></div><span>{overview.sourceLabel}</span></div>
          <div className="cr-stat-grid">
            <article><span>Loose floor</span><strong>{overview.market.looseFloorEth} ETH</strong><small>Verified snapshot reference</small></article>
            <article><span>Loose listings</span><strong>{integer.format(overview.market.looseListings)}</strong><small>{integer.format(overview.market.within25PctOfFloor)} within 25% of floor</small></article>
            <article><span>Rating coverage</span><strong>{percent.format(overview.market.officialRatingCoveragePct)}%</strong><small>Listed tokens with official CR</small></article>
          </div>
        </section>

        <div className="cr-split">
          <section className="cr-panel" aria-labelledby="supply-title">
            <p className="cr-kicker">Supply transformation</p>
            <h2 id="supply-title">Loose CREDITS become Statements</h2>
            <div className="cr-supply-bar" aria-label={`${percent.format(overview.supply.burnedPct)} percent of original supply is in active Statements`}><i style={{ width: `${overview.supply.burnedPct}%` }} /></div>
            <dl className="cr-detail-list">
              <div><dt>Original supply</dt><dd>{integer.format(overview.supply.original)}</dd></div>
              <div><dt>Loose today</dt><dd>{integer.format(overview.supply.loose)}</dd></div>
              <div><dt>In Statements</dt><dd>{integer.format(overview.supply.burnedIntoStatements)} <small>({percent.format(overview.supply.burnedPct)}%)</small></dd></div>
            </dl>
          </section>

          <section className="cr-panel" aria-labelledby="statements-title">
            <p className="cr-kicker">Statement snapshot</p>
            <h2 id="statements-title">Concentrated Credit Rating</h2>
            <dl className="cr-detail-list">
              <div><dt>Active Statements</dt><dd>{integer.format(overview.statements.active)}</dd></div>
              <div><dt>Listed</dt><dd>{integer.format(overview.statements.listed)}</dd></div>
              <div><dt>Base / Layered / Inverted</dt><dd>{overview.statements.stageCounts.BASE} / {overview.statements.stageCounts.LAYERED} / {overview.statements.stageCounts.INVERTED}</dd></div>
            </dl>
          </section>
        </div>

        <section className="cr-section cr-build" aria-labelledby="build-title">
          <div><p className="cr-kicker">Build vs. buy</p><h2 id="build-title">An assembled Statement was slightly cheaper.</h2><p>At the verified snapshot, buying the lowest Statement cost {eth.format(overview.buildVsBuy.statementFloorEth)} ETH. Building one from the cheapest 80 loose CREDITS cost {eth.format(overview.buildVsBuy.looseBasketEth)} ETH.</p></div>
          <strong>{percent.format(statementDiscount)}% less</strong>
        </section>

        <section className="cr-section" aria-labelledby="preview-title">
          <div className="cr-section-head"><div><p className="cr-kicker">Value preview</p><h2 id="preview-title">Start with the comparable unit</h2></div><Link href="/credits/value">See current values →</Link></div>
          <div className="cr-preview-grid">
            <article><span>Loose CREDITS</span><strong>ETH per 1K CR</strong><p>Filter by minimum rating and maximum ask.</p></article>
            <article><span>Statements</span><strong>Top 10 values</strong><p>Compare format, layers, rating and live ask.</p></article>
          </div>
        </section>
      </main>
      <footer className="cr-footer">Read-only research. No wallet connection or purchase execution.</footer>
    </>
  );
}
