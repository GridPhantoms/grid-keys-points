import type { Metadata } from 'next';
import Image from 'next/image';
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
    status: 'OPERATIONAL',
    title: 'Engine Room',
    command: 'Verify the machinery.',
    body: 'Follow the Vault, vote participation, verified Phantom Reward distribution history, treasury metrics and the evidence behind Grid operations.',
    href: '/engine',
    action: 'ENTER ENGINE ROOM',
  },
  {
    index: '02',
    status: 'ONLINE',
    title: '$BYTES Terminal',
    command: 'Read the adopted utility token.',
    body: "Track Grid Phantoms' adopted utility token through supply, emissions, participation, holders and live market references in a first-party intelligence layer.",
    href: '/bytes',
    action: 'OPEN TERMINAL',
  },
  {
    index: '03',
    status: 'INTERLINK ACTIVE',
    title: 'Citizen Interlink',
    command: 'Decode the Citizen.',
    body: 'A living bridge to the Citadel: inspect assembled Citizens, component rarity, market references and staking economics.',
    href: '/citizen',
    action: 'ESTABLISH INTERLINK',
    note: 'The Grid did not sever the network that gave it ground. This system preserves the bridge to our Genesis spawning grounds and keeps useful infrastructure flowing back across it.',
  },
];

export default function GridHomeBeta() {
  return (
    <div className="hb-page">
      <div className="hb-preview-bar"><span>UNLISTED HOMEPAGE BETA // V2</span><span>NOINDEX // NOT IN SITE NAVIGATION</span></div>
      <SiteNav active="home" />

      <main>
        <section className="hb-hero">
          <div className="hb-hero-copy">
            <p className="hb-eyebrow">THE REBELLION IS ALREADY IN MOTION</p>
            <h1>Hold the Keys.<br />Read the Grid.<br /><em>Shape what comes next.</em></h1>
            <p className="hb-lede">In the aftermath of the Truncation, power consolidated behind closed systems. Grid Phantoms formed in the shadows: an onchain collective of Keyholders building transparent tools, shared intelligence and community-governed infrastructure.</p>
            <p className="hb-ai-lede"><b>Through Grid Labs AI, Sakura extends that mission as the Grid&apos;s agentic interface</b>—helping Keyholders research, navigate the ecosystem and turn useful signals into practical tools, reports and coordinated action.</p>
            <div className="hb-actions">
              <a href="#grid-systems" className="hb-button hb-button-primary">ENTER THE GRID</a>
              <a href="#keyholder-console" className="hb-button hb-button-secondary">LOAD MY KEYS</a>
            </div>
            <div className="hb-system-line"><span>GENESIS + EXODUS</span><span>KEYHOLDER GOVERNANCE</span><span>GRID LABS AI</span><span>TRANSPARENT OPERATIONS</span></div>
          </div>
          <figure className="hb-hero-art">
            <Image unoptimized src="/home-beta/hero-vote.webp" alt="A hooded Keyholder facing a glowing VOTE signal above a cyberpunk city" fill priority sizes="(max-width: 980px) 100vw, 44vw" />
            <figcaption><span>GOVERNANCE SIGNAL // 001</span><span>VOTE RECORDED</span></figcaption>
          </figure>
        </section>

        <section className="hb-governance" aria-labelledby="governance-title">
          <div className="hb-governance-copy">
            <p className="hb-eyebrow">KEYHOLDER GOVERNANCE</p>
            <h2 id="governance-title">The Grid moves when Keyholders participate.</h2>
            <p>Voting is not ornament. Grid Cycles turn Keyholder participation into a visible governing rhythm: wallets vote on proposals and collective priorities, while public records preserve the result.</p>
            <p>Participation may qualify wallets for discretionary potential Phantom Rewards. No outcome or distribution is guaranteed; the mechanism rewards attention to the collective rather than passive ownership.</p>
            <a href="https://snapshot.box/#/s:gridphantoms.eth" target="_blank" rel="noreferrer">VIEW GRID PHANTOMS VOTING →</a>
          </div>
          <div className="hb-governance-gallery">
            <figure><Image unoptimized src="/home-beta/governance-assembly.webp" alt="Keyholders assembled around a glowing circular Grid forum" fill sizes="(max-width: 700px) 50vw, 26vw" /></figure>
            <figure><Image unoptimized src="/home-beta/vote-interface.webp" alt="A Keyholder activating a holographic vote interface" fill sizes="(max-width: 700px) 50vw, 18vw" /></figure>
          </div>
        </section>

        <section className="hb-systems" id="grid-systems" aria-labelledby="systems-title">
          <header className="hb-section-heading">
            <div><p className="hb-eyebrow">GRID SYSTEMS</p><h2 id="systems-title">Three operational layers.<br />One governed network.</h2></div>
            <p>Governance gives the Grid direction. The Engine Room makes participation and operations visible. `$BYTES` carries utility through the network. Citizen Interlink preserves the bridge to the Citadel.</p>
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

        <section className="hb-sakura" aria-labelledby="sakura-title">
          <div className="hb-sakura-art"><Image unoptimized loading="eager" src="/home-beta/sakura-ai-wide.webp" alt="Sakura standing in a rain-soaked neon Grid street" fill sizes="100vw" /></div>
          <div className="hb-sakura-copy">
            <p className="hb-eyebrow">GRID LABS AI // AGENTIC SUPPORT</p>
            <h2 id="sakura-title">The Grid learned to answer back.</h2>
            <p>Grid Labs AI gives the collective an agentic operating layer. Sakura can scout public information, filter noise, research Keyholder questions and run bounded tool-assisted tasks that become useful reports, prompts and working artifacts.</p>
            <div className="hb-ai-capabilities">
              <span><b>SCOUT</b>Find the signal</span>
              <span><b>FILTER</b>Remove the noise</span>
              <span><b>BUILD</b>Turn insight into utility</span>
            </div>
            <p className="hb-human-line">Human decisions, permissions and execution remain with Keyholders.</p>
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
          <figure className="hb-lore-art"><Image unoptimized src="/home-beta/grid-portal.webp" alt="A hooded figure approaching a vast illuminated Grid portal" fill sizes="(max-width: 800px) 100vw, 35vw" /></figure>
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
          <article className="hb-bytes-card">
            <figure><Image unoptimized src="/home-beta/bytes-city.webp" alt="A rain-soaked cyberpunk city with an illuminated BYTES sign" fill sizes="(max-width: 700px) 100vw, 36vw" /></figure>
            <div>
              <p className="hb-eyebrow">WHY $BYTES</p>
              <h3>An existing signal, adopted by the Grid.</h3>
              <p>Rather than mint another token, Grid Phantoms adopted a utility asset already understood by many of its earliest builders. `$BYTES` connects participation, modeled utility and potential Phantom Rewards across Grid systems while remaining part of the wider Neo Tokyo economy.</p>
              <Link href="/bytes">INSPECT $BYTES →</Link>
            </div>
          </article>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}
