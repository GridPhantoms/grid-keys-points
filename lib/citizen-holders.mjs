import { getAddress } from 'ethers';

const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';

function increment(counts, address) {
  const key = address.toLowerCase();
  counts.set(key, (counts.get(key) ?? 0) + 1);
}

function sortedTokenIds(values) {
  return [...values].sort((a, b) => {
    const left = BigInt(a);
    const right = BigInt(b);
    return left < right ? -1 : left > right ? 1 : 0;
  });
}

export function applyErc721Transfers(transfers) {
  const owners = new Map();
  for (const transfer of transfers) {
    const tokenId = BigInt(transfer.tokenId).toString();
    if (!transfer.to || transfer.to.toLowerCase() === ZERO_ADDRESS) owners.delete(tokenId);
    else owners.set(tokenId, getAddress(transfer.to));
  }
  return owners;
}

export function buildCitizenHolderStats({ directOwners, stakedOwners, stakingContract, supply, topLimit = 25 }) {
  if (!Number.isSafeInteger(supply) || supply <= 0) throw new Error('Citizen supply must be a positive safe integer.');
  const staker = getAddress(stakingContract).toLowerCase();
  const custodyTokenIds = sortedTokenIds(
    [...directOwners].filter(([, owner]) => owner.toLowerCase() === staker).map(([tokenId]) => tokenId),
  );
  const positionTokenIds = sortedTokenIds(stakedOwners.keys());
  if (custodyTokenIds.length !== positionTokenIds.length || custodyTokenIds.some((tokenId, index) => tokenId !== positionTokenIds[index])) {
    throw new Error('Staking custody token IDs do not match active Citizen positions.');
  }
  if (directOwners.size !== supply) throw new Error('Transfer-reconstructed Citizen ownership does not match totalSupply().');

  const directCounts = new Map();
  const stakedCounts = new Map();
  for (const owner of directOwners.values()) {
    if (owner.toLowerCase() !== staker) increment(directCounts, owner);
  }
  for (const owner of stakedOwners.values()) increment(stakedCounts, owner);

  const allAddresses = new Set([...directCounts.keys(), ...stakedCounts.keys()]);
  const rows = [...allAddresses].map((address) => {
    const held = directCounts.get(address) ?? 0;
    const staked = stakedCounts.get(address) ?? 0;
    return { address: getAddress(address), count: held + staked, held, staked };
  }).sort((left, right) => right.count - left.count || left.address.toLowerCase().localeCompare(right.address.toLowerCase()));

  const overlap = [...directCounts.keys()].filter((address) => stakedCounts.has(address)).length;
  const stakedTokens = stakedOwners.size;
  return {
    supply,
    uniqueOwners: rows.length,
    ownerPercentage: rows.length / supply * 100,
    rawCustodyOwnerCount: new Set([...directOwners.values()].map((address) => address.toLowerCase())).size,
    directHolderWallets: directCounts.size,
    activeStakerWallets: stakedCounts.size,
    directAndStakedOverlap: overlap,
    directTokens: supply - stakedTokens,
    stakedTokens,
    top: rows.slice(0, topLimit).map((row, index) => ({ rank: index + 1, ...row })),
  };
}
