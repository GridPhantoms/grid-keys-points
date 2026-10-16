export const CREDITS_CONTRACT = '0x97630aa70ab14ed9883b41dafccbc11349723043';
export const STATEMENTS_CONTRACT = '0x75edd94b7e49b3bd5c8047b91f165a5e265a069b';
export const ORIGINAL_CREDITS_SUPPLY = 122_154;
export const BENCHMARK_SAMPLE_SIZE = 5;
export const BENCHMARK_MIN_SAMPLE_SIZE = 2;

type UnknownRecord = Record<string, unknown>;

export type OwnedCredit = {
  tokenId: number;
  creditRating: number;
  officialRank: number;
};

export type OwnedStatement = {
  tokenId: number;
  format: string;
  stage: string;
  credits: number;
  layers: number;
  creditRating: number;
};

export type VerifiedAsk = {
  tokenId: number;
  creditRating: number;
  priceEth: number;
};

export type AskBenchmark = {
  sampleTokenIds: number[];
  lowEthPer1kCr: number;
  midEthPer1kCr: number;
  highEthPer1kCr: number;
};

function record(value: unknown): UnknownRecord | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value) ? value as UnknownRecord : null;
}

function positiveNumber(value: unknown) {
  if (value === null || value === undefined || value === '' || typeof value === 'boolean') return null;
  const number = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(number) && number > 0 ? number : null;
}

export function normalizeOwnedNftPage(payload: unknown, expectedContract: string) {
  const source = record(payload);
  if (!source || !Array.isArray(source.nfts)) throw new Error('OpenSea ownership page is malformed');
  const normalizedContract = expectedContract.toLowerCase();
  const tokenIds = source.nfts.map((value) => {
    const nft = record(value);
    if (!nft) throw new Error('OpenSea ownership item is malformed');
    if (String(nft.contract).toLowerCase() !== normalizedContract) throw new Error('Owned NFT contract is invalid');
    if (String(nft.token_standard).toLowerCase() !== 'erc721') throw new Error('Owned NFT is not ERC-721');
    if (typeof nft.identifier !== 'string' || !/^[1-9]\d*$/.test(nft.identifier)) {
      throw new Error('Owned NFT identifier is invalid');
    }
    const tokenId = Number(nft.identifier);
    if (!Number.isSafeInteger(tokenId) || tokenId < 1 || tokenId > ORIGINAL_CREDITS_SUPPLY) {
      throw new Error('Owned NFT identifier is outside the CREDITS supply');
    }
    if (Array.isArray(nft.owners) && nft.owners.length > 0) {
      const quantities = nft.owners.map((owner) => positiveNumber(record(owner)?.quantity));
      if (quantities.some((quantity) => quantity !== 1)) throw new Error('Owned NFT quantity is invalid');
    }
    return tokenId;
  });
  if (new Set(tokenIds).size !== tokenIds.length) throw new Error('OpenSea ownership page contains duplicate tokens');
  const next = source.next === null || source.next === undefined || source.next === ''
    ? null
    : typeof source.next === 'string' ? source.next : null;
  if (source.next !== null && source.next !== undefined && source.next !== '' && next === null) {
    throw new Error('OpenSea ownership cursor is malformed');
  }
  return { tokenIds, next };
}

export function normalizeCreditDetail(payload: unknown, expectedTokenId: number): OwnedCredit {
  const source = record(payload);
  const tokenId = positiveNumber(source?.id);
  const creditRating = positiveNumber(source?.score);
  const officialRank = positiveNumber(source?.rank);
  if (!Number.isSafeInteger(tokenId) || tokenId !== expectedTokenId) throw new Error('Official rating identity does not match');
  if (!creditRating) throw new Error('Official Credit Rating is unavailable');
  if (!Number.isSafeInteger(officialRank) || officialRank! > ORIGINAL_CREDITS_SUPPLY) {
    throw new Error('Official rank is invalid');
  }
  return { tokenId: tokenId!, creditRating, officialRank: officialRank! };
}

export function normalizeRatedWalletPage(payload: unknown) {
  const source = record(payload);
  if (!source || !Array.isArray(source.items)) throw new Error('Official wallet rating page is malformed');
  const credits = source.items.map((value) => {
    const item = record(value);
    const tokenId = positiveNumber(item?.id);
    if (!Number.isSafeInteger(tokenId) || tokenId! > ORIGINAL_CREDITS_SUPPLY) {
      throw new Error('Official wallet rating identity is invalid');
    }
    return normalizeCreditDetail(value, tokenId!);
  });
  if (new Set(credits.map((credit) => credit.tokenId)).size !== credits.length) {
    throw new Error('Official wallet rating page contains duplicate tokens');
  }
  const next = source.next === null || source.next === undefined || source.next === ''
    ? null
    : typeof source.next === 'string' ? source.next : null;
  if (source.next !== null && source.next !== undefined && source.next !== '' && next === null) {
    throw new Error('Official wallet rating cursor is malformed');
  }
  return { credits, next };
}

