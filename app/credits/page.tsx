import type { Metadata } from 'next';
import Link from 'next/link';
import overview from '@/data/credits-overview.json';
import { compareBuildAndBuyValue } from '@/lib/credits-intelligence';
import { loadLiveCreditsOverview } from '@/lib/credits-overview-live';
import CreditsHeader from './CreditsHeader';

export const metadata: Metadata = {
  title: 'CREDITS Intelligence | Market Overview',
  description: 'Live market intelligence for understanding Credit Rating value across CREDITS, Statements and potential $BALANCE.',
  alternates: { canonical: '/credits' },
  openGraph: {
    type: 'website',
    url: '/credits',
    title: 'CREDITS Intelligence | Market Overview',
    description: 'Public collector tools for comparing CREDITS routes, Statement flow and potential $BALANCE value.',
    images: [{ url: '/credits/opengraph-image', width: 1200, height: 630, alt: 'CREDITS Intelligence public collector tools: market overview' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'CREDITS Intelligence | Market Overview',
    description: 'Compare CREDITS routes, Statement flow and potential $BALANCE value.',
    images: ['/credits/opengraph-image'],
  },
};

// The data loader below owns the only cache boundary. Keeping the route
// dynamic prevents a second stale-while-revalidate layer from compounding lag.
export const dynamic = 'force-dynamic';

const MAX_POTENTIAL_BALANCE = 53_771_173.4201;
const integer = new Intl.NumberFormat('en-US');
const decimal = new Intl.NumberFormat('en-US', { maximumFractionDigits: 1 });
const percent = new Intl.NumberFormat('en-US', { maximumFractionDigits: 1 });
const eth = new Intl.NumberFormat('en-US', { minimumFractionDigits: 3, maximumFractionDigits: 3 });
const ethPerCr = new Intl.NumberFormat('en-US', { minimumFractionDigits: 4, maximumFractionDigits: 4 });
const usd = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
const usdToken = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 3, maximumFractionDigits: 3 });
const compact = new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 2 });

function utcLabel(value: string) {
  return `${new Date(value).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'UTC' })} UTC`;
}

