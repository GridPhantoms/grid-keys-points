import Link from 'next/link';
import holderSnapshotValue from '@/data/citizen-holder-public.json';

const snapshot = holderSnapshotValue as {
  source: { blockNumber: number; asOf: string };
  seasons: { s1: { uniqueOwners: number }; s2: { uniqueOwners: number } };
  s1HistoricalDistinctions: { originalUpload: { citizens: number }; originalWallet: { citizens: number } };
};

const modules = [
  {
    href: '/citizen/lab',
    eyebrow: 'TOOLS // CITIZEN LAB',
    title: 'Decode & model',
    description: 'Inspect any assembled Citizen, trace its components and rarity, then model its staking position.',
    action: 'OPEN CITIZEN LAB',
  },
  {
    href: '/citizen/bytes2bytes',
    eyebrow: 'TOOLS // WALLET INTELLIGENCE',
    title: 'Bytes2Bytes',
    description: 'Read liquid $BYTES, pending rewards, committed $BYTES and every staked Citizen in a wallet.',
    action: 'SCAN A WALLET',
  },
  {
    href: '/citizen/holders',
    eyebrow: 'INTELLIGENCE // OWNERSHIP',
    title: 'Holders & provenance',
    description: 'Explore beneficial ownership, Original Upload lineage and the largest current Citizen positions.',
    action: 'VIEW HOLDERS',
  },
  {
    href: '/citizen/market',
    eyebrow: 'INTELLIGENCE // MARKET',
    title: 'Market dashboard',
    description: 'Track collection references, implied ecosystem value and current Elite S1 listings.',
    action: 'OPEN MARKET',
  },
];

export default function CitizenOverview() {
  const metrics = [
    ['S1 OWNERS', snapshot.seasons.s1.uniqueOwners],
    ['S2 OWNERS', snapshot.seasons.s2.uniqueOwners],
    ['ORIGINAL UPLOAD CITIZENS', snapshot.s1HistoricalDistinctions.originalUpload.citizens],
    ['ORIGINAL WALLET CITIZENS', snapshot.s1HistoricalDistinctions.originalWallet.citizens],
  ] as const;

  return <main className="ct-main ct-overview-main">
    <section className="ct-hero" aria-labelledby="citizen-title">
      <div className="ct-hero-title">
        <div className="ct-kicker">NEO TOKYO MARKET INTELLIGENCE</div>
        <h1 id="citizen-title">Citizen <em>Interlink</em></h1>
        <p>Inspect the code. Price the yield. Read the market.</p>
        <div className="ct-hero-badges"><span>Citizen intelligence</span><span>Wallet intelligence</span><span>Market references</span></div>
      </div>
      <div className="ct-overview-status">
        <strong><i aria-hidden="true" />ONCHAIN SNAPSHOT INDEXED</strong>
        <span>Ethereum snapshot block {snapshot.source.blockNumber.toLocaleString()}</span>
        <span>{new Date(snapshot.source.asOf).toLocaleString()}</span>
      </div>
    </section>

    <section className="ct-overview-glance" aria-label="Citizen Interlink at a glance">
      <header><span>INTERLINK AT A GLANCE</span><small>ONCHAIN SNAPSHOT</small></header>
      <div>{metrics.map(([label, value]) => <article key={label}><span>{label}</span><strong>{value.toLocaleString()}</strong></article>)}</div>
    </section>

    <section className="ct-module-launcher" aria-labelledby="module-heading">
      <div className="ct-section-heading"><p>CHOOSE A MODULE</p><h2 id="module-heading">One network. Four focused workspaces.</h2><span>Open the tool you need without scrolling through the entire Interlink.</span></div>
      <div className="ct-module-grid">
        {modules.map((module, index) => <Link href={module.href} key={module.href} className="ct-module-card">
          <small>{String(index + 1).padStart(2, '0')}</small>
          <p>{module.eyebrow}</p>
          <h3>{module.title}</h3>
          <span>{module.description}</span>
          <strong>{module.action} →</strong>
        </Link>)}
      </div>
    </section>

    <p className="ct-overview-note">READ-ONLY INTELLIGENCE · SOURCE-PINNED WHERE AVAILABLE · NO WALLET CONNECTION OR SIGNATURE REQUIRED</p>
  </main>;
}