export function selectHighestRatedCredits<T extends OwnedCredit>(credits: T[], limit: number) {
  if (!Number.isSafeInteger(limit) || limit < 1) throw new Error('Displayed CREDIT limit is invalid');
  return [...credits]
    .sort((a, b) => a.officialRank - b.officialRank || a.tokenId - b.tokenId)
    .slice(0, limit);
}

export function buildAskBenchmark(listings: VerifiedAsk[]): AskBenchmark {
  const normalized = listings.map((listing) => {
    if (!Number.isSafeInteger(listing.tokenId) || listing.tokenId < 1
      || !Number.isFinite(listing.creditRating) || listing.creditRating <= 0
      || !Number.isFinite(listing.priceEth) || listing.priceEth <= 0) {
      throw new Error('Verified listing input is invalid');
    }
    return { ...listing, ethPer1kCr: listing.priceEth / (listing.creditRating / 1_000) };
  });
  normalized.sort((a, b) => a.ethPer1kCr - b.ethPer1kCr || a.tokenId - b.tokenId);
  if (normalized.length < BENCHMARK_MIN_SAMPLE_SIZE) {
    throw new Error('At least two verified listings are required for an appraisal benchmark');
  }
  const sample = normalized.slice(0, BENCHMARK_SAMPLE_SIZE);
  const middle = Math.floor(sample.length / 2);
  const midEthPer1kCr = sample.length % 2 === 1
    ? sample[middle].ethPer1kCr
    : (sample[middle - 1].ethPer1kCr + sample[middle].ethPer1kCr) / 2;
  return {
    sampleTokenIds: sample.map((item) => item.tokenId),
    lowEthPer1kCr: sample[0].ethPer1kCr,
    midEthPer1kCr,
    highEthPer1kCr: sample.at(-1)!.ethPer1kCr,
  };
}

function rounded(value: number, digits = 12) {
  return Number(value.toFixed(digits));
}

function floorProtectedBand(creditRating: number, benchmark: AskBenchmark, floorEth: number) {
  const estimateFromRate = creditRating / 1_000 * benchmark.midEthPer1kCr;
  return {
    crEstimateEth: rounded(estimateFromRate),
    estimateEth: rounded(Math.max(estimateFromRate, floorEth)),
    rangeLowEth: rounded(Math.max(creditRating / 1_000 * benchmark.lowEthPer1kCr, floorEth)),
    rangeHighEth: rounded(Math.max(creditRating / 1_000 * benchmark.highEthPer1kCr, floorEth)),
    floorApplied: estimateFromRate < floorEth,
  };
}

