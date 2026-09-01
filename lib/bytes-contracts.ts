import {
  AVALANCHE_BYTES_CCIP_POOL,
  AVALANCHE_BYTES_IMPLEMENTATION,
  AVALANCHE_BYTES_TOKEN_CONTRACT,
  AVALANCHE_CHAIN_ID,
  AVALANCHE_CHAIN_NAME,
  BYTES_PARTICIPANT_SNAPSHOT_BLOCK,
  BYTES_PARTICIPANT_SNAPSHOT_BLOCK_HASH,
  BYTES_PARTICIPANT_SNAPSHOT_COUNT,
  BYTES_PARTICIPANT_SNAPSHOT_DIGEST,
  BYTES_STAKING_CONTRACT,
  BYTES_STAKING_DEPLOYMENT_BLOCK,
  BYTES_TOKEN_CONTRACT,
  BYTES_WETH_UNISWAP_V3_POOL,
  CHAINLINK_ETH_USD_FEED,
  ETHEREUM_CHAIN_ID,
  ETHEREUM_CHAIN_NAME,
  MULTICALL3_CONTRACT,
  S1_CITIZEN_CONTRACT,
  S1_LEGACY_CITIZEN_CONTRACT,
  S2_OUTER_CITIZEN_CONTRACT,
  S2_LEGACY_OUTER_CITIZEN_CONTRACT,
  UNISWAP_V3_FACTORY,
  WETH_CONTRACT,
} from './bytes-addresses.mjs';

export {
  AVALANCHE_BYTES_CCIP_POOL,
  AVALANCHE_BYTES_IMPLEMENTATION,
  AVALANCHE_BYTES_TOKEN_CONTRACT,
  AVALANCHE_CHAIN_ID,
  AVALANCHE_CHAIN_NAME,
  BYTES_PARTICIPANT_SNAPSHOT_BLOCK,
  BYTES_PARTICIPANT_SNAPSHOT_BLOCK_HASH,
  BYTES_PARTICIPANT_SNAPSHOT_COUNT,
  BYTES_PARTICIPANT_SNAPSHOT_DIGEST,
  BYTES_STAKING_CONTRACT,
  BYTES_STAKING_DEPLOYMENT_BLOCK,
  BYTES_TOKEN_CONTRACT,
  BYTES_WETH_UNISWAP_V3_POOL,
  CHAINLINK_ETH_USD_FEED,
  ETHEREUM_CHAIN_ID,
  ETHEREUM_CHAIN_NAME,
  MULTICALL3_CONTRACT,
  S1_CITIZEN_CONTRACT,
  S1_LEGACY_CITIZEN_CONTRACT,
  S2_OUTER_CITIZEN_CONTRACT,
  S2_LEGACY_OUTER_CITIZEN_CONTRACT,
  UNISWAP_V3_FACTORY,
  WETH_CONTRACT,
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
  'function S1_CITIZEN() view returns (address)',
  'function S2_CITIZEN() view returns (address)',
  'function getTotalEmissions(uint8 assetType, uint256 fromTimestamp) view returns (uint256)',
  'function getPendingPoolReward(uint8 assetType, address recipient) view returns (uint256 reward, uint256 tax)',
  'function getStakerPositions(address staker) view returns (tuple(tuple(uint256 citizenId, uint256 stakedBytes, uint256 timelockEndTime, uint256 points, uint256 stakedVaultId, bool hasVault)[] stakedS1Citizens, tuple(uint256 citizenId, uint256 stakedBytes, uint256 timelockEndTime, uint256 points)[] stakedS2Citizens, tuple(uint256 amount, uint256 timelockEndTime, uint256 points, uint256 multiplier) stakedLPPosition))',
  'event Stake(address indexed staker, address indexed asset, uint256 timelockOption, uint256 amountOrTokenId)',
  'event Claim(address indexed recipient, uint256 reward, uint256 tax)',
] as const;

export const BYTES_TOKEN_ABI = [
  'function STAKER() view returns (address)',
  'function decimals() view returns (uint8)',
  'function totalSupply() view returns (uint256)',
  'function balanceOf(address account) view returns (uint256)',
] as const;

export const CITIZEN_ERC721_ABI = [
  'function balanceOf(address owner) view returns (uint256)',
  'function totalSupply() view returns (uint256)',
] as const;

export const AVALANCHE_BYTES_TOKEN_ABI = [
  'function name() view returns (string)',
  'function symbol() view returns (string)',
  'function decimals() view returns (uint8)',
  'function totalSupply() view returns (uint256)',
  'function MINTER_ROLE() view returns (bytes32)',
  'function hasRole(bytes32 role, address account) view returns (bool)',
  'function burn(uint256 amount)',
] as const;

export const CCIP_BURN_MINT_POOL_ABI = [
  'function getToken() view returns (address)',
  'function typeAndVersion() view returns (string)',
] as const;

export const BYTES_WETH_UNISWAP_V3_POOL_ABI = [
  'function token0() view returns (address)',
  'function token1() view returns (address)',
  'function factory() view returns (address)',
  'function fee() view returns (uint24)',
  'function liquidity() view returns (uint128)',
  'function slot0() view returns (uint160 sqrtPriceX96, int24 tick, uint16 observationIndex, uint16 observationCardinality, uint16 observationCardinalityNext, uint8 feeProtocol, bool unlocked)',
] as const;

export const UNISWAP_V3_FACTORY_ABI = [
  'function getPool(address tokenA, address tokenB, uint24 fee) view returns (address)',
] as const;

export const CHAINLINK_AGGREGATOR_ABI = [
  'function decimals() view returns (uint8)',
  'function latestRoundData() view returns (uint80 roundId, int256 answer, uint256 startedAt, uint256 updatedAt, uint80 answeredInRound)',
] as const;

export const MULTICALL3_ABI = [
  'function aggregate3(tuple(address target, bool allowFailure, bytes callData)[] calls) payable returns (tuple(bool success, bytes returnData)[] returnData)',
] as const;
