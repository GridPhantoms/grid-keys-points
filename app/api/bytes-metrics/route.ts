import 'server-only';

import { Contract, FetchRequest, JsonRpcProvider, formatUnits } from 'ethers';
import {
  BYTES_POOL_LABELS,
  BYTES_STAKING_ABI,
  BYTES_STAKING_CONTRACT,
  BytesPool,
  ETHEREUM_CHAIN_ID,
  ETHEREUM_CHAIN_NAME,
} from '@/lib/bytes-contracts';
import {
  availableMetric,
  assertExpectedChainId,
  configuredEmissionsMetric,
  ethereumRpcUrl,
  FRESHNESS_POLICY,
  hasSuccessfulPoolEmissionRead,
  pendingUnclaimedRewardsMetric,
  publicFailurePayload,
  PUBLIC_CACHE_CONTROL,
  signedMetric,
  unavailableMetric,
  unverifiedEthereumTokenMetrics,
  UNVERIFIED_ETHEREUM_TOKEN_REASON,
  withTimeout,
} from '@/lib/bytes-api.mjs';
import {
  annualizedIssuance,
  emissionAtWeek,
  fractionThroughWeek,
  remainingGeometricIssuance,
  theoreticalWeek,
} from '@/lib/bytes-model.mjs';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const PRIVATE_FAILURE_CACHE_CONTROL = 'private, no-store';
const RPC_TRANSPORT_TIMEOUT_MS = 9_000;
const RPC_DEADLINE_MS = 10_000;
const SECONDS_PER_DAY = 86_400;
const VERIFIED_EMISSIONS_EPOCH_SECONDS = 1_686_787_200; // 2023-06-15T00:00:00Z
const STEADY_RESERVOIRS = { S1: 5_500, S2: 375, BYTES: 0, LP: 0 } as const;
const MAXIMUM_PARTICIPATION_RESERVOIR = 11_000;
const POOLS = [BytesPool.S1, BytesPool.S2, BytesPool.BYTES, BytesPool.LP] as const;

function rpcUrl() {
  return ethereumRpcUrl(process.env);
}

function bytesValue(value: bigint) {
  const parsed = Number(formatUnits(value, 18));
  if (!Number.isFinite(parsed) || parsed < 0) throw new Error('Invalid contract numeric result');
  return parsed;
}

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

export async function GET() {
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
    if (!block) throw new Error('Latest block unavailable');
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

  const warnings: string[] = [UNVERIFIED_ETHEREUM_TOKEN_REASON];
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

  const { ethBytes2Supply, bytesHeldByStakingContract } = unverifiedEthereumTokenMetrics(asOf);

  const configured = configuredEmissionsMetric(poolValues, asOf);
  const week = theoreticalWeek(VERIFIED_EMISSIONS_EPOCH_SECONDS, block.timestamp);
  const fractionOfCurrentWeekElapsed = fractionThroughWeek(VERIFIED_EMISSIONS_EPOCH_SECONDS, block.timestamp);
  const modeled = modeledRateMetric(week, asOf);
  const metrics: Record<string, unknown> = {
    currentConfiguredEmissions: configured,
    ethBytes2Supply,
    bytesHeldByStakingContract,
    pendingUnclaimedRewards: pendingUnclaimedRewardsMetric(asOf),
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
    metrics.annualizedConfiguredIssuance = availableMetric(
      annualizedIssuance(configured.value.total),
      'BYTES/year',
      'calculated',
      'current-configured-emissions',
      asOf,
      'configured BYTES/day * 365',
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
    metrics.annualizedConfiguredIssuance = unavailableMetric('BYTES/year', 'calculated', 'current-configured-emissions', asOf, 'All configured pools are required.');
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
        stakingContract: BYTES_STAKING_CONTRACT,
        observationWindowSeconds: SECONDS_PER_DAY,
      },
      warnings,
    },
    { headers: { 'cache-control': PUBLIC_CACHE_CONTROL } },
  );
}
