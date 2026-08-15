import 'server-only';

import { Contract, FetchRequest, Interface, JsonRpcProvider, formatUnits, getAddress } from 'ethers';
import { unstable_cache } from 'next/cache';
import participantSnapshotValue from '@/data/bytes-staking-participants.json';
import {
  AVALANCHE_BYTES_CCIP_POOL,
  AVALANCHE_BYTES_IMPLEMENTATION,
  AVALANCHE_BYTES_TOKEN_ABI,
  AVALANCHE_BYTES_TOKEN_CONTRACT,
  AVALANCHE_CHAIN_ID,
  AVALANCHE_CHAIN_NAME,
  BYTES_PARTICIPANT_SNAPSHOT_BLOCK,
  BYTES_PARTICIPANT_SNAPSHOT_BLOCK_HASH,
  BYTES_PARTICIPANT_SNAPSHOT_COUNT,
  BYTES_PARTICIPANT_SNAPSHOT_DIGEST,
  BYTES_STAKING_DEPLOYMENT_BLOCK,
  BYTES_POOL_LABELS,
  BYTES_STAKING_ABI,
  BYTES_STAKING_CONTRACT,
  BYTES_TOKEN_ABI,
  BYTES_TOKEN_CONTRACT,
  BYTES_WETH_UNISWAP_V3_POOL,
  BYTES_WETH_UNISWAP_V3_POOL_ABI,
  BytesPool,
  ETHEREUM_CHAIN_ID,
  ETHEREUM_CHAIN_NAME,
  CCIP_BURN_MINT_POOL_ABI,
  CHAINLINK_AGGREGATOR_ABI,
  CHAINLINK_ETH_USD_FEED,
  MULTICALL3_ABI,
  MULTICALL3_CONTRACT,
  UNISWAP_V3_FACTORY,
  UNISWAP_V3_FACTORY_ABI,
  WETH_CONTRACT,
} from '@/lib/bytes-contracts';
import {
  availableMetric,
  assertExpectedChainId,
  configuredEmissionsMetric,
  ethereumRpcUrl,
  FRESHNESS_POLICY,
  hasSuccessfulPoolEmissionRead,
  publicFailurePayload,
  PUBLIC_CACHE_CONTROL,
  signedMetric,
  unavailableMetric,
  withTimeout,
} from '@/lib/bytes-api.mjs';
import {
  canonicalIdentityUnavailableMetrics,
  mergeParticipantAddresses,
  pendingRewardsMetric,
  pendingRewardsUnavailableMetric,
  tokenMetrics,
  validateParticipantSnapshot,
  validatePendingWorkBounds,
  verifyCanonicalTokenLinks,
} from '@/lib/bytes-onchain.mjs';
import {
  avalancheSupplyMetric,
  avalancheSupplyUnavailableMetric,
  marketMetrics,
  marketMetricsUnavailable,
  verifyAvalancheTokenIdentity,
} from '@/lib/bytes-market.mjs';
import {
  emissionAtWeek,
  fractionThroughWeek,
  projectedIssuanceOverDays,
  remainingGeometricIssuance,
  theoreticalWeek,
} from '@/lib/bytes-model.mjs';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const PRIVATE_FAILURE_CACHE_CONTROL = 'private, no-store';
const LIGHTWEIGHT_SNAPSHOT_SECONDS = 900;
const PENDING_SNAPSHOT_SECONDS = 86_400;
const RPC_TRANSPORT_TIMEOUT_MS = 9_000;
const RPC_DEADLINE_MS = 10_000;
const AVALANCHE_RPC_URL = 'https://api.avax.network/ext/bc/C/rpc';
const EIP1967_IMPLEMENTATION_SLOT = '0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc';
const AVALANCHE_BURN_ZERO_CALL_DATA = `0x42966c68${'0'.repeat(64)}`;
const SECONDS_PER_DAY = 86_400;
const VERIFIED_EMISSIONS_EPOCH_SECONDS = 1_686_787_200; // 2023-06-15T00:00:00Z
const STEADY_RESERVOIRS = { S1: 5_500, S2: 375, BYTES: 0, LP: 0 } as const;
const MAXIMUM_PARTICIPATION_RESERVOIR = 11_000;
const POOLS = [BytesPool.S1, BytesPool.S2, BytesPool.BYTES, BytesPool.LP] as const;
const CLAIMABLE_REWARD_POOLS = [BytesPool.S1, BytesPool.S2, BytesPool.LP] as const;
const stakingInterface = new Interface(BYTES_STAKING_ABI);
function eventTopic(name: 'Stake' | 'Claim') {
  const event = stakingInterface.getEvent(name);
  if (!event) throw new Error(`Missing ${name} event ABI`);
  return event.topicHash;
}
const EVENT_TOPICS = [
  eventTopic('Stake'),
  eventTopic('Claim'),
] as const;
const DELTA_LOG_BLOCK_CHUNK = 50_000;
const MAX_DELTA_LOG_EVENTS = 10_000;
const MULTICALL_CHUNK_SIZE = 500;
const MULTICALL_CONCURRENCY = 32;
const PENDING_WORK_LIMITS = Object.freeze({
  maxDeltaBlocks: 250_000,
  maxDeltaLogEvents: MAX_DELTA_LOG_EVENTS,
  maxParticipants: 5_000,
  maxChunks: 32,
});
const participantSnapshot = validateParticipantSnapshot(participantSnapshotValue, {
  contract: BYTES_STAKING_CONTRACT,
  deploymentBlock: BYTES_STAKING_DEPLOYMENT_BLOCK,
  sourceBlock: BYTES_PARTICIPANT_SNAPSHOT_BLOCK,
  sourceBlockHash: BYTES_PARTICIPANT_SNAPSHOT_BLOCK_HASH,
  count: BYTES_PARTICIPANT_SNAPSHOT_COUNT,
  addressesSha256: BYTES_PARTICIPANT_SNAPSHOT_DIGEST,
});
function rpcUrl() {
  return ethereumRpcUrl(process.env);
}

