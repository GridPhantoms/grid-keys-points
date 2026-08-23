import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const rootPagePath = new URL('../app/page.tsx', import.meta.url);
const betaPagePath = new URL('../app/beta/grid-home-0823/page.tsx', import.meta.url);
const homePath = new URL('../app/components/GridHome.tsx', import.meta.url);
const consolePath = new URL('../app/components/KeyholderConsole.tsx', import.meta.url);
const navPath = new URL('../app/components/SiteNav.tsx', import.meta.url);
const cssPath = new URL('../app/beta/grid-home-0823/home-beta.css', import.meta.url);

test('public homepage promotes the shared Grid homepage while beta remains noindexed', async () => {
  const [root, beta, home] = await Promise.all([
    readFile(rootPagePath, 'utf8'),
    readFile(betaPagePath, 'utf8'),
    readFile(homePath, 'utf8'),
  ]);
  assert.doesNotMatch(root, /'use client'/);
  assert.match(root, /<GridHome \/>/);
  assert.match(root, /Grid Phantoms \| Keyholder Governance, Intelligence and Utility/);
  assert.match(beta, /robots: \{ index: false, follow: false, nocache: true \}/);
  assert.match(beta, /<GridHome beta \/>/);
  assert.match(home, /beta \? .*hb-preview-bar/);
  assert.match(home, /<KeyholderConsole \/>/);
});

test('universal navigation ends Engine Room, BYTES Terminal, Citizen Interlink', async () => {
  const nav = await readFile(navPath, 'utf8');
  const engine = nav.indexOf("label: 'Engine Room'");
  const bytes = nav.indexOf("label: '$BYTES Terminal'");
  const citizen = nav.indexOf("label: 'Citizen Interlink'");
  assert.ok(engine > -1 && engine < bytes && bytes < citizen);
});

test('integrated Keyholder Console preserves live lookup, plain-English metrics, and shared season art', async () => {
  const source = await readFile(consolePath, 'utf8');
  assert.match(source, /'use client'/);
  assert.match(source, /\/api\/wallet-keys\?owner=/);
  assert.match(source, /Lifetime Phantom Rewards/i);
  assert.match(source, /TOTAL POINT SUM/);
  assert.match(source, /ROLES UNLOCKED/);
  assert.match(source, /GENESIS KEYS/);
  assert.match(source, /EXODUS KEYS/);
  assert.match(source, /GENESIS_IMAGE/);
  assert.match(source, /EXODUS_IMAGE/);
  assert.match(source, /GENESIS_IMAGE = "\/key-art\/genesis\.webp"/);
  assert.match(source, /EXODUS_IMAGE = "\/key-art\/exodus\.webp"/);
  assert.doesNotMatch(source, /i\.imgur\.com/);
  assert.match(source, /No wallet connection, signature or transaction required/);
});

test('integrated console has responsive result and card styling', async () => {
  const css = await readFile(cssPath, 'utf8');
  assert.match(css, /\.kh-results/);
  assert.match(css, /\.kh-summary-grid/);
  assert.match(css, /\.kh-key-grid/);
  assert.match(css, /@media \(max-width: 700px\)/);
});
