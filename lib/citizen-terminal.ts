export type CitizenSeason = 's1' | 's2';

export const CITIZEN_CONTRACTS = {
  s1: '0xB9951B43802dCF3ef5b14567cb17adF367ed1c0F',
  s2: '0x4481507cc228FA19D203BD42110d679571f7912E',
} as const;

export const CITIZEN_COLLECTIONS = [
  { key: 's1-citizens', season: 'S1', label: 'Citizens', slug: 'neotokyo-citizens', contract: CITIZEN_CONTRACTS.s1 },
  { key: 's1-identities', season: 'S1', label: 'Identities', slug: 'neo-tokyo-identities', contract: '0x059174c2fef43f06178d23572fe5556f078f2f99' },
  { key: 's1-vaults', season: 'S1', label: 'Vault Cards', slug: 'neo-tokyo-part-2-vault-cards', contract: '0x17b2f2b8927a8f11edfd7a27e153be17d68e69c7' },
  { key: 's1-items', season: 'S1', label: 'Item Caches', slug: 'neo-tokyo-part-3-item-caches', contract: '0xe7489ea1847395d7eead33e9c85fe327d513d249' },
  { key: 's1-lands', season: 'S1', label: 'Land Deeds', slug: 'neo-tokyo-part-4-land-deeds', contract: '0xcfc6a15b2952b6014a993a0c16c9d580d862e21a' },
  { key: 's2-citizens', season: 'S2', label: 'Outer Citizens', slug: 'neotokyo-outer-citizens', contract: CITIZEN_CONTRACTS.s2 },
  { key: 's2-identities', season: 'S2', label: 'Outer Identities', slug: 'neotokyo-outer-identities', contract: '0x8E9F3C6883993A7A69c37213F2eb9A17450ad6D3' },
  { key: 's2-items', season: 'S2', label: 'Outer Item Caches', slug: 'neo-tokyo-outer-item-caches', contract: '0x0b8f04f2ca4f15d33274a27439412ab7639efad9' },
  { key: 's2-lands', season: 'S2', label: 'Outer Land Deeds', slug: 'neo-tokyo-outer-lands', contract: '0xb58ae9e93b8bee7d890ad87a2a70c135a3bf4b4e' },
] as const;

export const S1_CREDIT_YIELD_POINTS: Record<string, number> = {
  Low: 1,
  Mid: 2,
  Medium: 2,
  High: 3,
};

export const S1_VAULT_MULTIPLIERS: Record<string, number> = {
  None: 1,
  Low: 1,
  Medium: 1.5,
  'Medium High': 1.75,
  'Medium-High': 1.75,
  High: 2,
  'Very High': 2.5,
  '?': 3,
  'Extra High': 3,
};

export const S1_LOCK_MULTIPLIERS: Record<string, number> = {
  '1 month': 1,
  '3 months': 1.25,
  '6 months': 1.5,
  '12 months': 2,
  '24 months': 3,
};

export const S2_LOCK_MULTIPLIERS: Record<string, number> = {
  '1 month': 1,
  '3 months': 1.25,
  '6 months': 1.5,
  '12 months': 1.75,
  '24 months': 2,
};

export const VAULT_CAP_BYTES = 2_000;
export const NO_VAULT_CAP_BYTES = 200;

export function getStakingBytesCap(season: CitizenSeason, hasVault?: boolean) {
  return season === 's2' || hasVault === false ? NO_VAULT_CAP_BYTES : VAULT_CAP_BYTES;
}

export function calculateStakingPoints({
  season,
  creditYield = 'Low',
  vaultMultiplier = 'None',
  lockPeriod = '1 month',
  bytesStaked = 0,
  hasVault,
}: {
  season: CitizenSeason;
  creditYield?: string;
  vaultMultiplier?: string;
  lockPeriod?: string;
  bytesStaked?: number;
  hasVault?: boolean;
}) {
  const bytesCap = getStakingBytesCap(season, hasVault);
  const requestedBytes = Number.isFinite(bytesStaked) ? Math.max(0, bytesStaked) : 0;
  const safeBytes = Math.min(requestedBytes, bytesCap);
  const bytesPoints = safeBytes / 200;
  const lockMultiplier = season === 's1'
    ? (S1_LOCK_MULTIPLIERS[lockPeriod] ?? 1)
    : (S2_LOCK_MULTIPLIERS[lockPeriod] ?? 1);

  if (season === 's2') {
    return {
      citizenPoints: lockMultiplier,
      bytesPoints,
      totalPoints: lockMultiplier + bytesPoints,
      bytesStaked: safeBytes,
      bytesCap,
      wasClamped: safeBytes !== requestedBytes,
    };
  }

  const citizenPoints = (S1_CREDIT_YIELD_POINTS[creditYield] ?? 1)
    * lockMultiplier
    * (S1_VAULT_MULTIPLIERS[vaultMultiplier] ?? 1);
  return {
    citizenPoints,
    bytesPoints,
    totalPoints: citizenPoints + bytesPoints,
    bytesStaked: safeBytes,
    bytesCap,
    wasClamped: safeBytes !== requestedBytes,
  };
}
