export const PHANTOM_REWARD_FILES = [
  '/airdrops/2025-10Airdrop.csv',
  '/airdrops/2025-11Airdrop.csv',
  '/airdrops/2025-12Airdrop.csv',
  '/airdrops/2026-01Airdrop.csv',
  '/airdrops/2026-02Airdrop.csv',
  '/airdrops/2026-03Airdrop.csv',
  '/airdrops/2026-04Airdrop.csv',
  '/airdrops/2026-05Airdrop.csv',
  '/airdrops/2026-06Airdrop.csv',
  '/airdrops/2026-07Airdrop.csv',
] as const;

export const PHANTOM_REWARD_FILE_NAMES = PHANTOM_REWARD_FILES.map((file) =>
  file.slice('/airdrops/'.length),
);

export const PHANTOM_REWARD_ARCHIVE_AT = '2026-08-03T02:10:34Z';
