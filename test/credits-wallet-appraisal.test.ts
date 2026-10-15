import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import {
  buildAskBenchmark,
  buildWalletAppraisal,
  normalizeCreditDetail,
  normalizeOwnedNftPage,
} from '../lib/credits-wallet-appraisal.ts';

const CREDITS_CONTRACT = '0x97630aa70ab14ed9883b41dafccbc11349723043';

function ownedNft(identifier: string, overrides: Record<string, unknown> = {}) {
  return {
    identifier,
    collection: 'credits',
    contract: CREDITS_CONTRACT,
    token_standard: 'erc721',
    owners: [{ address: '0x77ed0a365256dd515c6899f24ac0d8bbf29245e6', quantity: 1 }],
    ...overrides,
  };
}

test('owned CREDITS pages accept only canonical ERC-721 holdings from the expected contract', () => {
  const page = normalizeOwnedNftPage({
    nfts: [ownedNft('12'), ownedNft('99', { owners: undefined })],
    next: 'cursor-2',
  }, CREDITS_CONTRACT);

  assert.deepEqual(page, { tokenIds: [12, 99], next: 'cursor-2' });
  assert.throws(() => normalizeOwnedNftPage({ nfts: [ownedNft('012')], next: null }, CREDITS_CONTRACT), /identifier/i);
  assert.throws(() => normalizeOwnedNftPage({ nfts: [ownedNft('12', { contract: '0x0000000000000000000000000000000000000001' })] }, CREDITS_CONTRACT), /contract/i);
  assert.throws(() => normalizeOwnedNftPage({ nfts: [ownedNft('12', { token_standard: 'erc1155' })] }, CREDITS_CONTRACT), /ERC-721/i);
  assert.throws(() => normalizeOwnedNftPage({ nfts: [ownedNft('12', { owners: [{ quantity: 2 }] })] }, CREDITS_CONTRACT), /quantity/i);
});

test('official detail normalization validates token identity, score and rank', () => {
  assert.deepEqual(normalizeCreditDetail({ id: 12, score: 654.5233, rank: 24857 }, 12), {
    tokenId: 12,
    creditRating: 654.5233,
    officialRank: 24857,
  });
  assert.throws(() => normalizeCreditDetail({ id: 13, score: 654.5233, rank: 24857 }, 12), /identity/i);
  assert.throws(() => normalizeCreditDetail({ id: 12, score: 0, rank: 24857 }, 12), /rating/i);
  assert.throws(() => normalizeCreditDetail({ id: 12, score: 654.5233, rank: 0 }, 12), /rank/i);
});

test('ask benchmark uses a deterministic five-listing normalized band', () => {
  const benchmark = buildAskBenchmark([
    { tokenId: 8, creditRating: 800, priceEth: 0.048 },
    { tokenId: 2, creditRating: 500, priceEth: 0.0275 },
    { tokenId: 4, creditRating: 1000, priceEth: 0.058 },
    { tokenId: 1, creditRating: 1000, priceEth: 0.05 },
    { tokenId: 6, creditRating: 600, priceEth: 0.0324 },
    { tokenId: 9, creditRating: 900, priceEth: 0.09 },
  ]);

  assert.deepEqual(benchmark.sampleTokenIds, [1, 6, 2, 4, 8]);
  assert.equal(benchmark.lowEthPer1kCr, 0.05);
  assert.equal(benchmark.midEthPer1kCr, 0.055);
  assert.equal(benchmark.highEthPer1kCr, 0.06);
  assert.throws(() => buildAskBenchmark([
    { tokenId: 1, creditRating: 1000, priceEth: 0.05 },
  ]), /two verified listings/i);
  const thin = buildAskBenchmark([
    { tokenId: 1, creditRating: 1000, priceEth: 0.05 },
    { tokenId: 2, creditRating: 1000, priceEth: 0.06 },
  ]);
  assert.equal(thin.midEthPer1kCr, 0.055);
});

