import { formatUnits } from 'ethers';

export type Bytes2BytesSeason = 's1' | 's2';

export type RawCitizenPosition = {
  citizenId: bigint;
  stakedBytes: bigint;
  timelockEndTime: bigint;
  points: bigint;
  stakedVaultId?: bigint;
  hasVault?: boolean;
};

export type CitizenPosition = {
  season: Bytes2BytesSeason;
  citizenId: string;
  stakedBytes: number;
  timelockEndTime: number;
  points: number;
  vaultId: string | null;
  hasVault: boolean | null;
};

export type PendingByPool = { s1: number; s2: number };

function finiteAmount(value: string, label: string) {
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount < 0) throw new Error(`${label} exceeds the supported display range`);
  return amount;
}

export function bytesAmount(value: bigint) {
  return finiteAmount(formatUnits(value, 18), 'BYTES amount');
}

export function normalizeCitizenPosition(season: Bytes2BytesSeason, position: RawCitizenPosition): CitizenPosition {
  const timelockEndTime = Number(position.timelockEndTime);
  const points = Number(position.points) / 100;
  if (!Number.isSafeInteger(timelockEndTime) || !Number.isFinite(points) || points < 0) {
    throw new Error('Citizen position exceeds the supported display range');
  }
  return {
    season,
    citizenId: position.citizenId.toString(),
    stakedBytes: bytesAmount(position.stakedBytes),
    timelockEndTime,
    points,
    vaultId: season === 's1' && position.stakedVaultId != null && position.stakedVaultId > BigInt(0)
      ? position.stakedVaultId.toString()
      : null,
    hasVault: season === 's1' ? Boolean(position.hasVault) : null,
  };
}

function round(value: number) {
  return Math.round((value + Number.EPSILON) * 100_000_000) / 100_000_000;
}

export function buildBytes2BytesSummary({
  walletBalance,
  pendingByPool,
  s1Citizens,
  s2Citizens,
}: {
  walletBalance: number;
  pendingByPool: PendingByPool;
  s1Citizens: CitizenPosition[];
  s2Citizens: CitizenPosition[];
}) {
  const citizenBytesStaked = round([...s1Citizens, ...s2Citizens].reduce((total, position) => total + position.stakedBytes, 0));
  const pendingRewards = round(pendingByPool.s1 + pendingByPool.s2);
  return {
    walletBalance: round(walletBalance),
    citizenBytesStaked,
    pendingRewards,
    totalBytes: round(walletBalance + citizenBytesStaked + pendingRewards),
    citizenCount: s1Citizens.length + s2Citizens.length,
    s1Count: s1Citizens.length,
    s2Count: s2Citizens.length,
  };
}