function bytesValue(value: bigint) {
  const parsed = Number(formatUnits(value, 18));
  if (!Number.isFinite(parsed) || parsed < 0) throw new Error('Invalid contract numeric result');
  return parsed;
}

function participantAddressFromLog(log: { topics: readonly string[] }) {
  const topic = log.topics[1];
  if (typeof topic !== 'string' || topic.length !== 66) throw new Error('Malformed participant event');
  return getAddress(`0x${topic.slice(26)}`);
}

async function readDeltaParticipants(provider: JsonRpcProvider, fromBlock: number, toBlock: number) {
  if (fromBlock > toBlock) return [];
  const addressesByLower = new Map<string, string>();
  let rawEventCount = 0;
  for (let start = fromBlock; start <= toBlock; start += DELTA_LOG_BLOCK_CHUNK) {
    const end = Math.min(toBlock, start + DELTA_LOG_BLOCK_CHUNK - 1);
    const logs = await provider.getLogs({
      address: BYTES_STAKING_CONTRACT,
      topics: [[...EVENT_TOPICS]],
      fromBlock: start,
      toBlock: end,
    });
    rawEventCount += logs.length;
    if (rawEventCount > MAX_DELTA_LOG_EVENTS) {
      throw new RangeError(`participant delta event count exceeds ${MAX_DELTA_LOG_EVENTS}`);
    }
    for (const log of logs) {
      const address = participantAddressFromLog(log);
      addressesByLower.set(address.toLowerCase(), address);
      if (addressesByLower.size > PENDING_WORK_LIMITS.maxParticipants) {
        throw new RangeError(`participant delta unique-address count exceeds ${PENDING_WORK_LIMITS.maxParticipants}`);
      }
    }
  }
  return [...addressesByLower.values()].sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()));
}

async function readCanonicalTokenMetrics(provider: JsonRpcProvider, staking: Contract, blockNumber: number, asOf: string) {
  const token = new Contract(BYTES_TOKEN_CONTRACT, BYTES_TOKEN_ABI, provider);
  const [stakingBytes, tokenStaker, decimals, totalSupply, stakingBalance] = await Promise.all([
    staking.BYTES({ blockTag: blockNumber }) as Promise<string>,
    token.STAKER({ blockTag: blockNumber }) as Promise<string>,
    token.decimals({ blockTag: blockNumber }) as Promise<bigint>,
    token.totalSupply({ blockTag: blockNumber }) as Promise<bigint>,
    token.balanceOf(BYTES_STAKING_CONTRACT, { blockTag: blockNumber }) as Promise<bigint>,
  ]);
  if (!verifyCanonicalTokenLinks(stakingBytes, tokenStaker, decimals, {
    tokenContract: BYTES_TOKEN_CONTRACT,
    stakingContract: BYTES_STAKING_CONTRACT,
  })) throw new Error('Canonical token identity mismatch');
  return { metrics: tokenMetrics({ totalSupply, stakingBalance, asOf }), totalSupply };
}

