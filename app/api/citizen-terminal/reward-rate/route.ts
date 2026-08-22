import { NextResponse } from 'next/server';
import { AbiCoder, Contract, FetchRequest, JsonRpcProvider, formatUnits, keccak256 } from 'ethers';
import { ethereumRpcUrl } from '@/lib/bytes-api.mjs';
import { BYTES_STAKING_ABI, BYTES_STAKING_CONTRACT, ETHEREUM_CHAIN_ID } from '@/lib/bytes-contracts';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const EXPECTED_STAKER_CODE_HASH = '0xb22f913b553d4df3e352316494745ba3b396865a343b46e7dd8bb335a98afc0e';
const POOLS_STORAGE_SLOT = BigInt(9);
const CONTRACT_POINT_SCALE = BigInt(100);
const SECONDS_PER_DAY = BigInt(86_400);
const BPS = BigInt(10_000);
const REQUEST_TIMEOUT_MS = 10_000;

type PoolNumber = 0 | 1;

function rpcUrl() {
  return ethereumRpcUrl(process.env);
}

function storagePosition(pool: PoolNumber, offset: bigint) {
  const coder = AbiCoder.defaultAbiCoder();
  return BigInt(keccak256(coder.encode(['uint256', 'uint256'], [pool, POOLS_STORAGE_SLOT]))) + offset;
}

function rateAsNumber(rawNumerator: bigint, rawDenominator: bigint) {
  if (rawDenominator === BigInt(0)) return null;
  // Convert only at the public-display boundary. The contract math stays rational above.
  return Number(formatUnits(rawNumerator / rawDenominator, 18));
}

export async function GET() {
  const url = rpcUrl();
  if (!url) return NextResponse.json({ error: 'Ethereum data provider is not configured.' }, { status: 503 });

  try {
    const request = new FetchRequest(url);
    request.timeout = REQUEST_TIMEOUT_MS;
    const provider = new JsonRpcProvider(request);
    const [network, block] = await Promise.all([provider.getNetwork(), provider.getBlock('latest')]);
    if (network.chainId !== BigInt(ETHEREUM_CHAIN_ID) || !block?.hash) throw new Error('Ethereum source verification failed');

    const [code, blockCheck] = await Promise.all([
      provider.getCode(BYTES_STAKING_CONTRACT, block.number),
      provider.getBlock(block.number),
    ]);
    if (!blockCheck?.hash || blockCheck.hash !== block.hash || keccak256(code) !== EXPECTED_STAKER_CODE_HASH) {
      throw new Error('Staking contract verification failed');
    }

    const staking = new Contract(BYTES_STAKING_CONTRACT, BYTES_STAKING_ABI, provider);
    const pools = await Promise.all(([0, 1] as PoolNumber[]).map(async (pool) => {
      const [emissionPerSecondRaw, pointsHex, taxHex] = await Promise.all([
        staking.getTotalEmissions(pool, block.timestamp - 1, { blockTag: block.number }) as Promise<bigint>,
        provider.getStorage(BYTES_STAKING_CONTRACT, storagePosition(pool, BigInt(0)), block.number),
        provider.getStorage(BYTES_STAKING_CONTRACT, storagePosition(pool, BigInt(1)), block.number),
      ]);
      const totalContractPoints = BigInt(pointsHex);
      const daoTaxBps = BigInt(taxHex);
      if (totalContractPoints === BigInt(0) || daoTaxBps > BPS) throw new Error(`Pool ${pool} state is unavailable`);

      // Contract positions use 100 internal units per user-facing staking point.
      const grossNumerator = emissionPerSecondRaw * SECONDS_PER_DAY * CONTRACT_POINT_SCALE;
      const grossDenominator = totalContractPoints;
      const netNumerator = grossNumerator * (BPS - daoTaxBps);
      const netDenominator = grossDenominator * BPS;

      return {
        pool: pool === 0 ? 'S1' : 'S2',
        contractPool: pool,
        currentEmissionBytesPerDay: Number(formatUnits(emissionPerSecondRaw * SECONDS_PER_DAY, 18)),
        totalContractPoints: totalContractPoints.toString(),
        totalDisplayPoints: Number(totalContractPoints) / Number(CONTRACT_POINT_SCALE),
        daoTaxBps: Number(daoTaxBps),
        grossBytesPerPointPerDay: rateAsNumber(grossNumerator, grossDenominator),
        netBytesPerPointPerDay: rateAsNumber(netNumerator, netDenominator),
      };
    }));

    return NextResponse.json({
      availability: 'available',
      classification: 'calculated',
      asOf: new Date(block.timestamp * 1_000).toISOString(),
      blockNumber: block.number,
      blockHash: block.hash,
      source: 'NeoTokyoStaker at a pinned Ethereum block',
      formula: 'current pool emissions × 86,400 ÷ (contract totalPoints ÷ 100) × (1 - DAO tax)',
      assumptions: [
        'One-second getTotalEmissions read is dailyized to avoid blending reward windows.',
        'Contract staking points use 100 internal units per user-facing point.',
        'Rate is a current snapshot and changes with pool points, emissions, or DAO tax.',
      ],
      pools,
    }, { headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=180' } });
  } catch {
    console.error('Citizen Terminal reward-rate derivation failed.');
    return NextResponse.json({ error: 'Current staking reward rate is temporarily unavailable.' }, { status: 503 });
  }
}