test('wallet appraisal reports an ask-based range without implying sale proceeds', () => {
  const appraisal = buildWalletAppraisal({
    wallet: '0x77eD0a365256DD515C6899F24ac0D8BBf29245e6',
    ens: null,
    credits: [
      { tokenId: 12, creditRating: 654.5233, officialRank: 24857 },
      { tokenId: 99, creditRating: 800, officialRank: 1 },
    ],
    benchmark: {
      sampleTokenIds: [1, 2, 3, 4, 5],
      lowEthPer1kCr: 0.05,
      midEthPer1kCr: 0.055,
      highEthPer1kCr: 0.06,
    },
    ethUsd: 2500,
    capturedAt: '2026-10-14T17:00:00.000Z',
  });

  assert.equal(appraisal.summary.count, 2);
  assert.equal(appraisal.summary.totalCr, 1454.5233);
  assert.equal(appraisal.summary.estimateEth, 0.0799987815);
  assert.equal(appraisal.summary.rangeLowEth, 0.072726165);
  assert.equal(appraisal.summary.rangeHighEth, 0.087271398);
  assert.equal(appraisal.summary.estimateUsd, 199.99695375);
  assert.deepEqual(appraisal.credits.map((credit) => credit.estimateEth), [0.044, 0.0359987815]);
});

test('wallet appraisal includes Statement-market CR estimates in the portfolio total', () => {
  const appraisal = buildWalletAppraisal({
    wallet: '0x0B5Bfb355f553a267460BB4Cb1c768A8d4940687',
    ens: '690069.eth',
    credits: [],
    statements: [{
      tokenId: 91,
      format: 'Issued',
      stage: 'BASE',
      credits: 80,
      layers: 1,
      creditRating: 54_274,
    }],
    benchmark: {
      sampleTokenIds: [1, 2, 3, 4, 5],
      lowEthPer1kCr: 0.05,
      midEthPer1kCr: 0.055,
      highEthPer1kCr: 0.06,
    },
    statementBenchmark: {
      sampleTokenIds: [194, 49, 105, 199, 168],
      lowEthPer1kCr: 0.05475829099148585,
      midEthPer1kCr: 0.05860999773122589,
      highEthPer1kCr: 0.06831092255698569,
    },
    ethUsd: 2368.38,
    capturedAt: '2026-10-15T02:23:48.730Z',
  });

  assert.equal(appraisal.statements.length, 1);
  assert.equal(appraisal.statements[0].estimateEth, 3.180999016865);
  assert.equal(appraisal.statementSummary.totalCr, 54_274);
  assert.equal(appraisal.statementSummary.rangeLowEth, 2.971951485272);
  assert.equal(appraisal.statementSummary.rangeHighEth, 3.707507010858);
  assert.equal(appraisal.portfolio.totalCr, 54_274);
  assert.equal(appraisal.portfolio.estimateEth, 3.180999016865);
  assert.equal(appraisal.portfolio.estimateUsd, 7533.814451562729);
});

test('private prototype stays unlinked, unindexed and does not persist wallet input', async () => {
  const [page, client, route, header, sitemap, openGraphImage] = await Promise.all([
    readFile(new URL('../app/credits/wallet-lab-41eff0a315b4/page.tsx', import.meta.url), 'utf8'),
    readFile(new URL('../app/credits/wallet-lab-41eff0a315b4/WalletLab.tsx', import.meta.url), 'utf8'),
    readFile(new URL('../app/api/credits/wallet-lab-41eff0a315b4/route.ts', import.meta.url), 'utf8'),
    readFile(new URL('../app/credits/CreditsHeader.tsx', import.meta.url), 'utf8'),
    readFile(new URL('../app/sitemap.ts', import.meta.url), 'utf8'),
    readFile(new URL('../app/credits/wallet-lab-41eff0a315b4/opengraph-image.tsx', import.meta.url), 'utf8'),
  ]);
  assert.match(page, /index:\s*false/);
  assert.match(page, /referrer:\s*'no-referrer'/);
  assert.match(page, /openGraph:/);
  assert.match(page, /twitter:/);
  assert.match(page, /\/credits\/wallet-lab-41eff0a315b4\/opengraph-image/);
  assert.match(openGraphImage, /APPRAISE YOUR/);
  assert.match(openGraphImage, /CREDITS WALLET\./);
  assert.match(openGraphImage, /LOOSE/);
  assert.match(openGraphImage, /STATEMENTS/);
  assert.match(openGraphImage, /NO CONNECT/);
  assert.doesNotMatch(openGraphImage, /0x[a-fA-F0-9]{40}|690069\.eth|\d+\.\d+\s*ETH/);
  assert.match(route, /private, no-store/);
  assert.match(route, /X-Robots-Tag/);
  assert.doesNotMatch(client, /localStorage|sessionStorage|document\.cookie|walletconnect/i);
  assert.doesNotMatch(header, /wallet-lab-41eff0a315b4/);
  assert.doesNotMatch(sitemap, /wallet-lab-41eff0a315b4/);
});