async function readMarketMetrics(provider: JsonRpcProvider, blockNumber: number, blockTimestamp: number, asOf: string, ethereumTotalSupply: bigint) {
  const pair = new Contract(BYTES_WETH_UNISWAP_V3_POOL, BYTES_WETH_UNISWAP_V3_POOL_ABI, provider);
  const factory = new Contract(UNISWAP_V3_FACTORY, UNISWAP_V3_FACTORY_ABI, provider);
  const weth = new Contract(WETH_CONTRACT, ['function decimals() view returns (uint8)'], provider);
  const feed = new Contract(CHAINLINK_ETH_USD_FEED, CHAINLINK_AGGREGATOR_ABI, provider);
  const [code, token0, token1, factoryAddress, fee, registeredPool, liquidity, slot0, wethDecimals, feedDecimals, round] = await Promise.all([
    provider.getCode(BYTES_WETH_UNISWAP_V3_POOL, blockNumber),
    pair.token0({ blockTag: blockNumber }),
    pair.token1({ blockTag: blockNumber }),
    pair.factory({ blockTag: blockNumber }),
    pair.fee({ blockTag: blockNumber }),
    factory.getPool(BYTES_TOKEN_CONTRACT, WETH_CONTRACT, 10_000, { blockTag: blockNumber }),
    pair.liquidity({ blockTag: blockNumber }),
    pair.slot0({ blockTag: blockNumber }),
    weth.decimals({ blockTag: blockNumber }),
    feed.decimals({ blockTag: blockNumber }),
    feed.latestRoundData({ blockTag: blockNumber }),
  ]);
  if (code === '0x'
    || getAddress(token0) !== BYTES_TOKEN_CONTRACT
    || getAddress(token1) !== WETH_CONTRACT
    || getAddress(factoryAddress) !== UNISWAP_V3_FACTORY
    || Number(fee) !== 10_000
    || getAddress(registeredPool) !== BYTES_WETH_UNISWAP_V3_POOL
    || BigInt(wethDecimals) !== BigInt(18)
    || Number(feedDecimals) !== 8
    || liquidity <= BigInt(0)
    || slot0.sqrtPriceX96 <= BigInt(0)) {
    throw new Error('Canonical BYTES/WETH pool identity, registry, decimals, or liquidity mismatch');
  }
  if (round.answeredInRound < round.roundId) throw new Error('ETH/USD oracle round is incomplete');
  return marketMetrics({
    ethereumTotalSupply,
    sqrtPriceX96: slot0.sqrtPriceX96,
    ethUsdAnswer: round.answer,
    ethUsdDecimals: Number(feedDecimals),
    feedUpdatedAt: Number(round.updatedAt),
    sourceTimestamp: blockTimestamp,
    asOf,
  });
}

async function readAvalancheSupplySnapshot() {
  const request = new FetchRequest(AVALANCHE_RPC_URL);
  request.timeout = RPC_TRANSPORT_TIMEOUT_MS;
  const provider = new JsonRpcProvider(request, AVALANCHE_CHAIN_ID, { staticNetwork: true });
  try {
    const rpcChainId = BigInt(await withTimeout(provider.send('eth_chainId', []), RPC_DEADLINE_MS, 'Avalanche RPC chain verification'));
    assertExpectedChainId(rpcChainId, AVALANCHE_CHAIN_ID);
    const block = await withTimeout(provider.getBlock('latest'), RPC_DEADLINE_MS, 'Avalanche latest-block read');
    if (!block?.hash) throw new Error('Avalanche latest block unavailable');
    const token = new Contract(AVALANCHE_BYTES_TOKEN_CONTRACT, AVALANCHE_BYTES_TOKEN_ABI, provider);
    const pool = new Contract(AVALANCHE_BYTES_CCIP_POOL, CCIP_BURN_MINT_POOL_ABI, provider);
    const [code, implementationStorage, name, symbol, decimals, totalSupply, minterRole, poolToken, poolTypeAndVersion, poolBurnResult] = await Promise.all([
      provider.getCode(AVALANCHE_BYTES_TOKEN_CONTRACT, block.number),
      provider.getStorage(AVALANCHE_BYTES_TOKEN_CONTRACT, EIP1967_IMPLEMENTATION_SLOT, block.number),
      token.name({ blockTag: block.number }),
      token.symbol({ blockTag: block.number }),
      token.decimals({ blockTag: block.number }),
      token.totalSupply({ blockTag: block.number }),
      token.MINTER_ROLE({ blockTag: block.number }),
      pool.getToken({ blockTag: block.number }),
      pool.typeAndVersion({ blockTag: block.number }),
      provider.send('eth_call', [{
        to: AVALANCHE_BYTES_TOKEN_CONTRACT,
        from: AVALANCHE_BYTES_CCIP_POOL,
        data: AVALANCHE_BURN_ZERO_CALL_DATA,
      }, `0x${block.number.toString(16)}`]),
    ]);
    if (code === '0x' || !/^0x[0-9a-fA-F]{64}$/.test(implementationStorage)) throw new Error('Avalanche proxy code or implementation slot unavailable');
    const implementation = getAddress(`0x${implementationStorage.slice(-40)}`);
    const poolHasMinterRole = await token.hasRole(minterRole, AVALANCHE_BYTES_CCIP_POOL, { blockTag: block.number });
    if (!verifyAvalancheTokenIdentity({
      chainId: rpcChainId,
      name,
      symbol,
      decimals,
      implementation,
      poolToken,
      poolTypeAndVersion,
      poolHasMinterRole,
      poolCanSelfBurn: poolBurnResult === '0x',
    }, {
      token: AVALANCHE_BYTES_TOKEN_CONTRACT,
      implementation: AVALANCHE_BYTES_IMPLEMENTATION,
    })) throw new Error('Canonical Avalanche BYTES identity mismatch');
    const confirmed = await withTimeout(provider.getBlock(block.number), RPC_DEADLINE_MS, 'Avalanche source-block confirmation');
    if (!confirmed?.hash || confirmed.hash !== block.hash) throw new Error('Avalanche source block changed');
    const avalancheAsOf = new Date(block.timestamp * 1_000).toISOString();
    return {
      metric: avalancheSupplyMetric({ totalSupply, asOf: avalancheAsOf }),
      sourceBlock: block.number,
      sourceBlockHash: block.hash,
      asOf: avalancheAsOf,
    };
  } finally {
    provider.destroy();
  }
}

