import type { Metadata } from 'next';
import Link from 'next/link';
import SiteNav from '../../components/SiteNav';
import SiteFooter from '../../components/SiteFooter';
import './home-beta.css';

export const metadata: Metadata = {
  title: 'Grid Phantoms Homepage Beta',
  description: 'Unlisted concept preview for the next Grid Phantoms homepage.',
  robots: { index: false, follow: false, nocache: true },
};

const systems = [
  {
    index: '01',
    status: 'ONLINE',
    title: '$BYTES Terminal',
    command: 'Read the token.',
    body: 'Track supply, emissions, participation, holders and live market references through a first-party intelligence layer.',
    href: '/bytes',
    action: 'OPEN TERMINAL',
  },
  {
    index: '02',
    status: 'INTERLINK ACTIVE',
    title: 'Citizen Interlink',
    command: 'Decode the Citizen.',
    body: 'A living bridge to the Citadel: inspect assembled Citizens, component rarity, market references and staking economics.',
    href: '/citizen',
    action: 'ESTABLISH INTERLINK',
    note: 'The Grid did not sever the network that gave it ground. This system preserves the bridge to our Genesis spawning grounds and keeps useful infrastructure flowing back across it.',
  },
  {
    index: '03',
    status: 'OPERATIONAL',
    title: 'Engine Room',
    command: 'Verify the machinery.',
    body: 'Follow the Vault, historical Phantom Rewards, participation metrics and the evidence behind Grid operations.',
    href: '/engine',
    action: 'ENTER ENGINE ROOM',
  },
];

function GridSignalArt() {
  return (
    <div className="hb-signal" aria-label="A Key-shaped signal rising from a fractured digital city and feeding the Grid systems">
      <svg viewBox="0 0 680 620" role="img" aria-hidden="true">
        <defs>
          <linearGradient id="hbSky" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#071219" />
            <stop offset="0.62" stopColor="#03090d" />
            <stop offset="1" stopColor="#020304" />
          </linearGradient>
          <linearGradient id="hbBeam" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" stopColor="#22d3ee" stopOpacity="0" />
            <stop offset="0.5" stopColor="#67e8f9" stopOpacity="0.7" />
            <stop offset="1" stopColor="#22d3ee" stopOpacity="0" />
          </linearGradient>
          <radialGradient id="hbGlow">
            <stop offset="0" stopColor="#67e8f9" stopOpacity="0.5" />
            <stop offset="1" stopColor="#22d3ee" stopOpacity="0" />
          </radialGradient>
          <filter id="hbSoft"><feGaussianBlur stdDeviation="8" /></filter>
          <pattern id="hbGrid" width="38" height="38" patternUnits="userSpaceOnUse">
            <path d="M38 0H0V38" fill="none" stroke="#22d3ee" strokeOpacity="0.11" strokeWidth="1" />
          </pattern>
        </defs>
        <rect width="680" height="620" rx="28" fill="url(#hbSky)" />
        <ellipse cx="340" cy="248" rx="230" ry="210" fill="url(#hbGlow)" opacity="0.65" />
        <path d="M0 445L680 360V620H0Z" fill="url(#hbGrid)" />
        <path d="M0 445L680 360M50 620L340 402M630 620L340 402M155 620L340 402M525 620L340 402" stroke="#22d3ee" strokeOpacity="0.18" />
        <g fill="#07151b" stroke="#155467" strokeOpacity="0.6">
          <path d="M40 410V328h54v75M103 401V285h68v109M182 391V320h38v66M465 373V298h52v68M525 366V253h74v104M608 354V310h42v39" />
        </g>
        <g stroke="#22d3ee" strokeOpacity="0.45">
          <path d="M55 347h22M117 307h38M117 330h38M479 316h24M541 276h42M541 300h42M619 328h18" />
        </g>
        <path d="M340 106a92 92 0 1 0 0 184a92 92 0 0 0 0-184Zm0 43a49 49 0 1 1 0 98a49 49 0 0 1 0-98Z" fill="none" stroke="#67e8f9" strokeWidth="9" />
        <path d="M340 290v154M340 366h87M392 366v47M423 366v28" fill="none" stroke="#67e8f9" strokeWidth="12" strokeLinecap="square" />
        <path d="M340 290v154M340 366h87" fill="none" stroke="#67e8f9" strokeOpacity="0.7" strokeWidth="28" filter="url(#hbSoft)" />
        <path d="M75 220H275M405 220h200" stroke="url(#hbBeam)" strokeWidth="2" />
        <circle cx="340" cy="220" r="7" fill="#e8fdff" />
        <circle cx="340" cy="220" r="24" fill="none" stroke="#67e8f9" strokeOpacity="0.4" />
        <g className="hb-nodes">
          <circle cx="92" cy="520" r="7" /><circle cx="340" cy="520" r="7" /><circle cx="588" cy="520" r="7" />
          <path d="M99 520h234M347 520h234" />
        </g>
        <g className="hb-signal-copy">
          <text x="56" y="552">TERMINAL</text><text x="300" y="552">INTERLINK</text><text x="545" y="552">ENGINE</text>
        </g>
      </svg>
      <div className="hb-art-caption"><span>GRID SIGNAL // 001</span><span>NETWORK FORMING</span></div>
    </div>
  );
}

