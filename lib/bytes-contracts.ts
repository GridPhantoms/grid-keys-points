import {
  BYTES_PARTICIPANT_SNAPSHOT_BLOCK,
  BYTES_PARTICIPANT_SNAPSHOT_BLOCK_HASH,
  BYTES_PARTICIPANT_SNAPSHOT_COUNT,
  BYTES_PARTICIPANT_SNAPSHOT_DIGEST,
  BYTES_STAKING_CONTRACT,
  BYTES_STAKING_DEPLOYMENT_BLOCK,
  BYTES_TOKEN_CONTRACT,
  ETHEREUM_CHAIN_ID,
  ETHEREUM_CHAIN_NAME,
  MULTICALL3_CONTRACT,
} from './bytes-addresses.mjs';

export {
  BYTES_PARTICIPANT_SNAPSHOT_BLOCK,
  BYTES_PARTICIPANT_SNAPSHOT_BLOCK_HASH,
  BYTES_PARTICIPANT_SNAPSHOT_COUNT,
  BYTES_PARTICIPANT_SNAPSHOT_DIGEST,
  BYTES_STAKING_CONTRACT,
  BYTES_STAKING_DEPLOYMENT_BLOCK,
  BYTES_TOKEN_CONTRACT,
  ETHEREUM_CHAIN_ID,
  ETHEREUM_CHAIN_NAME,
  MULTICALL3_CONTRACT,
};

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
  'function BYTES() view returns (address)',
  'function getTotalEmissions(uint8 assetType, uint256 fromTimestamp) view returns (uint256)',
  'function getPendingPoolReward(uint8 assetType, address recipient) view returns (uint256 reward, uint256 tax)',
  'event Stake(address indexed staker, address indexed asset, uint256 timelockOption, uint256 amountOrTokenId)',
  'event Claim(address indexed recipient, uint256 reward, uint256 tax)',
] as const;

export const BYTES_TOKEN_ABI = [
  'function STAKER() view returns (address)',
  'function decimals() view returns (uint8)',
  'function totalSupply() view returns (uint256)',
  'function balanceOf(address account) view returns (uint256)',
] as const;

export const MULTICALL3_ABI = [
  'function aggregate3(tuple(address target, bool allowFailure, bytes callData)[] calls) payable returns (tuple(bool success, bytes returnData)[] returnData)',
] as const;
