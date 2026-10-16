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
  openGraph: {
    type: 'website',
    url: '/credits',
    title: 'CREDITS Intelligence | Market Overview',
    description: 'Public collector tools for understanding CREDITS supply, burn progress, Statements and market value.',
    images: [{ url: '/credits/opengraph-image', width: 1200, height: 630, alt: 'CREDITS Intelligence public collector tools: market overview' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'CREDITS Intelligence | Market Overview',
    description: 'Understand CREDITS supply, burn progress, Statements and market value.',
    images: ['/credits/opengraph-image'],
  },
};

// The data loader below owns the only cache boundary. Keeping the route
// dynamic prevents a second stale-while-revalidate layer from compounding lag.
export const dynamic = 'force-dynamic';

const integer = new Intl.NumberFormat('en-US');
const decimal = new Intl.NumberFormat('en-US', { maximumFractionDigits: 1 });
const percent = new Intl.NumberFormat('en-US', { maximumFractionDigits: 1 });
const eth = new Intl.NumberFormat('en-US', { minimumFractionDigits: 3, maximumFractionDigits: 3 });
const ethPerCr = new Intl.NumberFormat('en-US', { minimumFractionDigits: 4, maximumFractionDigits: 4 });
const usd = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });

export default async function CreditsOverviewPage() {
  const live = await loadLiveCreditsOverview().catch(() => null);
  const snapshotAsOf = live?.snapshotAsOf ?? overview.snapshotAsOf;
  const protocolSnapshotLabel = new Date(overview.snapshotAsOf).toLocaleString('en-US', {
    dateStyle: 'medium', timeStyle: 'short', timeZone: 'UTC',
  });
  const currentProtocol = live?.protocolAvailable && live.protocolSupply ? live.protocolSupply : null;
  const supply = currentProtocol ?? overview.supply;
  const activeStatements = currentProtocol?.activeStatements ?? overview.statements.active;
  const stageCounts = currentProtocol?.stageCounts ?? overview.statements.stageCounts;
  const protocolLabel = currentProtocol && live?.protocolCheckedAt
    ? `Current Statement metadata checked: ${new Date(live.protocolCheckedAt).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'UTC' })} UTC`
    : `Daily protocol snapshot: ${protocolSnapshotLabel} UTC`;
  const market = live ? {
    looseListings: live.looseListings,
    looseFloorEth: live.looseFloorEth,
    within25PctOfFloor: live.within25PctOfFloor,
    ethUsd: live.ethUsd,
  } : null;
  const statementFloor = live?.statementAvailable && live.statementFloorEth && live.statementFloorCr && live.statementFloorTokenId
    ? { eth: live.statementFloorEth, cr: live.statementFloorCr, tokenId: live.statementFloorTokenId }
    : null;
  const statementValue = live?.statementAvailable && live.statementValueEth && live.statementValueCr && live.statementValueTokenId
    ? { eth: live.statementValueEth, cr: live.statementValueCr, tokenId: live.statementValueTokenId }
    : null;
  const basket = live ? { credits: live.looseBasketCredits, eth: live.looseBasketEth, cr: live.looseBasketCr } : null;
  const looseValue = live?.looseValueHunt ?? null;
  const listedPct = market ? market.looseListings / supply.loose * 100 : null;
  const comparison = basket && statementValue ? compareBuildAndBuyValue({
    looseBasketEth: basket.eth,
    looseBasketCr: basket.cr,
    statementValueEth: statementValue.eth,
    statementValueCr: statementValue.cr,
  }) : null;
  const cheaperLabel = comparison?.cheaperMarket === 'loose' ? 'Loose basket' : 'Statement';

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
              <Link href="/credits/appraiser" className="cr-primary">Open Appraiser <span aria-hidden="true">→</span></Link>
              <a href="#market-pulse" className="cr-primary">View market stats <span aria-hidden="true">↓</span></a>
            </div>
          </div>
          <aside className="cr-status" aria-label="Snapshot status">
            <span><i /> {live ? 'Official market snapshot' : 'Market data unavailable'}</span>
            <strong>{new Date(snapshotAsOf).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'UTC' })} UTC</strong>
            <small>{live?.sourceRefreshing || live?.sourceDegraded ? 'Official market scan is delayed or rate-limited; displaying its last completed candidate snapshot.' : live ? 'Official candidate snapshot checked on each page request.' : 'Live market prices are hidden rather than replaced with historical fallback prices.'}</small>
            <small>Visible listings can be checked directly in Value Finder.</small>
          </aside>
        </section>

        <section className="cr-section" aria-labelledby="market-pulse">
          <div className="cr-section-head"><div><p className="cr-kicker">Market pulse</p><h2 id="market-pulse">Latest completed candidate snapshot</h2></div><span>{live ? 'Official source · request-time check' : 'Unavailable'}</span></div>
          {market ? <div className="cr-stat-grid">
            <article><span>Loose snapshot floor</span><strong>{market.looseFloorEth} ETH</strong><small className="cr-support-stat cr-usd-equivalent">≈ {usd.format(market.looseFloorEth * market.ethUsd)}</small></article>
            <article><span>Loose snapshot listings</span><strong>{integer.format(market.looseListings)}</strong><small className="cr-support-stat">{percent.format(listedPct!)}% of daily loose supply</small><small className="cr-support-stat">{integer.format(market.within25PctOfFloor)} within 25% of snapshot floor</small></article>
          </div> : <p className="cr-empty">Current market dependencies could not be verified. Historical prices are not shown as live.</p>}
        </section>

        <div className="cr-split">
          <section className="cr-panel" aria-labelledby="supply-title">
            <p className="cr-kicker">Supply transformation</p>
            <h2 id="supply-title">CREDITS Burn Progress</h2>
            <p className="cr-panel-asof">{protocolLabel}</p>
            <div className="cr-supply-progress">
              <div className="cr-supply-bar" aria-label={`${percent.format(supply.burnedPct)} percent of original supply is in active Statements`}><i style={{ width: `${supply.burnedPct}%` }} /></div>
              <span className="cr-supply-marker">{percent.format(supply.burnedPct)}%</span>
            </div>
            <dl className="cr-detail-list">
              <div><dt>Original supply</dt><dd>{integer.format(supply.original)}</dd></div>
              <div><dt>Loose today</dt><dd>{integer.format(supply.loose)}</dd></div>
              <div><dt>Burned/In Statements</dt><dd>{integer.format(supply.burned)}</dd></div>
            </dl>
          </section>

          <section className="cr-panel" aria-labelledby="statements-title">
            <p className="cr-kicker">Statement snapshot</p>
            <h2 id="statements-title">The Statement Market</h2>
            <p className="cr-panel-asof">{protocolLabel}</p>
            <dl className="cr-detail-list cr-statement-details">
              <div><dt>Verified base floor</dt><dd>{statementFloor && market ? <>{eth.format(statementFloor.eth)} ETH<small>≈ {usd.format(statementFloor.eth * market.ethUsd)} · Statement #{statementFloor.tokenId}</small></> : <>Unavailable<small>{live?.statementReason ?? 'Current dependencies could not be verified.'}</small></>}</dd></div>
              <div><dt>Active Statements</dt><dd>{integer.format(activeStatements)}</dd></div>
              <div><dt>Daily listed baseline</dt><dd>{integer.format(overview.statements.listed)}</dd></div>
              <div><dt>Base / Layered / Inverted</dt><dd>{stageCounts.BASE} / {stageCounts.LAYERED} / {stageCounts.INVERTED}</dd></div>
            </dl>
          </section>
        </div>

        <section className="cr-section cr-build" aria-labelledby="build-title">
          {basket && statementValue && comparison ? <><div><p className="cr-kicker">Two immediate 80-CREDIT routes</p><h2 id="build-title">Floor sweep or ready-made Statement?</h2><p className="cr-build-copy">Using the latest completed loose-CREDIT snapshot and a separate check of Statement listings, the {basket.credits} lowest-priced loose listings totaled {eth.format(basket.eth)} ETH and carried {decimal.format(basket.cr)} CR—or {ethPerCr.format(comparison.looseEthPer1kCr)} ETH per 1K CR.</p><p className="cr-build-copy">The most CR-efficient verified base Statement, #{statementValue.tokenId}, was listed at {eth.format(statementValue.eth)} ETH and carried {integer.format(statementValue.cr)} CR—or {ethPerCr.format(comparison.statementEthPer1kCr)} ETH per 1K CR. The percentage compares cost per 1K CR—not total purchase price. Listings were checked separately, so this is not an executable quote; reverify each in Value Finder before buying.</p><p className="cr-build-copy">A patient buyer may find better CR efficiency by cherry-picking individual loose CREDITS over time. That strategy is tracked separately because its inventory, timing and total acquisition cost are not fixed.</p></div><strong>{cheaperLabel}<small>{percent.format(comparison.savingsPct)}% lower cost per 1K CR</small></strong></> : <div><p className="cr-kicker">Two immediate 80-CREDIT routes</p><h2 id="build-title">Comparison temporarily unavailable</h2><p className="cr-build-copy">The comparison is hidden until loose listings, Statement orders, daily Statement metadata, and ETH/USD can all be verified together.</p></div>}
        </section>

        {looseValue && statementValue && comparison ? <section className="cr-section cr-hunt" aria-labelledby="hunt-title">
          <div><p className="cr-kicker">Cherry-picked loose CREDITS</p><h2 id="hunt-title">Hunt for stronger CR value one piece at a time.</h2><p className="cr-hunt-intro">Cherry-picking can beat either bulk route, but it is a strategy—not a fixed 80-piece basket. Strong individual opportunities can disappear, and assembling 80 may require more time, transactions and capital.</p></div>
          <div className="cr-hunt-grid">
            <article><span>Best loose snapshot candidate</span><strong>{ethPerCr.format(looseValue.bestEthPer1kCr)} ETH</strong><small>per 1K CR · CREDIT #{looseValue.bestTokenId}<br />{eth.format(looseValue.bestPriceEth)} ETH ask · {decimal.format(looseValue.bestCr)} CR</small></article>
            <article><span>Top-{looseValue.sampleSize} loose value range</span><strong>{ethPerCr.format(looseValue.rangeLowEthPer1kCr)}–{ethPerCr.format(looseValue.rangeHighEthPer1kCr)} ETH</strong><small>per 1K CR · snapshot candidates</small></article>
            <article><span>Best-value Base Statement</span><strong>{ethPerCr.format(comparison.statementEthPer1kCr)} ETH</strong><small>per 1K CR · Statement #{statementValue.tokenId}<br />{eth.format(statementValue.eth)} ETH ask</small></article>
          </div>
          <div className="cr-hunt-action"><Link href="/credits/value?sort=best-value" className="cr-primary">Explore best-value loose CREDITS <span aria-hidden="true">→</span></Link><small>Snapshot candidates are not atomic quotes. Reverify each listing in Value Finder.</small></div>
        </section> : null}

      </main>
      <footer className="cr-footer"><Link href="/">Market intelligence provided by GridPhantoms <span aria-hidden="true">↗</span></Link><span>Read-only research. No wallet connection or purchase execution.</span></footer>
    </>
  );
}