export default async function CreditsOverviewPage() {
  const live = await loadLiveCreditsOverview().catch(() => null);
  const snapshotAsOf = live?.snapshotAsOf ?? overview.snapshotAsOf;
  const currentProtocol = live?.protocolAvailable && live.protocolSupply ? live.protocolSupply : null;
  const supply = currentProtocol ?? overview.supply;
  const activeStatements = currentProtocol?.activeStatements ?? overview.statements.active;
  const stageCounts = currentProtocol?.stageCounts ?? overview.statements.stageCounts;
  const totalStatementCr = currentProtocol?.totalCreditRating ?? overview.statements.totalCreditRating;
  const protocolAsOf = currentProtocol && live?.protocolCheckedAt ? live.protocolCheckedAt : overview.snapshotAsOf;
  const listedStatements = live?.statementListedCount ?? null;
  const market = live ? {
    looseListings: live.looseListings,
    looseFloorEth: live.looseFloorEth,
    within10PctOfFloor: live.within10PctOfFloor,
    ethUsd: live.ethUsd,
  } : null;
  const statementFloor = live?.statementAvailable && live.statementFloorEth && live.statementFloorCr && live.statementFloorTokenId
    ? { eth: live.statementFloorEth, cr: live.statementFloorCr, tokenId: live.statementFloorTokenId }
    : null;
  const statementValue = live?.statementAvailable && live.statementValueEth && live.statementValueCr && live.statementValueTokenId
    ? { eth: live.statementValueEth, cr: live.statementValueCr, tokenId: live.statementValueTokenId }
    : null;
  const floorBasket = live ? { credits: live.looseBasketCredits, eth: live.looseBasketEth, cr: live.looseBasketCr } : null;
  const valueBasket = live ? {
    credits: live.looseValueBasketCredits,
    eth: live.looseValueBasketEth,
    cr: live.looseValueBasketCr,
    ethPer1kCr: live.looseValueBasketEthPer1kCr,
  } : null;
  const looseValue = live?.looseValueHunt ?? null;
  const listedPct = market ? market.looseListings / supply.loose * 100 : null;
  const assemblyComparison = floorBasket && statementValue ? compareBuildAndBuyValue({
    looseBasketEth: floorBasket.eth,
    looseBasketCr: floorBasket.cr,
    statementValueEth: statementValue.eth,
    statementValueCr: statementValue.cr,
  }) : null;
  const valueComparison = valueBasket && statementValue ? compareBuildAndBuyValue({
    looseBasketEth: valueBasket.eth,
    looseBasketCr: valueBasket.cr,
    statementValueEth: statementValue.eth,
    statementValueCr: statementValue.cr,
  }) : null;
  const statementEthPer1kCr = valueComparison?.statementEthPer1kCr ?? null;
  const balanceUnitUsd = statementEthPer1kCr && market ? statementEthPer1kCr / 1_000 * market.ethUsd : null;
  const estimatedFdvUsd = balanceUnitUsd ? balanceUnitUsd * MAX_POTENTIAL_BALANCE : null;
  const statementCrPct = totalStatementCr / MAX_POTENTIAL_BALANCE * 100;

  return (
    <>
      <CreditsHeader active="overview" />
      <div className="cr-creditline"><Link href="/">Market intelligence provided by GridPhantoms <span aria-hidden="true">↗</span></Link></div>
      <main className="cr-main cr-overview-main">
        <section className="cr-hero cr-overview-hero">
          <div>
            <p className="cr-kicker">Collector market view</p>
            <h1>Find more Credit Rating for less.</h1>
            <p className="cr-lede">Compare verified asks across loose CREDITS and Statements, then choose the route that fits your goal.</p>
            <ol className="cr-value-path" aria-label="CREDITS to Statements to BALANCE value path">
              <li><span>CREDITS</span><small>Loose pieces</small></li>
              <li><span>STATEMENTS</span><small>Packaged Credit Rating</small></li>
              <li><span>$BALANCE</span><small>Announced 1:1 · Pre-TGE</small></li>
            </ol>
            <p className="cr-path-note">Credit Rating is the common value layer across all three.</p>
            <div className="cr-hero-actions">
              <Link href="/credits/value" className="cr-primary">Open Value Finder <span aria-hidden="true">→</span></Link>
              <Link href="/credits/appraiser" className="cr-primary">Open Appraiser <span aria-hidden="true">→</span></Link>
              <a href="#routes" className="cr-primary">Compare routes <span aria-hidden="true">↓</span></a>
            </div>
          </div>
          <aside className="cr-status" aria-label="Snapshot status">
            <span><i /> {live ? 'Multi-source snapshot' : 'Market data unavailable'}</span>
            <strong>Market · {utcLabel(snapshotAsOf)}</strong>
            <small>Protocol · {utcLabel(protocolAsOf)}</small>
            <small>{live?.sourceRefreshing || live?.sourceDegraded ? 'Official market scan is delayed or rate-limited; showing its last completed candidate snapshot.' : live ? 'Listings and protocol state refresh independently. Reverify before buying.' : 'Live prices are hidden rather than replaced with historical fallback prices.'}</small>
          </aside>
        </section>

        <section className="cr-benchmark" aria-labelledby="benchmark-title">
          <div className="cr-section-head">
            <div><p className="cr-kicker">Today&apos;s CR benchmark</p><h2 id="benchmark-title">What the strongest listed route implies.</h2></div>
            <span>{statementValue ? 'Verified listings · pre-TGE model' : 'Current route unavailable'}</span>
          </div>
          {estimatedFdvUsd && balanceUnitUsd && statementValue && statementEthPer1kCr && valueBasket && valueComparison && market ? <>
            <div className="cr-benchmark-grid">
              <article className="cr-benchmark-hero"><span>Estimated $BALANCE FDV</span><strong>~{usd.format(estimatedFdvUsd)}</strong><small>{usdToken.format(balanceUnitUsd)} per potential $BALANCE · {compact.format(MAX_POTENTIAL_BALANCE)} max potential supply · pre-TGE</small></article>
              <article><span>Lowest listed cost per 1,000 CR</span><strong>{ethPerCr.format(statementEthPer1kCr)} ETH</strong><small>≈ {usd.format(statementEthPer1kCr * market.ethUsd)} · Statement #{statementValue.tokenId}<br />{eth.format(statementValue.eth)} ETH ask · {integer.format(statementValue.cr)} CR</small></article>
              <article><span>Idealized Top {valueBasket.credits} best-value CREDITS</span><strong>{ethPerCr.format(valueBasket.ethPer1kCr)} ETH</strong><small>≈ {usd.format(valueBasket.ethPer1kCr * market.ethUsd)} per 1K CR<br />{eth.format(valueBasket.eth)} ETH total · {integer.format(Math.round(valueBasket.cr))} CR</small></article>
            </div>
            <p className="cr-model-note"><strong>{valueComparison.cheaperMarket === 'statement' ? 'Statement' : 'Idealized loose basket'} is {percent.format(valueComparison.savingsPct)}% lower per 1K CR in this snapshot.</strong> The Top 80 is a non-atomic moving basket, not one executable purchase. The FDV is an acquisition-cost estimate based on current verified listings and the announced 1 CR → 1 $BALANCE design—not a live token price or market cap.</p>
          </> : <p className="cr-empty">The benchmark is hidden until loose listings, Statement orders, Statement metadata and ETH/USD can all be verified together.</p>}
        </section>

        <section className="cr-section cr-route-section" id="routes" aria-labelledby="routes-title">
          <div className="cr-section-head"><div><p className="cr-kicker">Choose your acquisition path</p><h2 id="routes-title">Three goals. Three honest tradeoffs.</h2></div><span>Cost per 1K CR · not total-price verdicts</span></div>
          {floorBasket && statementValue && assemblyComparison && looseValue && market ? <div className="cr-route-grid">
            <article>
              <b>01</b><span>Build from the floor</span><h3>Assemble 80 loose pieces</h3>
              <dl><div><dt>Total ask</dt><dd>{eth.format(floorBasket.eth)} ETH</dd></div><div><dt>Combined CR</dt><dd>{integer.format(Math.round(floorBasket.cr))}</dd></div><div><dt>Cost per 1K CR</dt><dd>{ethPerCr.format(assemblyComparison.looseEthPer1kCr)} ETH</dd></div></dl>
              <p>The 80 lowest-priced snapshot listings. Lowest asks first, with up to 80 separate executions.</p>
            </article>
            <article className="cr-route-featured">
              <b>02</b><span>Buy packaged CR</span><h3>One BASE Statement</h3>
              <dl><div><dt>Total ask</dt><dd>{eth.format(statementValue.eth)} ETH</dd></div><div><dt>Combined CR</dt><dd>{integer.format(statementValue.cr)}</dd></div><div><dt>Cost per 1K CR</dt><dd>{ethPerCr.format(assemblyComparison.statementEthPer1kCr)} ETH</dd></div></dl>
              <p>Statement #{statementValue.tokenId} is the most CR-efficient verified BASE listing—not necessarily the lowest total ask.</p>
            </article>
            <article>
              <b>03</b><span>Hunt one by one</span><h3>Patient value finding</h3>
              <dl><div><dt>Best candidate</dt><dd>CREDIT #{looseValue.bestTokenId}</dd></div><div><dt>Ask / CR</dt><dd>{eth.format(looseValue.bestPriceEth)} ETH · {decimal.format(looseValue.bestCr)}</dd></div><div><dt>Cost per 1K CR</dt><dd>{ethPerCr.format(looseValue.bestEthPer1kCr)} ETH</dd></div></dl>
              <p>Cherry-picking can beat either bulk route, but inventory, timing, transactions and total acquisition cost are not fixed.</p>
            </article>
          </div> : <p className="cr-empty">Current route comparisons are temporarily unavailable.</p>}
          <div className="cr-route-footer">
            <p>{assemblyComparison ? <><strong>For the immediate 80-piece comparison:</strong> {assemblyComparison.cheaperMarket === 'statement' ? 'Statement' : 'Loose basket'} is {percent.format(assemblyComparison.savingsPct)}% lower per 1K CR. This compares efficiency—not total purchase price.</> : 'Route comparison unavailable.'}</p>
            <Link href="/credits/value?sort=best-value" className="cr-primary">Explore live candidates <span aria-hidden="true">→</span></Link>
          </div>
        </section>

        <section className="cr-section cr-protocol" aria-labelledby="protocol-title">
          <div className="cr-section-head"><div><p className="cr-kicker">Protocol flow</p><h2 id="protocol-title">CREDITS → STATEMENTS</h2></div><span>Statement metadata · {utcLabel(protocolAsOf)}</span></div>
          <div className="cr-flow-grid">
            <article><span>CREDITS transformed</span><strong>{integer.format(supply.burned)}</strong><small>{percent.format(supply.burnedPct)}% of original supply · {integer.format(supply.loose)} remain loose</small></article>
            <article><span>CR inside Statements</span><strong>{compact.format(totalStatementCr)}</strong><small>{percent.format(statementCrPct)}% of max potential $BALANCE supply</small></article>
            <article><span>Active Statements</span><strong>{integer.format(activeStatements)}</strong><small>{stageCounts.BASE} Base · {stageCounts.LAYERED} Layered · {stageCounts.INVERTED} Inverted{listedStatements !== null ? ` · ${integer.format(listedStatements)} listed` : ''}</small></article>
            {live?.protocolFlow24h ? <article className="cr-flow-daily"><span>Exact past 24 hours</span><strong>+{integer.format(live.protocolFlow24h.statements)} Statements</strong><small>{integer.format(live.protocolFlow24h.credits)} CREDITS transformed · {integer.format(Math.round(live.protocolFlow24h.creditRating))} CR packaged<br />Through block {integer.format(live.protocolFlow24h.endBlock)} · {utcLabel(live.protocolFlow24h.asOf)}</small></article> : <article className="cr-flow-daily cr-flow-unavailable"><span>Exact past 24 hours</span><strong>Unavailable</strong><small>Onchain mint flow is hidden until its Ethereum block window and Statement metadata both verify.</small></article>}
          </div>
        </section>

        <section className="cr-section cr-market-context" id="market-pulse" aria-labelledby="market-pulse-title">
          <div className="cr-section-head"><div><p className="cr-kicker">Market context</p><h2 id="market-pulse-title">Supporting tape, not the whole story.</h2></div><span>{live ? `Official candidate snapshot · ${utcLabel(snapshotAsOf)}` : 'Unavailable'}</span></div>
          {market ? <div className="cr-context-grid">
            <article><span>Loose snapshot floor</span><strong>{eth.format(market.looseFloorEth)} ETH</strong><small>≈ {usd.format(market.looseFloorEth * market.ethUsd)}</small></article>
            <article><span>Loose snapshot listings</span><strong>{integer.format(market.looseListings)}</strong><small>{percent.format(listedPct!)}% of current loose supply</small></article>
            <article><span>Near-floor depth</span><strong>{integer.format(market.within10PctOfFloor)}</strong><small>listings within 10% of snapshot floor</small></article>
            <article><span>Verified BASE Statement floor</span><strong>{statementFloor ? `${eth.format(statementFloor.eth)} ETH` : 'Unavailable'}</strong><small>{statementFloor ? `≈ ${usd.format(statementFloor.eth * market.ethUsd)} · Statement #${statementFloor.tokenId}` : live?.statementReason ?? 'Current dependencies could not be verified.'}</small></article>
          </div> : <p className="cr-empty">Current market dependencies could not be verified. Historical prices are not shown as live.</p>}
        </section>

        <section className="cr-tools" aria-labelledby="tools-title">
          <div><p className="cr-kicker">Read-only collector tools</p><h2 id="tools-title">Move from overview to your own decision.</h2></div>
          <div className="cr-tool-grid">
            <Link href="/credits/value"><span>Value Finder</span><strong>Search verified loose CREDITS and Statements by CR efficiency.</strong><i aria-hidden="true">→</i></Link>
            <Link href="/credits/appraiser"><span>Wallet Appraiser</span><strong>Estimate listing-based replacement value for a CREDITS wallet.</strong><i aria-hidden="true">→</i></Link>
          </div>
          <p>Read-only research. No wallet connection, signing or purchase execution. Listings can change before purchase; reverify the exact item on the marketplace.</p>
        </section>
      </main>
      <footer className="cr-footer"><Link href="/">Market intelligence provided by GridPhantoms <span aria-hidden="true">↗</span></Link><span>Read-only research. No wallet connection or purchase execution.</span></footer>
    </>
  );
}
