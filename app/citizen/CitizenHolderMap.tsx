import holderSnapshotValue from '@/data/citizen-holder-public.json';

type HolderRow = { rank: number; address: string; count: number; held: number; staked: number };
type SeasonStats = {
  supply: number;
  uniqueOwners: number;
  ownerPercentage: number;
  directHolderWallets: number;
  activeStakerWallets: number;
  directAndStakedOverlap: number;
  directTokens: number;
  stakedTokens: number;
  top: HolderRow[];
};
type DistinctionStats = {
  citizens: number;
  uniqueWallets: number;
  percentageOfOriginalComponentUploads: number;
  locations: { legacy: number; v2: number; staked: number };
};
type HistoricalDistinctions = {
  originalComponentUploads: number;
  originalUpload: DistinctionStats;
  originalWallet: DistinctionStats;
  definition: string;
};
type HolderSnapshot = {
  source: { blockNumber: number; blockHash: string; asOf: string };
  methodology: string;
  seasons: { s1: SeasonStats; s2: SeasonStats };
  s1HistoricalDistinctions: HistoricalDistinctions;
};

const snapshot = holderSnapshotValue as HolderSnapshot;
const shortAddress = (address: string) => `${address.slice(0, 6)}…${address.slice(-4)}`;

function OwnerCard({ season, stats }: { season: 'S1' | 'S2'; stats: SeasonStats }) {
  return <article className="ct-owner-card">
    <header><span>{season}</span><strong>{season === 'S1' ? 'Citizens' : 'Outer Citizens'}</strong></header>
    <div className="ct-owner-main">
      <p>Owners (Unique)</p>
      <strong>{stats.uniqueOwners.toLocaleString()}</strong>
      <span>({stats.ownerPercentage.toFixed(1)}% of {stats.supply.toLocaleString()})</span>
    </div>
    <dl>
      <div><dt>Wallet-held</dt><dd>{stats.directTokens.toLocaleString()}</dd></div>
      <div><dt>Staked</dt><dd>{stats.stakedTokens.toLocaleString()}</dd></div>
      <div><dt>Direct wallets</dt><dd>{stats.directHolderWallets.toLocaleString()}</dd></div>
      <div><dt>Staking wallets</dt><dd>{stats.activeStakerWallets.toLocaleString()}</dd></div>
    </dl>
    <p>{stats.directAndStakedOverlap.toLocaleString()} wallet{stats.directAndStakedOverlap === 1 ? '' : 's'} hold both directly and through staking; counted once.</p>
  </article>;
}

function HistoricalDistinctionCard({ stats }: { stats: HistoricalDistinctions }) {
  return <article className="ct-origin-card">
    <header><span>S1 HISTORY</span><strong>Day 1 distinctions</strong></header>
    <p className="ct-origin-intro">Two nested onchain distinctions for Citizens first uploaded from original 2021-distributed parts.</p>
    <div className="ct-distinction-grid">
      <section className="ct-distinction-tile upload">
        <div><i aria-hidden="true">◇</i><span>ORIGINAL UPLOAD</span></div>
        <strong>{stats.originalUpload.citizens.toLocaleString()}</strong>
        <p>Original 2021 components. Never disassembled or reassembled.</p>
        <small>{stats.originalUpload.percentageOfOriginalComponentUploads.toFixed(1)}% of {stats.originalComponentUploads.toLocaleString()} qualifying first uploads · {stats.originalUpload.locations.staked.toLocaleString()} staked</small>
      </section>
      <section className="ct-distinction-tile wallet">
        <div><i aria-hidden="true">⌾</i><span>ORIGINAL WALLET</span></div>
        <strong>{stats.originalWallet.citizens.toLocaleString()}</strong>
        <p>Original Upload plus uninterrupted ownership by its first assembly wallet.</p>
        <small>{stats.originalWallet.uniqueWallets.toLocaleString()} wallets · {stats.originalWallet.locations.staked.toLocaleString()} staked with custody attributed back</small>
      </section>
    </div>
    <p><strong>Onchain rule.</strong> {stats.definition}</p>
  </article>;
}

function Leaderboard({ season, rows }: { season: 'S1' | 'S2'; rows: HolderRow[] }) {
  return <div className="ct-holder-board">
    <header><span>{season} TOP HOLDERS</span><small>HELD + STAKED</small></header>
    <div className="ct-holder-table-wrap"><table>
      <thead><tr><th>#</th><th>Wallet</th><th>Total</th><th>Held</th><th>Staked</th></tr></thead>
      <tbody>{rows.map((row) => <tr key={`${season}-${row.address}`}>
        <td>{row.rank}</td>
        <td><a href={`https://etherscan.io/address/${row.address}`} target="_blank" rel="noreferrer" title={row.address}>{shortAddress(row.address)} ↗</a></td>
        <td><strong>{row.count}</strong></td><td>{row.held}</td><td>{row.staked}</td>
      </tr>)}</tbody>
    </table></div>
  </div>;
}

export function CitizenHolderSummary() {
  return <section className="ct-panel ct-holder-panel" id="holder-map">
    <div className="ct-section-heading"><p>01 / HOLDER MAP</p><h2>Who actually holds the Citizens?</h2><span>Marketplace-style owner counts, corrected so NeoTokyoStaker custody resolves back to each staking wallet.</span></div>
    <div className="ct-owner-grid"><OwnerCard season="S1" stats={snapshot.seasons.s1} /><OwnerCard season="S2" stats={snapshot.seasons.s2} /></div>
    <HistoricalDistinctionCard stats={snapshot.s1HistoricalDistinctions} />
    <p className="ct-owner-asof">ONCHAIN SNAPSHOT · ETHEREUM BLOCK {snapshot.source.blockNumber.toLocaleString()} · {new Date(snapshot.source.asOf).toLocaleString()}</p>
    <a className="ct-holder-jump" href="#top-holders">VIEW TOP HOLDERS ↓</a>
  </section>;
}

export function CitizenHolderLeaderboard() {
  return <section className="ct-panel ct-holder-panel ct-top-holders" id="top-holders">
    <div className="ct-section-heading"><p>05 / HOLDER LEADERBOARD</p><h2>Top Citizen holders</h2><span>The largest current V2 positions after recombining every verified wallet-held and staked Citizen.</span></div>
    <div className="ct-holder-board-grid"><Leaderboard season="S1" rows={snapshot.seasons.s1.top} /><Leaderboard season="S2" rows={snapshot.seasons.s2.top} /></div>
    <p className="ct-holder-method"><strong>Holder counting.</strong> {snapshot.methodology} Current V2 collections only; unmigrated legacy Citizens are outside these OpenSea-style collection denominators. Snapshot pinned to Ethereum block <a href={`https://etherscan.io/block/${snapshot.source.blockNumber}`} target="_blank" rel="noreferrer">{snapshot.source.blockNumber.toLocaleString()} ↗</a> · {new Date(snapshot.source.asOf).toLocaleString()}.</p>
  </section>;
}