export default function GridHomeBeta() {
  return (
    <div className="hb-page">
      <div className="hb-preview-bar"><span>UNLISTED HOMEPAGE BETA</span><span>NOINDEX // NOT IN SITE NAVIGATION</span></div>
      <SiteNav active="home" />

      <main>
        <section className="hb-hero">
          <div className="hb-hero-copy">
            <p className="hb-eyebrow">THE REBELLION IS ALREADY IN MOTION</p>
            <h1>Hold the Keys.<br />Read the Grid.<br /><em>Shape what comes next.</em></h1>
            <p className="hb-lede">In the aftermath of the Truncation, power consolidated behind closed systems. Grid Phantoms formed in the shadows: an onchain collective of Keyholders building transparent tools, shared intelligence and community-governed infrastructure.</p>
            <div className="hb-actions">
              <a href="#grid-systems" className="hb-button hb-button-primary">ENTER THE GRID</a>
              <a href="#keyholder-console" className="hb-button hb-button-secondary">LOAD MY KEYS</a>
            </div>
            <div className="hb-system-line"><span>GENESIS + EXODUS</span><span>ONCHAIN GOVERNANCE</span><span>LIVE INTELLIGENCE</span><span>TRANSPARENT OPERATIONS</span></div>
          </div>
          <GridSignalArt />
        </section>

        <section className="hb-systems" id="grid-systems" aria-labelledby="systems-title">
          <header className="hb-section-heading">
            <div><p className="hb-eyebrow">GRID SYSTEMS</p><h2 id="systems-title">Three operational layers.<br />One connected network.</h2></div>
            <p>Read the utility token. Preserve the bridge to the Citadel. Verify the machinery supporting the collective.</p>
          </header>
          <div className="hb-system-grid">
            {systems.map((system) => (
              <article className={`hb-system-card ${system.note ? 'hb-system-card-featured' : ''}`} key={system.title}>
                <div className="hb-card-top"><span>{system.index}</span><span><i />{system.status}</span></div>
                <h3>{system.title}</h3>
                <strong>{system.command}</strong>
                <p>{system.body}</p>
                {system.note && <aside><b>WHY THIS BRIDGE REMAINS</b>{system.note}</aside>}
                <Link href={system.href}>{system.action} <span>→</span></Link>
              </article>
            ))}
          </div>
        </section>

        <section className="hb-console" id="keyholder-console" aria-labelledby="console-title">
          <div>
            <p className="hb-eyebrow">KEYHOLDER ACCESS // READ-ONLY</p>
            <h2 id="console-title">Reveal your position in the Grid.</h2>
            <p>Inspect Genesis and Exodus Keys, Trait Points, unlocked roles and recorded Phantom Rewards. No wallet connection, signature or transaction required.</p>
          </div>
          <div className="hb-console-form" aria-label="Preview of the Keyholder wallet console">
            <label>WALLET ADDRESS</label>
            <div><span>0x...</span><Link href="/">OPEN LIVE CONSOLE</Link></div>
            <small>The existing Keyholder Console remains live on the current homepage during this beta.</small>
          </div>
        </section>

        <section className="hb-lore" aria-labelledby="lore-title">
          <div className="hb-lore-index"><span>ORIGIN TRANSMISSION</span><b>01</b></div>
          <div className="hb-lore-copy">
            <p className="hb-eyebrow">AFTER THE TRUNCATION</p>
            <h2 id="lore-title">A rebellion encoded in Keys.</h2>
            <div className="hb-lore-columns">
              <p>The Truncation fractured the old world. Knowledge became permissioned. Markets became instruments of control. The Syndicate watched everything while revealing nothing.</p>
              <p>In the shadows, 555 Genesis Keys reached the first architects of another network. Each carried encoded traits, influence and a place in the rebellion.</p>
              <p>The Great Digital Exodus opened the Grid to a wider force of Keyholders. What began as a signal became a functioning collective: governed through participation and made accountable through infrastructure anyone can inspect.</p>
            </div>
            <blockquote>The rebellion is expressed through real tools, public records, governance and transparent operating systems.</blockquote>
          </div>
        </section>

        <section className="hb-provenance" aria-labelledby="provenance-title">
          <div className="hb-provenance-copy">
            <p className="hb-eyebrow">BUILT FROM BUILDER CULTURE</p>
            <h2 id="provenance-title">The network behind the network.</h2>
            <p>Grid Phantoms did not begin as a brand extension. It emerged from builders inside the Neo Tokyo Citizen ecosystem: people connected by composable identity, collaborative experimentation and the expectation that members should build useful things for one another.</p>
            <p>That builder network created the conditions for Grid Phantoms to form. Many early Keyholders were Citizens, and the project continues that tradition through intelligence, market tools and transparent infrastructure serving the Grid while preserving a living bridge to the Citadel.</p>
          </div>
          <div className="hb-bytes-card">
            <div className="hb-bytes-orbit"><span>$</span><strong>BYTES</strong></div>
            <p className="hb-eyebrow">WHY $BYTES</p>
            <h3>An existing signal, adopted by the Grid.</h3>
            <p>Rather than mint another token, Grid Phantoms adopted a utility asset already understood by many of its earliest builders. `$BYTES` connects participation, modeled utility and potential Phantom Rewards across Grid systems while remaining part of the wider Neo Tokyo economy.</p>
            <Link href="/bytes">INSPECT $BYTES →</Link>
          </div>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}
