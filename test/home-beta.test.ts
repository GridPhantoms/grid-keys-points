import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const pagePath = new URL('../app/beta/grid-home-0823/page.tsx', import.meta.url);
const cssPath = new URL('../app/beta/grid-home-0823/home-beta.css', import.meta.url);

test('homepage beta stays unlisted, noindex, and independent in its hero positioning', async () => {
  const page = await readFile(pagePath, 'utf8');
  assert.match(page, /robots: \{ index: false, follow: false, nocache: true \}/);
  assert.match(page, /THE REBELLION IS ALREADY IN MOTION/);
  assert.match(page, /Hold the Keys\.<br \/>Read the Grid\.<br \/><em>Shape what comes next\.<\/em>/);
  assert.match(page, /an onchain collective of Keyholders building transparent tools/);
  const hero = page.slice(page.indexOf('<section className="hb-hero">'), page.indexOf('<section className="hb-systems"'));
  assert.doesNotMatch(hero, /Neo Tokyo|Citizen ecosystem/);
});

test('homepage beta explains the Citizen bridge and uses Great Digital Exodus lore', async () => {
  const page = await readFile(pagePath, 'utf8');
  assert.match(page, /A living bridge to the Citadel/);
  assert.match(page, /WHY THIS BRIDGE REMAINS/);
  assert.match(page, /Great Digital Exodus/);
  assert.match(page, /builders inside the Neo Tokyo Citizen ecosystem/);
  assert.match(page, /Rather than mint another token, Grid Phantoms adopted a utility asset/);
  assert.doesNotMatch(page, /guaranteed rewards|guaranteed returns/i);
  assert.match(page, /potential Phantom Rewards/);
});

test('homepage beta links every working system and remains responsive', async () => {
  const [page, css] = await Promise.all([readFile(pagePath, 'utf8'), readFile(cssPath, 'utf8')]);
  for (const href of ['/bytes', '/citizen', '/engine', '/']) assert.match(page, new RegExp(`href: '${href}'|href="${href}"`));
  assert.match(page, /SiteNav active="home"/);
  assert.match(page, /<SiteFooter \/>/);
  assert.match(css, /@media\(max-width:980px\)/);
  assert.match(css, /@media\(max-width:620px\)/);
});