async function readAggregatePendingRewards(provider: JsonRpcProvider, blockNumber: number, asOf: string) {
  validatePendingWorkBounds({
    snapshotBlock: participantSnapshot.sourceBlock,
    currentBlock: blockNumber,
    participantCount: participantSnapshot.count,
    chunkCount: 1,
  }, PENDING_WORK_LIMITS);
  const deltaAddresses = await readDeltaParticipants(provider, participantSnapshot.sourceBlock + 1, blockNumber);
  const participants = mergeParticipantAddresses(participantSnapshot, deltaAddresses);
  const calls = participants.flatMap((participant) => CLAIMABLE_REWARD_POOLS.map((pool) => ({
    target: BYTES_STAKING_CONTRACT,
    allowFailure: true,
    callData: stakingInterface.encodeFunctionData('getPendingPoolReward', [pool, participant]),
  })));
  const multicall = new Contract(MULTICALL3_CONTRACT, MULTICALL3_ABI, provider);
  const chunks = [];
  for (let index = 0; index < calls.length; index += MULTICALL_CHUNK_SIZE) {
    chunks.push(calls.slice(index, index + MULTICALL_CHUNK_SIZE));
  }
  validatePendingWorkBounds({
    snapshotBlock: participantSnapshot.sourceBlock,
    currentBlock: blockNumber,
    participantCount: participants.length,
    chunkCount: chunks.length,
  }, PENDING_WORK_LIMITS);
  const chunkResults: Array<Array<{ success: boolean; returnData: string }>> = [];
  for (let index = 0; index < chunks.length; index += MULTICALL_CONCURRENCY) {
    const batch = chunks.slice(index, index + MULTICALL_CONCURRENCY);
    chunkResults.push(...await Promise.all(batch.map((chunk) => (
      multicall.aggregate3.staticCall(chunk, { blockTag: blockNumber }) as Promise<Array<{ success: boolean; returnData: string }>>
    ))));
  }
  let reward = BigInt(0);
  let tax = BigInt(0);
  for (const result of chunkResults.flat()) {
    if (!result.success) throw new Error('Pending reward component unavailable');
    const [componentReward, componentTax] = stakingInterface.decodeFunctionResult('getPendingPoolReward', result.returnData);
    reward += componentReward;
    tax += componentTax;
  }
  return pendingRewardsMetric({
    reward,
    tax,
    asOf,
    participantCount: participants.length,
    snapshotBlock: participantSnapshot.sourceBlock,
  });
}

async function generatePendingRewardsSnapshot() {
  const url = rpcUrl();
  if (!url) throw new Error('Private Ethereum RPC configuration is required.');
  const request = new FetchRequest(url);
  request.timeout = RPC_TRANSPORT_TIMEOUT_MS;
  const provider = new JsonRpcProvider(request, ETHEREUM_CHAIN_ID, { staticNetwork: true });
  try {
    const network = await withTimeout(provider.getNetwork(), RPC_DEADLINE_MS, 'Pending snapshot Ethereum network verification');
    assertExpectedChainId(network.chainId, ETHEREUM_CHAIN_ID);
    const block = await withTimeout(provider.getBlock('latest'), RPC_DEADLINE_MS, 'Pending snapshot latest-block read');
    if (!block?.hash) throw new Error('Pending snapshot latest block unavailable');
    const asOf = new Date(block.timestamp * 1_000).toISOString();
    const staking = new Contract(BYTES_STAKING_CONTRACT, BYTES_STAKING_ABI, provider);
    await withTimeout(
      readCanonicalTokenMetrics(provider, staking, block.number, asOf),
      RPC_DEADLINE_MS,
      'Pending snapshot canonical BYTES identity reads',
    );
    const metric = await withTimeout(
      readAggregatePendingRewards(provider, block.number, asOf),
      RPC_DEADLINE_MS,
      'Aggregate pending rewards',
    );
    const confirmed = await withTimeout(provider.getBlock(block.number), RPC_DEADLINE_MS, 'Pending snapshot source-block confirmation');
    if (!confirmed?.hash || confirmed.hash !== block.hash) throw new Error('Pending snapshot source block changed');
    return { metric, sourceBlock: block.number, sourceBlockHash: block.hash, asOf };
  } finally {
    provider.destroy();
  }
}

const readCachedPendingRewardsSnapshot = unstable_cache(
  generatePendingRewardsSnapshot,
  ['bytes-pending-rewards-v1', BYTES_PARTICIPANT_SNAPSHOT_DIGEST],
  { revalidate: PENDING_SNAPSHOT_SECONDS, tags: ['bytes-pending-rewards'] },
);

