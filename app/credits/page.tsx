import type { Metadata } from 'next';
import Link from 'next/link';
import overview from '@/data/credits-overview.json';
import { compareBuildAndBuyValue } from '@/lib/credits-intelligence';
import { loadLiveCreditsOverview } from '@/lib/credits-overview-live';
import CreditsHeader from './CreditsHeader';

export const metadata: Metadata = {
  title: 'CREDITS Intelligence | Market Overview',
  description: 'Live market intelligence for finding stronger Credit Rating value across loose CREDITS and Statements.',
  alternates: { canonical: '/credits' },
};

export const revalidate = 900;

const integer = new Intl.NumberFormat('en-US');
const decimal = new Intl.NumberFormat('en-US', { maximumFractionDigits: 1 });
const percent = new Intl.NumberFormat('en-US', { maximumFractionDigits: 1 });
const eth = new Intl.NumberFormat('en-US', { minimumFractionDigits: 3, maximumFractionDigits: 3 });
const ethPerCr = new Intl.NumberFormat('en-US', { minimumFractionDigits: 4, maximumFractionDigits: 4 });
const usd = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });

export default async function CreditsOverviewPage() {
  const live = await loadLiveCreditsOverview().catch(() => null);
  const snapshotAsOf = live?.snapshotAsOf ?? overview.snapshotAsOf;
  const market = {
    looseListings: live?.looseListings ?? overview.market.looseListings,
    looseFloorEth: live?.looseFloorEth ?? overview.market.looseFloorEth,
    within25PctOfFloor: live?.within25PctOfFloor ?? overview.market.within25PctOfFloor,
    ethUsd: live?.ethUsd ?? overview.market.ethUsd,
  };
  const statementFloor = {
    eth: live?.statementFloorEth ?? overview.statements.floorEth,
    cr: live?.statementFloorCr ?? overview.buildVsBuy.statementFloorCr,
    tokenId: live?.statementFloorTokenId ?? overview.buildVsBuy.statementFloorTokenId,
  };
  const basket = {
    credits: live?.looseBasketCredits ?? overview.buildVsBuy.looseBasketCredits,
    eth: live?.looseBasketEth ?? overview.buildVsBuy.looseBasketEth,
    cr: live?.looseBasketCr ?? overview.buildVsBuy.looseBasketCr,
  };
  const listedPct = market.looseListings / overview.supply.loose * 100;
  const comparison = compareBuildAndBuyValue({
    looseBasketEth: basket.eth,
    looseBasketCr: basket.cr,
    statementFloorEth: statementFloor.eth,
    statementFloorCr: statementFloor.cr,
  });
  const cheaperLabel = comparison.cheaperMarket === 'loose' ? 'Loose basket' : 'Statement';

  return (
    <>
      <CreditsHeader active="overview" />
      <div className="cr-creditline"><Link href="/">Market intelligence provided by GridPhantoms <span aria-hidden="true">↗</span></Link></div>
      <main className="cr-main">
        <section className="cr-hero">
          <div>
            <p className="cr-kicker">Collector market view</p>
            <h1>Find more Credit Rating for less.</h1>
            <p className="cr-lede">Compare live asks across loose CREDITS and Statements to spot better-rated pieces and lower-cost CR before you buy.</p>
            <div className="cr-hero-actions">
              <Link href="/credits/value" className="cr-primary">Open Value Finder <span aria-hidden="true">→</span></Link>
              <a href="#market-pulse" className="cr-primary">View market stats <span aria-hidden="true">↓</span></a>
            </div>
          </div>
          <aside className="cr-status" aria-label="Snapshot status">
            <span><i /> Verified snapshot</span>
            <strong>{new Date(snapshotAsOf).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'UTC' })} UTC</strong>
            <small>{live ? 'Market baseline refreshes every 15 minutes.' : 'Showing the latest verified fallback snapshot.'}</small>
            <small>Visible listings can be checked directly in Value Finder.</small>
          </aside>
        </section>

        <section className="cr-section" aria-labelledby="market-pulse">
          <div className="cr-section-head"><div><p className="cr-kicker">Market pulse</p><h2 id="market-pulse">The latest verified baseline</h2></div><span>{live ? '15-minute market snapshot' : overview.sourceLabel}</span></div>
          <div className="cr-stat-grid">
            <article><span>Loose floor</span><strong>{market.looseFloorEth} ETH</strong><small className="cr-support-stat cr-usd-equivalent">≈ {usd.format(market.looseFloorEth * market.ethUsd)}</small></article>
            <article><span>Loose listings</span><strong>{integer.format(market.looseListings)}</strong><small className="cr-support-stat">{percent.format(listedPct)}% of loose supply</small><small className="cr-support-stat">{integer.format(market.within25PctOfFloor)} within 25% of floor</small></article>
          </div>
        </section>

        <div className="cr-split">
          <section className="cr-panel" aria-labelledby="supply-title">
            <p className="cr-kicker">Supply transformation</p>
            <h2 id="supply-title">CREDITS Burn Progress</h2>
            <div className="cr-supply-progress">
              <div className="cr-supply-bar" aria-label={`${percent.format(overview.supply.burnedPct)} percent of original supply is in active Statements`}><i style={{ width: `${overview.supply.burnedPct}%` }} /></div>
              <span className="cr-supply-marker">{percent.format(overview.supply.burnedPct)}%</span>
            </div>
            <dl className="cr-detail-list">
              <div><dt>Original supply</dt><dd>{integer.format(overview.supply.original)}</dd></div>
              <div><dt>Loose today</dt><dd>{integer.format(overview.supply.loose)}</dd></div>
              <div><dt>Burned/In Statements</dt><dd>{integer.format(overview.supply.burnedIntoStatements)}</dd></div>
            </dl>
          </section>

          <section className="cr-panel" aria-labelledby="statements-title">
            <p className="cr-kicker">Statement snapshot</p>
            <h2 id="statements-title">The Statement Market</h2>
            <dl className="cr-detail-list cr-statement-details">
              <div><dt>Current base floor</dt><dd>{eth.format(statementFloor.eth)} ETH<small>≈ {usd.format(statementFloor.eth * market.ethUsd)} · Statement #{statementFloor.tokenId}</small></dd></div>
              <div><dt>Active Statements</dt><dd>{integer.format(overview.statements.active)}</dd></div>
              <div><dt>Listed</dt><dd>{integer.format(overview.statements.listed)}</dd></div>
              <div><dt>Base / Layered / Inverted</dt><dd>{overview.statements.stageCounts.BASE} / {overview.statements.stageCounts.LAYERED} / {overview.statements.stageCounts.INVERTED}</dd></div>
            </dl>
          </section>
        </div>

        <section className="cr-section cr-build" aria-labelledby="build-title">
          <div><p className="cr-kicker">Loose vs. Statement value</p><h2 id="build-title">Where does 1,000 CR cost less?</h2><p className="cr-build-copy">At the latest market snapshot, the cheapest executable {basket.credits}-CREDIT basket (sweeping {basket.credits} CREDITS off the floor now) carried {decimal.format(basket.cr)} CR at {ethPerCr.format(comparison.looseEthPer1kCr)} ETH per 1K CR.</p><p className="cr-build-copy">The lowest listed base Statement, #{statementFloor.tokenId}, carried {integer.format(statementFloor.cr)} CR at {ethPerCr.format(comparison.statementEthPer1kCr)} ETH per 1K CR.</p></div>
          <strong>{cheaperLabel}<small>{percent.format(comparison.savingsPct)}% cheaper</small></strong>
        </section>

      </main>
      <footer className="cr-footer"><Link href="/">Market intelligence provided by GridPhantoms <span aria-hidden="true">↗</span></Link><span>Read-only research. No wallet connection or purchase execution.</span></footer>
    </>
  );
}
