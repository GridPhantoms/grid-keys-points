import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';
import test from 'node:test';

const pagePath = new URL('../app/beta/grid-home-0823/page.tsx', import.meta.url);
const cssPath = new URL('../app/beta/grid-home-0823/home-beta.css', import.meta.url);

test('homepage beta stays unlisted, noindex, and independent in its hero positioning', async () => {
  const page = await readFile(pagePath, 'utf8');
  assert.match(page, /robots: \{ index: false, follow: false, nocache: true \}/);
  assert.match(page, /THE REBELLION IS ALREADY IN MOTION/);
  assert.match(page, /Hold the Keys\.<br \/>Read the Grid\.<br \/><em>Shape what comes next\.<\/em>/);
  assert.match(page, /an onchain collective of Keyholders building transparent tools/);
  const hero = page.slice(page.indexOf('<section className="hb-hero">'), page.indexOf('<section className="hb-governance"'));
  assert.doesNotMatch(hero, /Neo Tokyo|Citizen ecosystem/);
  assert.match(hero, /Through Grid Labs AI, Sakura extends that mission as the Grid&apos;s agentic interface/);
  assert.match(hero, /href="#governance-signal"/);
  assert.match(hero, /id="governance-signal"/);
  assert.doesNotMatch(hero, /interface<\/b>—helping/);
});

test('homepage beta makes voting central without guaranteeing rewards', async () => {
  const page = await readFile(pagePath, 'utf8');
  assert.match(page, /Voting is not ornament/);
  assert.match(page, /Grid Cycles turn Keyholder participation into a visible governing rhythm/);
  assert.match(page, /discretionary potential Phantom Rewards/);
  assert.match(page, /No outcome or distribution is guaranteed/);
  assert.doesNotMatch(page, /guaranteed rewards|guaranteed returns/i);
});

test('homepage beta orders systems as Engine Room, BYTES Terminal, Citizen Interlink', async () => {
  const page = await readFile(pagePath, 'utf8');
  const engine = page.indexOf("title: 'Engine Room'");
  const bytes = page.indexOf("title: '$BYTES Terminal'");
  const citizen = page.indexOf("title: 'Citizen Interlink'");
  assert.ok(engine > -1 && engine < bytes && bytes < citizen);
  assert.match(page, /Track Grid Phantoms' adopted utility token/);
  assert.match(page, /Follow the Vault, vote participation, verified Phantom Reward distribution history/);
  assert.match(page, /Decode the Citizens\./);
});

test('homepage beta explains the Citizen bridge and uses Great Digital Exodus lore', async () => {
  const page = await readFile(pagePath, 'utf8');
  assert.match(page, /A living bridge to the Citadel/);
  assert.match(page, /WHY THIS BRIDGE REMAINS/);
  assert.match(page, /Great Digital Exodus/);
  assert.match(page, /builders inside the Neo Tokyo Citizen ecosystem/);
  assert.match(page, /Rather than mint another token, Grid Phantoms adopted a utility asset/);
  assert.match(page, /Many early Keyholders are Citizens/);
  assert.doesNotMatch(page, /`\$BYTES`/);
});

test('homepage beta gives Sakura a practical bounded agentic role', async () => {
  const [page, css] = await Promise.all([readFile(pagePath, 'utf8'), readFile(cssPath, 'utf8')]);
  assert.match(page, /<span>GRID LABS AI<\/span><span>AGENTIC SUPPORT<\/span>/);
  assert.match(page, /FOR THE WHOLE GRID/);
  assert.match(page, /LP intelligence, maintains voting tabulations, prepares reward files for human approval/);
  assert.match(page, /SUBSCRIBER ACCESS/);
  assert.match(page, /Inside Discord, subscribers can access additional direct agentic support/);
  assert.match(page, /<span><b>BUILD<\/b>Insight → Utility<\/span>/);
  assert.doesNotMatch(page, /Turn insight into utility/);
  assert.match(page, /Human decisions, permissions and execution remain with Keyholders/);
  assert.match(css, /\.hb-sakura-labels span \{[^}]*background: rgba\(2, 7, 9, \.9\)/);
});

test('homepage beta uses supplied lore imagery and remains responsive', async () => {
  const [page, css] = await Promise.all([readFile(pagePath, 'utf8'), readFile(cssPath, 'utf8')]);
  const images = ['hero-vote.webp', 'governance-assembly.webp', 'vote-interface.webp', 'sakura-ai-wide.webp', 'grid-portal.webp', 'bytes-city.webp', 'exodus-keycard.webp'];
  for (const image of images) {
    assert.match(page, new RegExp(image.replace('.', '\\.')));
    await access(new URL(`../public/home-beta/${image}`, import.meta.url));
  }
  for (const href of ['/bytes', '/citizen', '/engine', '/']) assert.match(page, new RegExp(`href: '${href}'|href="${href}"`));
  assert.match(page, /SiteNav active="home"/);
  assert.match(page, /<SiteFooter \/>/);
  assert.match(css, /@media \(max-width: 980px\)/);
  assert.match(css, /@media \(max-width: 700px\)/);
  assert.match(css, /\.hb-hero-art \{[^}]*background: #071015 url\('\/home-beta\/hero-vote\.webp'\) 50% 50% \/ cover no-repeat/);
  assert.match(css, /grid-template-columns: \.82fr 1\.18fr/);
  assert.match(css, /object-position: 18% center/);
});

test('homepage beta closes with a clear Exodus mint path', async () => {
  const page = await readFile(pagePath, 'utf8');
  assert.match(page, /THE GREAT DIGITAL EXODUS CONTINUES/);
  assert.match(page, /Join the Rebellion\./);
  assert.match(page, /MINT EXODUS KEYS<\/a>/);
  assert.match(page, /https:\/\/manifold\.xyz\/@gridphantoms\/id\/4067746032/);
  assert.match(page, /Key ownership does not guarantee rewards, distributions or financial return/);
});