function modeledRateMetric(week: number, asOf: string) {
  const value = {
    S1: emissionAtWeek(STEADY_RESERVOIRS.S1, week),
    S2: emissionAtWeek(STEADY_RESERVOIRS.S2, week),
    BYTES: 0,
    LP: 0,
    total: emissionAtWeek(STEADY_RESERVOIRS.S1 + STEADY_RESERVOIRS.S2, week),
  };
  return {
    value,
    unit: 'BYTES/day',
    classification: 'calculated',
    source: 'launch-tokenomics-curve',
    asOf,
    availability: 'available',
    formula: 'active reservoir * 2^(-week / 52)',
    assumptions: ['S1 reservoir 5,500', 'S2 reservoir 375', 'BYTES and LP reservoirs 0'],
  };
}

async function generateBytesMetricsResponse() {
  const generatedAt = new Date().toISOString();
  const url = rpcUrl();
  if (!url) {
    return Response.json(publicFailurePayload(generatedAt), {
      status: 503,
      headers: { 'cache-control': PRIVATE_FAILURE_CACHE_CONTROL },
    });
  }

  let provider: JsonRpcProvider;
  let block: Awaited<ReturnType<JsonRpcProvider['getBlock']>>;
  try {
    const request = new FetchRequest(url);
    request.timeout = RPC_TRANSPORT_TIMEOUT_MS;
    provider = new JsonRpcProvider(request);
    const network = await withTimeout(provider.getNetwork(), RPC_DEADLINE_MS, 'Ethereum network verification');
    assertExpectedChainId(network.chainId, ETHEREUM_CHAIN_ID);
    block = await withTimeout(provider.getBlock('latest'), RPC_DEADLINE_MS, 'Ethereum latest-block read');
    if (!block?.hash) throw new Error('Latest block unavailable');
  } catch {
    console.error('BYTES metrics chain verification or latest-block read failed.');
    return Response.json(publicFailurePayload(generatedAt), {
      status: 503,
      headers: { 'cache-control': PRIVATE_FAILURE_CACHE_CONTROL },
    });
  }

  const asOf = new Date(block.timestamp * 1_000).toISOString();
  const fromTimestamp = block.timestamp - SECONDS_PER_DAY;
  const staking = new Contract(BYTES_STAKING_CONTRACT, BYTES_STAKING_ABI, provider);

  const poolReads = await Promise.allSettled(
    POOLS.map((pool) => withTimeout(
      staking.getTotalEmissions(pool, fromTimestamp, { blockTag: block.number }) as Promise<bigint>,
      RPC_DEADLINE_MS,
      'Staking emission read',
    )),
  );

  if (!hasSuccessfulPoolEmissionRead(poolReads)) {
    console.error('BYTES metrics primary contract reads failed.');
    return Response.json(publicFailurePayload(generatedAt), {
      status: 503,
      headers: { 'cache-control': PRIVATE_FAILURE_CACHE_CONTROL },
    });
  }

  const warnings: string[] = [];
  const poolValues: Partial<Record<'S1' | 'S2' | 'BYTES' | 'LP', number>> = {};
  POOLS.forEach((pool, index) => {
    const result = poolReads[index];
    const label = BYTES_POOL_LABELS[pool];
    if (result.status === 'fulfilled') {
      poolValues[label] = bytesValue(result.value);
    } else {
      warnings.push(`${label} configured emissions are temporarily unavailable.`);
    }
  });

  let tokenMetricRecords = canonicalIdentityUnavailableMetrics(asOf);
  let pendingUnclaimedRewards = pendingRewardsUnavailableMetric(asOf);
  let pendingRewardsSource: { sourceBlock: number | null; sourceBlockHash: string | null; asOf: string | null } = {
    sourceBlock: null,
    sourceBlockHash: null,
    asOf: null,
  };
  let marketMetricRecords = marketMetricsUnavailable(asOf);
  let avalancheBytesSupply = avalancheSupplyUnavailableMetric(asOf);
  let avalancheSource: { sourceBlock: number | null; sourceBlockHash: string | null; asOf: string | null; identityVerified: boolean } = {
    sourceBlock: null,
    sourceBlockHash: null,
    asOf: null,
    identityVerified: false,
  };
  let canonicalTotalSupply: bigint | null = null;
  let tokenIdentityVerified = false;
  const avalancheRead = withTimeout(readAvalancheSupplySnapshot(), RPC_DEADLINE_MS, 'Avalanche BYTES supply reads')
    .then(
      (value) => ({ status: 'fulfilled' as const, value }),
      () => ({ status: 'rejected' as const }),
    );
  const secondaryRequest = new FetchRequest(url);
  secondaryRequest.timeout = RPC_TRANSPORT_TIMEOUT_MS;
  const secondaryProvider = new JsonRpcProvider(secondaryRequest, ETHEREUM_CHAIN_ID, { staticNetwork: true });
  const secondaryStaking = new Contract(BYTES_STAKING_CONTRACT, BYTES_STAKING_ABI, secondaryProvider);
  try {
    try {
      const [secondaryChainId, secondaryBlock] = await Promise.all([
        withTimeout(secondaryProvider.send('eth_chainId', []), RPC_DEADLINE_MS, 'Secondary Ethereum RPC chain verification'),
        withTimeout(secondaryProvider.getBlock(block.number), RPC_DEADLINE_MS, 'Secondary Ethereum source-block verification'),
      ]);
      assertExpectedChainId(BigInt(secondaryChainId), ETHEREUM_CHAIN_ID);
      if (!secondaryBlock?.hash || secondaryBlock.hash !== block.hash) throw new Error('Secondary Ethereum provider source block does not match published provenance');
      const canonical = await withTimeout(
        readCanonicalTokenMetrics(secondaryProvider, secondaryStaking, block.number, asOf),
        RPC_DEADLINE_MS,
        'Canonical BYTES token reads',
      );
      tokenMetricRecords = canonical.metrics;
      canonicalTotalSupply = canonical.totalSupply;
      tokenIdentityVerified = true;
    } catch {
      warnings.push('Ethereum BYTES supply and staking-contract balance are temporarily unavailable.');
    }

    if (tokenIdentityVerified && canonicalTotalSupply !== null) {
      try {
        marketMetricRecords = await withTimeout(
          readMarketMetrics(secondaryProvider, block.number, block.timestamp, asOf, canonicalTotalSupply),
          RPC_DEADLINE_MS,
          'BYTES price and valuation reads',
        );
      } catch {
        warnings.push('BYTES pair price and total-supply valuation are temporarily unavailable.');
      }
    } else {
      warnings.push('Price and valuation metrics require canonical Ethereum token verification.');
    }

    try {
      const postReadSecondaryBlock = await withTimeout(
        secondaryProvider.getBlock(block.number),
        RPC_DEADLINE_MS,
        'Secondary Ethereum post-read source-block confirmation',
      );
      if (!postReadSecondaryBlock?.hash || postReadSecondaryBlock.hash !== block.hash) {
        throw new Error('Secondary Ethereum source block changed during reads');
      }
    } catch {
      tokenMetricRecords = canonicalIdentityUnavailableMetrics(asOf);
      pendingUnclaimedRewards = pendingRewardsUnavailableMetric(asOf);
      pendingRewardsSource = { sourceBlock: null, sourceBlockHash: null, asOf: null };
      marketMetricRecords = marketMetricsUnavailable(asOf);
      canonicalTotalSupply = null;
      tokenIdentityVerified = false;
      warnings.push('Ethereum token, price, and valuation metrics failed post-read source-block confirmation.');
    }
  } finally {
    secondaryProvider.destroy();
  }

  const avalancheResult = await avalancheRead;
  if (avalancheResult.status === 'fulfilled') {
    const avalanche = avalancheResult.value;
    avalancheBytesSupply = avalanche.metric;
    avalancheSource = {
      sourceBlock: avalanche.sourceBlock,
      sourceBlockHash: avalanche.sourceBlockHash,
      asOf: avalanche.asOf,
      identityVerified: true,
    };
  } else {
    warnings.push('Avalanche BYTES supply is temporarily unavailable.');
  }

  const { ethBytes2Supply, bytesHeldByStakingContract } = tokenMetricRecords;
  const { bytesPriceUsd, totalSupplyValuationUsd } = marketMetricRecords;

  const configured = configuredEmissionsMetric(poolValues, asOf);
  const week = theoreticalWeek(VERIFIED_EMISSIONS_EPOCH_SECONDS, block.timestamp);
  const fractionOfCurrentWeekElapsed = fractionThroughWeek(VERIFIED_EMISSIONS_EPOCH_SECONDS, block.timestamp);
  const modeled = modeledRateMetric(week, asOf);
  const metrics: Record<string, unknown> = {
    currentConfiguredEmissions: configured,
    ethBytes2Supply,
    avalancheBytesSupply,
    bytesHeldByStakingContract,
    pendingUnclaimedRewards,
    bytesPriceUsd,
    totalSupplyValuationUsd,
    circulatingMarketCapUsd: unavailableMetric(
      'USD',
      'calculated',
      'circulating-supply-times-price',
      asOf,
      'Circulating supply has not been independently established; total-supply valuation is reported separately.',
    ),
    theoreticalWeek: availableMetric(
      week,
      'week',
      'calculated',
      'verified-emissions-epoch',
      asOf,
      'floor((blockTimestamp - epochTimestamp) / 604800)',
      ['Epoch 2023-06-15T00:00:00Z'],
    ),
    currentModeledRate: modeled,
  };

  if (configured.value.total !== null) {
    const configuredS1S2Daily = configured.value.S1 + configured.value.S2;
    metrics.projectedNext365DayIssuance = availableMetric(
      projectedIssuanceOverDays(configuredS1S2Daily, fractionOfCurrentWeekElapsed, 365),
      'BYTES / next 365 days',
      'projected',
      'current-configured-emissions-plus-weekly-decay-model',
      asOf,
      'sum the current configured daily rate through the remainder of this decay week, then apply 2^(-1/52) each week across the next 365 days',
      ['Current S1 and S2 participation remains steady', 'Weekly decay continues from the verified emissions epoch', 'This is a projection, not a fixed issuance commitment'],
    );
    metrics.configuredVsTheoretical = signedMetric(
      configured.value.total - modeled.value.total,
      'BYTES/day',
      'calculated',
      'configured-minus-modeled',
      asOf,
      'live configured emissions - modeled curve emissions',
    );
  } else {
    metrics.projectedNext365DayIssuance = unavailableMetric('BYTES / next 365 days', 'projected', 'current-configured-emissions-plus-weekly-decay-model', asOf, 'All configured asset-type reads are required.');
    metrics.configuredVsTheoretical = unavailableMetric('BYTES/day', 'calculated', 'configured-minus-modeled', asOf, 'All configured pools are required.');
  }

  const projections = {
    steadyParticipationRemainingIssuance: availableMetric(
      remainingGeometricIssuance(modeled.value.total, fractionOfCurrentWeekElapsed),
      'BYTES',
      'projected',
      'weekly-geometric-model',
      asOf,
      'current modeled daily rate * 7 * remaining current-week fraction + future full weekly geometric series',
      ['S1 reservoir 5,500', 'S2 reservoir 375', 'Current week is prorated from the verified emissions epoch'],
    ),
    maximumParticipationRemainingIssuance: availableMetric(
      remainingGeometricIssuance(emissionAtWeek(MAXIMUM_PARTICIPATION_RESERVOIR, week), fractionOfCurrentWeekElapsed),
      'BYTES',
      'projected',
      'weekly-geometric-model',
      asOf,
      'modeled 11,000/day current-week rate * 7 * remaining current-week fraction + future full weekly geometric series',
      ['Maximum 11,000/day participation reservoir', 'Current week is prorated from the verified emissions epoch'],
    ),
  };

  try {
    const canonicalBlock = await withTimeout(provider.getBlock(block.number), RPC_DEADLINE_MS, 'Ethereum source-block confirmation');
    if (!canonicalBlock?.hash || canonicalBlock.hash !== block.hash) throw new Error('Ethereum source block changed');
  } catch {
    console.error('BYTES metrics source-block confirmation failed.');
    return Response.json(publicFailurePayload(generatedAt), {
      status: 503,
      headers: { 'cache-control': PRIVATE_FAILURE_CACHE_CONTROL },
    });
  }

  return Response.json(
    {
      schemaVersion: 1,
      generatedAt,
      sourceBlock: block.number,
      freshnessPolicy: FRESHNESS_POLICY,
      status: warnings.length === 0 ? 'fresh' : 'partial',
      metrics,
      projections,
      provenance: {
        chain: ETHEREUM_CHAIN_NAME,
        chainId: ETHEREUM_CHAIN_ID,
        sourceBlockHash: block.hash,
        stakingContract: BYTES_STAKING_CONTRACT,
        bytesTokenContract: BYTES_TOKEN_CONTRACT,
        tokenIdentityVerified,
        tokenIdentityVerification: tokenIdentityVerified
          ? 'Verified at source block: staking.BYTES() and token.STAKER() bidirectional match; token.decimals() == 18'
          : 'Unavailable at source block; token-dependent metrics are source-gated',
        avalanche: {
          chain: AVALANCHE_CHAIN_NAME,
          chainId: AVALANCHE_CHAIN_ID,
          sourceBlock: avalancheSource.sourceBlock,
          sourceBlockHash: avalancheSource.sourceBlockHash,
          asOf: avalancheSource.asOf,
          bytesTokenContract: AVALANCHE_BYTES_TOKEN_CONTRACT,
          proxyImplementation: AVALANCHE_BYTES_IMPLEMENTATION,
          ccipBurnMintPool: AVALANCHE_BYTES_CCIP_POOL,
          tokenIdentityVerified: avalancheSource.identityVerified,
          tokenIdentityVerification: avalancheSource.identityVerified
            ? 'Verified at one Avalanche block: RPC chain ID, proxy implementation, name, symbol, decimals, pool token, BurnMintTokenPool version, MINTER_ROLE linkage, and pool self-burn capability'
            : 'Unavailable; Avalanche token-dependent metrics are source-gated',
        },
        crossChainSupplyTreatment: 'Ethereum is the canonical Lock/Release issuance chain. The verified Avalanche BurnMint supply is a bridge representation and is not added to Ethereum totalSupply.',
        priceSource: {
          verified: bytesPriceUsd.availability === 'available',
          verification: bytesPriceUsd.availability === 'available'
            ? 'Verified at the Ethereum source block: deployed canonical Uniswap V3 factory pool, 1% fee tier, token order and decimals, positive liquidity, initialized slot0, and a fresh complete Chainlink ETH/USD round'
            : 'Unavailable at the Ethereum source block; price and valuation metrics are source-gated',
          dextoolsPairUrl: 'https://www.dextools.io/app/en/ether/pair-explorer/0xfeb09c7e130a4b87b27ebd648ec485657b688b34',
          uniswapV3Pool: BYTES_WETH_UNISWAP_V3_POOL,
          uniswapV3Factory: UNISWAP_V3_FACTORY,
          feeTier: 10_000,
          quoteToken: WETH_CONTRACT,
          ethUsdFeed: CHAINLINK_ETH_USD_FEED,
          quoteCurrency: 'USD',
          method: 'Same-Ethereum-block Uniswap V3 BYTES/WETH spot ratio multiplied by Chainlink ETH/USD; total-supply valuation uses canonical Ethereum totalSupply once.',
        },

        participantSnapshotBlock: participantSnapshot.sourceBlock,
        participantSnapshotBlockHash: participantSnapshot.sourceBlockHash,
        participantSnapshotCount: participantSnapshot.count,
        participantSnapshotDigest: participantSnapshot.addressesSha256,
        participantSnapshotEvidence: participantSnapshot.evidence,
        pendingRewardsSnapshot: pendingRewardsSource,
        pendingRewardPools: ['S1-position', 'S2-position', 'LP'],
        pendingDaoTaxTreatment: 'excluded from the net pending reward snapshot aggregate',
        pendingWorkLimits: PENDING_WORK_LIMITS,
        observationWindowSeconds: SECONDS_PER_DAY,
      },
      warnings,
    },
    { headers: { 'cache-control': PUBLIC_CACHE_CONTROL } },
  );
}

