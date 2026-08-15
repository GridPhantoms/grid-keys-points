import { getAddress } from 'ethers';

export const ETHEREUM_CHAIN_ID = 1;
export const ETHEREUM_CHAIN_NAME = 'ethereum-mainnet';

export const BYTES_STAKING_CONTRACT = getAddress('0x67e1eCFA9232E27EAf3133B968A33A9a0dCa9e16');

export enum BytesPool {
  S1 = 0,
  S2 = 1,
  BYTES = 2,
  LP = 3,
}

export const BYTES_POOL_LABELS = {
  [BytesPool.S1]: 'S1',
  [BytesPool.S2]: 'S2',
  [BytesPool.BYTES]: 'BYTES',
  [BytesPool.LP]: 'LP',
} as const;

export const BYTES_STAKING_ABI = [
  'function getTotalEmissions(uint8 assetType, uint256 fromTimestamp) view returns (uint256)',
] as const;