export function buildWalletAppraisal(input: {
  wallet: string;
  ens: string | null;
  credits: OwnedCredit[];
  statements?: OwnedStatement[];
  benchmark: AskBenchmark;
  statementBenchmark?: AskBenchmark | null;
  creditFloorEth: number;
  statementFloorEth?: number | null;
  ethUsd: number;
  capturedAt: string;
}) {
  if (!/^0x[0-9a-fA-F]{40}$/.test(input.wallet)) throw new Error('Wallet address is invalid');
  if (!Number.isFinite(input.ethUsd) || input.ethUsd <= 0) throw new Error('ETH-USD price is unavailable');
  if (!Number.isFinite(input.creditFloorEth) || input.creditFloorEth <= 0) throw new Error('CREDITS floor is unavailable');
  if (!Number.isFinite(Date.parse(input.capturedAt))) throw new Error('Appraisal timestamp is invalid');
  const tokenIds = new Set<number>();
  const credits = input.credits.map((credit) => {
    if (tokenIds.has(credit.tokenId)) throw new Error('Owned CREDITS contain a duplicate token');
    tokenIds.add(credit.tokenId);
    if (!Number.isFinite(credit.creditRating) || credit.creditRating <= 0
      || !Number.isSafeInteger(credit.officialRank) || credit.officialRank <= 0) {
      throw new Error('Owned CREDITS metadata is incomplete');
    }
    const band = floorProtectedBand(credit.creditRating, input.benchmark, input.creditFloorEth);
    return {
      ...credit,
      ...band,
      estimateUsd: rounded(band.estimateEth * input.ethUsd),
      url: `https://opensea.io/assets/ethereum/${CREDITS_CONTRACT}/${credit.tokenId}`,
    };
  }).sort((a, b) => a.officialRank - b.officialRank || a.tokenId - b.tokenId);
  const totalCr = rounded(credits.reduce((sum, credit) => sum + credit.creditRating, 0), 4);
  const estimateEth = rounded(credits.reduce((sum, credit) => sum + credit.estimateEth, 0));
  const rangeLowEth = rounded(credits.reduce((sum, credit) => sum + credit.rangeLowEth, 0));
  const rangeHighEth = rounded(credits.reduce((sum, credit) => sum + credit.rangeHighEth, 0));

  const ownedStatements = input.statements ?? [];
  if (ownedStatements.length > 0 && !input.statementBenchmark) {
    throw new Error('Statement-market benchmark is unavailable');
  }
  if (ownedStatements.length > 0 && (!input.statementFloorEth || !Number.isFinite(input.statementFloorEth))) {
    throw new Error('Statement floor is unavailable');
  }
  const statementTokenIds = new Set<number>();
  const statements = ownedStatements.map((statement) => {
    if (statementTokenIds.has(statement.tokenId)) throw new Error('Owned Statements contain a duplicate token');
    statementTokenIds.add(statement.tokenId);
    if (!Number.isSafeInteger(statement.tokenId) || statement.tokenId < 0
      || typeof statement.format !== 'string' || statement.format.length === 0
      || typeof statement.stage !== 'string' || statement.stage.length === 0
      || !Number.isSafeInteger(statement.credits) || statement.credits <= 0
      || !Number.isSafeInteger(statement.layers) || statement.layers <= 0
      || statement.credits !== statement.layers * 80
      || !Number.isFinite(statement.creditRating) || statement.creditRating <= 0) {
      throw new Error('Owned Statement metadata is incomplete');
    }
    const band = floorProtectedBand(statement.creditRating, input.statementBenchmark!, input.statementFloorEth!);
    return {
      ...statement,
      ...band,
      estimateUsd: rounded(band.estimateEth * input.ethUsd),
      url: `https://opensea.io/assets/ethereum/${STATEMENTS_CONTRACT}/${statement.tokenId}`,
    };
  }).sort((a, b) => b.creditRating - a.creditRating || a.tokenId - b.tokenId);
  const statementTotalCr = rounded(statements.reduce((sum, statement) => sum + statement.creditRating, 0), 4);
  const statementEstimateEth = statements.length > 0
    ? rounded(statements.reduce((sum, statement) => sum + statement.estimateEth, 0))
    : 0;
  const statementRangeLowEth = statements.length > 0
    ? rounded(statements.reduce((sum, statement) => sum + statement.rangeLowEth, 0))
    : 0;
  const statementRangeHighEth = statements.length > 0
    ? rounded(statements.reduce((sum, statement) => sum + statement.rangeHighEth, 0))
    : 0;
  const portfolioTotalCr = rounded(totalCr + statementTotalCr, 4);
  const portfolioEstimateEth = rounded(estimateEth + statementEstimateEth);
  const portfolioRangeLowEth = rounded(rangeLowEth + statementRangeLowEth);
  const portfolioRangeHighEth = rounded(rangeHighEth + statementRangeHighEth);

  return {
    wallet: input.wallet,
    ens: input.ens,
    capturedAt: input.capturedAt,
    ethUsd: input.ethUsd,
    benchmark: input.benchmark,
    statementBenchmark: input.statementBenchmark ?? null,
    floors: {
      creditEth: input.creditFloorEth,
      statementEth: input.statementFloorEth ?? null,
    },
    summary: {
      count: credits.length,
      totalCr,
      estimateEth,
      estimateUsd: rounded(estimateEth * input.ethUsd),
      rangeLowEth,
      rangeHighEth,
      rangeLowUsd: rounded(rangeLowEth * input.ethUsd),
      rangeHighUsd: rounded(rangeHighEth * input.ethUsd),
    },
    statementSummary: {
      count: statements.length,
      totalCr: statementTotalCr,
      estimateEth: statementEstimateEth,
      estimateUsd: rounded(statementEstimateEth * input.ethUsd),
      rangeLowEth: statementRangeLowEth,
      rangeHighEth: statementRangeHighEth,
      rangeLowUsd: rounded(statementRangeLowEth * input.ethUsd),
      rangeHighUsd: rounded(statementRangeHighEth * input.ethUsd),
    },
    portfolio: {
      assetCount: credits.length + statements.length,
      totalCr: portfolioTotalCr,
      estimateEth: portfolioEstimateEth,
      estimateUsd: rounded(portfolioEstimateEth * input.ethUsd),
      rangeLowEth: portfolioRangeLowEth,
      rangeHighEth: portfolioRangeHighEth,
      rangeLowUsd: rounded(portfolioRangeLowEth * input.ethUsd),
      rangeHighUsd: rounded(portfolioRangeHighEth * input.ethUsd),
    },
    credits,
    statements,
    methodology: 'Loose CREDITS and Statements use separate ask-based CR replacement benchmarks, each drawn from up to five of the lowest currently verified ETH-per-1K-CR listings. Every asset uses the greater of its CR-rate estimate or a directly verified floor benchmark. Portfolio totals sum those per-asset estimates and do not model order-book depth or slippage. Results are not bids, guaranteed sale prices, or liquidation values.',
  };
}