async function generateBytesMetricsPayload() {
  const response = await generateBytesMetricsResponse();
  if (!response.ok) throw new Error('Verified BYTES snapshot generation failed.');
  return response.json();
}

const readCachedBytesMetricsPayload = unstable_cache(
  generateBytesMetricsPayload,
  ['bytes-lightweight-snapshot-v1', BYTES_PARTICIPANT_SNAPSHOT_DIGEST],
  { revalidate: LIGHTWEIGHT_SNAPSHOT_SECONDS, tags: ['bytes-lightweight-snapshot'] },
);

type PendingRewardsSnapshot = Awaited<ReturnType<typeof generatePendingRewardsSnapshot>>;

function combineSnapshotTiers(
  lightweightPayload: Awaited<ReturnType<typeof generateBytesMetricsPayload>>,
  pendingResult: PromiseSettledResult<PendingRewardsSnapshot>,
) {
  const warnings = [...lightweightPayload.warnings];
  let pendingMetric = lightweightPayload.metrics.pendingUnclaimedRewards;
  let pendingSource = lightweightPayload.provenance.pendingRewardsSnapshot;
  if (!lightweightPayload.provenance.tokenIdentityVerified) {
    warnings.push('Pending rewards require canonical Ethereum token verification.');
  } else if (pendingResult.status === 'fulfilled') {
    pendingMetric = pendingResult.value.metric;
    pendingSource = {
      sourceBlock: pendingResult.value.sourceBlock,
      sourceBlockHash: pendingResult.value.sourceBlockHash,
      asOf: pendingResult.value.asOf,
    };
    const pendingAgeSeconds = Math.max(0, (
      Date.parse(lightweightPayload.generatedAt) - Date.parse(pendingResult.value.asOf)
    ) / 1_000);
    if (pendingAgeSeconds > PENDING_SNAPSHOT_SECONDS + LIGHTWEIGHT_SNAPSHOT_SECONDS) {
      warnings.push('Pending and unclaimed rewards are older than the 24-hour target; the last verified snapshot is being served.');
    }
  } else {
    warnings.push('Pending and unclaimed rewards are temporarily unavailable.');
  }
  return {
    ...lightweightPayload,
    status: warnings.length === 0 ? 'fresh' : 'partial',
    metrics: { ...lightweightPayload.metrics, pendingUnclaimedRewards: pendingMetric },
    provenance: { ...lightweightPayload.provenance, pendingRewardsSnapshot: pendingSource },
    warnings,
  };
}

export async function GET(request: Request) {
  const generatedAt = new Date().toISOString();
  const searchParams = new URL(request.url).searchParams;
  const isCanonical = searchParams.size === 0;
  const isScheduledWarm = searchParams.size === 1 && searchParams.get('warm') === '1';
  if (!isCanonical && !isScheduledWarm) {
    return Response.json({ status: 'invalid_request' }, {
      status: 400,
      headers: { 'cache-control': PRIVATE_FAILURE_CACHE_CONTROL },
    });
  }
  try {
    const [lightweightResult, pendingResult] = await Promise.allSettled([
      readCachedBytesMetricsPayload(),
      readCachedPendingRewardsSnapshot(),
    ]);
    if (lightweightResult.status === 'rejected') throw new Error('Lightweight snapshot unavailable.');
    const payload = combineSnapshotTiers(lightweightResult.value, pendingResult);
    return Response.json(payload, { headers: { 'cache-control': PUBLIC_CACHE_CONTROL } });
  } catch {
    console.error('BYTES materialized snapshot unavailable.');
    return Response.json(publicFailurePayload(generatedAt), {
      status: 503,
      headers: { 'cache-control': PRIVATE_FAILURE_CACHE_CONTROL },
    });
  }
}
