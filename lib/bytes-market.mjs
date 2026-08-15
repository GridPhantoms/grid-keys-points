import { formatUnits, getAddress } from 'ethers';

const TOKEN_DECIMALS = 18;
const TOKEN_SCALE = 10n ** 18n;
const Q192 = 2n ** 192n;
const PRICE_SCALE = 10n ** 18n;
const MAX_ETH_USD_AGE_SECONDS = 7_200;

function canonicalTimestamp(value, label) {
  if (typeof value !== 'string' || new Date(value).toISOString() !== value) {
    throw new TypeError(`${label} must be a canonical ISO-8601 timestamp`);
  }
  return value;
}

function positiveInteger(value, label) {
  if (!Number.isInteger(value) || value <= 0) throw new TypeError(`${label} must be a positive integer`);
  return value;
}


function exactMetric(rawAmount, unit, classification, source, asOf, formula, assumptions = []) {
  const rawValue = formatUnits(rawAmount, TOKEN_DECIMALS);
  const value = Number(rawValue);
  if (!Number.isFinite(value) || value < 0) throw new TypeError(`${source} must be a finite nonnegative amount`);
  return {
    value,
    rawValue,
    unit,
    classification,
    source,
    asOf: canonicalTimestamp(asOf, 'asOf'),
    availability: 'available',
    formula,
    assumptions,
  };
}

function unavailableMetric(unit, classification, source, asOf, reason) {
  return {
    value: null,
    unit,
    classification,
    source,
    asOf: canonicalTimestamp(asOf, 'asOf'),
    availability: 'unavailable',
    reason,
  };
}

export function verifyAvalancheTokenIdentity(input, expected) {
  try {
    return BigInt(input.chainId) === 43_114n
      && input.name === 'BYTES'
      && input.symbol === 'BYTES'
      && BigInt(input.decimals) === 18n
      && getAddress(input.implementation) === getAddress(expected.implementation)
      && getAddress(input.poolToken) === getAddress(expected.token)
      && input.poolTypeAndVersion === 'BurnMintTokenPool 1.5.1'
      && input.poolHasMinterRole === true
      && input.poolCanSelfBurn === true;
  } catch {
    return false;
  }
}

export function avalancheSupplyMetric({ totalSupply, asOf }) {
  return exactMetric(
    BigInt(totalSupply),
    'BYTES',
    'observed',
    'canonical-avalanche-bytes:totalSupply',
    asOf,
    'chainId == 43114 && proxy implementation, BYTES metadata, pool.getToken(), BurnMintTokenPool version, and MINTER_ROLE linkage verified at one source block; then token.totalSupply()',
    ['Avalanche C-Chain ID 43114', '18 token decimals', 'Chainlink CCIP BurnMint representation; do not add to canonical Ethereum totalSupply'],
  );
}

export function avalancheSupplyUnavailableMetric(asOf, reason = 'Canonical Avalanche BYTES identity could not be verified at the source block.') {
  return unavailableMetric('BYTES', 'observed', 'canonical-avalanche-bytes:identity-gated', asOf, reason);
}

export function marketMetrics({
  ethereumTotalSupply,
  sqrtPriceX96,
  ethUsdAnswer,
  ethUsdDecimals,
  feedUpdatedAt,
  sourceTimestamp,
  asOf,
}) {
  const supply = BigInt(ethereumTotalSupply);
  const sqrtPrice = BigInt(sqrtPriceX96);
  const ethUsd = BigInt(ethUsdAnswer);
  positiveInteger(ethUsdDecimals, 'ethUsdDecimals');
  positiveInteger(feedUpdatedAt, 'feedUpdatedAt');
  positiveInteger(sourceTimestamp, 'sourceTimestamp');
  if (supply < 0n || sqrtPrice <= 0n || ethUsd <= 0n) throw new TypeError('Market inputs must be positive');
  if (feedUpdatedAt > sourceTimestamp + 60) throw new RangeError('ETH/USD feed timestamp is ahead of the source block');
  if (sourceTimestamp - feedUpdatedAt > MAX_ETH_USD_AGE_SECONDS) throw new RangeError('ETH/USD feed is stale');

  // The DEXTools-linked Uniswap V3 pair has BYTES token0 and WETH token1,
  // both with 18 decimals. sqrtPriceX96 therefore squares directly to WETH/BYTES.
  const priceUsdScaled = (sqrtPrice * sqrtPrice * ethUsd * PRICE_SCALE)
    / (Q192 * (10n ** BigInt(ethUsdDecimals)));
  if (priceUsdScaled <= 0n) throw new RangeError('Calculated BYTES price is zero');
  const valuationUsdScaled = (supply * priceUsdScaled) / TOKEN_SCALE;

  return {
    bytesPriceUsd: exactMetric(
      priceUsdScaled,
      'USD/BYTES',
      'calculated',
      'ethereum-uniswap-v3-bytes-weth-plus-chainlink-eth-usd',
      asOf,
      '(Uniswap V3 sqrtPriceX96 / 2^96)^2 WETH/BYTES * Chainlink ETH/USD',
      [
        'DEXTools pair 0xfeb09c7e130a4b87b27ebd648ec485657b688b34',
        'Pair identity, 1% fee tier, Uniswap V3 factory registry, token decimals, deployed code, initialization, and liquidity verified at the source block',
        `Chainlink ETH/USD answer no more than ${MAX_ETH_USD_AGE_SECONDS.toLocaleString('en-US')} seconds old (one-hour heartbeat plus one-hour operational grace)`,
        'Uniswap V3 slot0 spot price from a single liquidity pool; it is not a TWAP, volume-weighted, or slippage-adjusted execution price',
      ],
    ),
    totalSupplyValuationUsd: exactMetric(
      valuationUsdScaled,
      'USD',
      'calculated',
      'canonical-ethereum-total-supply-times-observed-pair-price',
      asOf,
      'canonical Ethereum totalSupply * calculated BYTES/USD price',
      [
        'Uses canonical Ethereum totalSupply once',
        'The verified Avalanche BurnMint supply is a bridge representation and is not added',
        'Displayed publicly as Market Cap* community shorthand; not conventional circulating market capitalization or FDV',
      ],
    ),
  };
}

export function marketMetricsUnavailable(asOf, reason = 'The canonical pair price or Ethereum supply is temporarily unavailable.') {
  return {
    bytesPriceUsd: unavailableMetric('USD/BYTES', 'calculated', 'ethereum-uniswap-v3-bytes-weth-plus-chainlink-eth-usd', asOf, reason),
    totalSupplyValuationUsd: unavailableMetric('USD', 'calculated', 'canonical-ethereum-total-supply-times-observed-pair-price', asOf, reason),
  };
}
