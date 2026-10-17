#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const manifestPath = path.join(root, 'data', 'credits-yellow-patterns.json');
const outputDir = path.join(root, 'public', 'images', 'credits');
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));

const TILE = 36;
const GAP = 5;
const INSET = 2;
const CELL = 2;

function occupiedCells(mask) {
  const value = BigInt(`0x${mask}`);
  const cells = [];
  for (let index = 0; index < 1024; index += 1) {
    if (((value >> BigInt(index)) & 1n) === 1n) cells.push([index % 32, Math.floor(index / 32)]);
  }
  return cells;
}

function render(items, outputName) {
  const width = items.length * TILE + (items.length - 1) * GAP;
  const groups = items.map((item, slot) => {
    const cells = occupiedCells(item.mask);
    const [left, top, right, bottom] = item.bbox;
    const occupiedWidth = right - left;
    const occupiedHeight = bottom - top;
    const artWidth = occupiedWidth * CELL;
    const artHeight = occupiedHeight * CELL;
    const offsetX = slot * (TILE + GAP) + INSET + (TILE - INSET * 2 - artWidth) / 2;
    const offsetY = INSET + (TILE - INSET * 2 - artHeight) / 2;
    const pathData = cells.map(([x, y]) => `M${offsetX + (x - left) * CELL} ${offsetY + (y - top) * CELL}h${CELL}v${CELL}h-${CELL}z`).join('');
    return `<path data-token-id="${item.tokenId}" d="${pathData}"/>`;
  }).join('');
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${TILE}" fill="${manifest.yellow}" shape-rendering="crispEdges" aria-hidden="true">${groups}</svg>\n`;
  fs.writeFileSync(path.join(outputDir, outputName), svg);
}

if (!Array.isArray(manifest.items) || manifest.items.length !== manifest.desktopCount) {
  throw new Error('Yellow-pattern manifest count does not reconcile');
}
if (!manifest.items.every((item) => item.colors === 'Y' && /^\d+$/.test(String(item.tokenId)) && /^[0-9a-f]+$/i.test(item.mask))) {
  throw new Error('Yellow-pattern manifest contains an invalid item');
}

fs.mkdirSync(outputDir, { recursive: true });
render(manifest.items, 'yellow-pattern-strip-desktop.svg');
render(manifest.items.slice(0, manifest.mobileCount), 'yellow-pattern-strip-mobile.svg');
console.log(`Rendered ${manifest.desktopCount} desktop and ${manifest.mobileCount} mobile yellow CREDITS patterns.`);
