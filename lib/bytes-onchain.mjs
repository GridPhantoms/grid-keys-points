import { createHash } from 'node:crypto';
import { formatUnits, getAddress } from 'ethers';

export const PARTICIPANT_SNAPSHOT_SCHEMA_VERSION = 1;
export const PARTICIPANT_METHODOLOGY = 'Unique Stake.staker and Claim.recipient addresses from deploymentBlock through sourceBlock inclusive; checksummed, deduplicated, and sorted by lowercase address.';
export const CANONICAL_IDENTITY_FAILURE_REASON = 'Canonical Ethereum BYTES contract linkage could not be verified at the source block.';
export const PENDING_FAILURE_REASON = 'The indexed aggregate pending-reward read is temporarily unavailable.';

function canonicalTimestamp(value, label) {
  if (typeof value !== 'string' || new Date(value).toISOString() !== value) {
    throw new TypeError(`${label} must be a canonical ISO-8601 timestamp`);
  }
  return value;
}

function positiveInteger(value, label) {
  if (!Number.isInteger(value) || value <= 0) throw new TypeError(`${label} must be a positive integer`);
  return value;
}

function nonnegativeInteger(value, label) {
  if (!Number.isInteger(value) || value < 0) throw new TypeError(`${label} must be a nonnegative integer`);
  return value;
}

function canonicalAddress(value, label) {
  if (typeof value !== 'string') throw new TypeError(`${label} must be an address`);
  const address = getAddress(value);
  if (address !== value) throw new TypeError(`${label} must be checksummed`);
  return address;
}

function sortedUniqueAddresses(addresses) {
  if (!Array.isArray(addresses)) throw new TypeError('addresses must be an array');
  return [...new Map(addresses.map((value) => {
    const address = getAddress(value);
    return [address.toLowerCase(), address];
  })).values()].sort((left, right) => left.toLowerCase().localeCompare(right.toLowerCase()));
}

export function participantAddressesDigest(addresses) {
  const normalized = sortedUniqueAddresses(addresses);
  return createHash('sha256').update(normalized.map((address) => address.toLowerCase()).join('\n')).digest('hex');
}

function validateSnapshotEvidence(evidence) {
  if (!evidence || typeof evidence !== 'object' || Array.isArray(evidence)) throw new TypeError('participant snapshot evidence must be an object');
  const expectedKeys = ['collectorVersion', 'stakeEventCount', 'claimEventCount', 'uniqueStakeParticipants', 'uniqueClaimRecipients', 'logQueryCalls', 'logQueryRetries'];
  if (Object.keys(evidence).join(',') !== expectedKeys.join(',')) throw new TypeError('participant snapshot evidence has an invalid shape');
  if (typeof evidence.collectorVersion !== 'string' || evidence.collectorVersion.length === 0) throw new TypeError('collectorVersion must be a nonempty string');
  for (const key of expectedKeys.slice(1)) nonnegativeInteger(evidence[key], key);
  return evidence;
}

export function buildParticipantSnapshot({ generatedAt, sourceBlock, sourceBlockHash, deploymentBlock, contract, evidence, addresses }) {
  const normalized = sortedUniqueAddresses(addresses);
  if (typeof sourceBlockHash !== 'string' || !/^0x[0-9a-fA-F]{64}$/.test(sourceBlockHash)) throw new TypeError('sourceBlockHash must be a block hash');
  return {
    schemaVersion: PARTICIPANT_SNAPSHOT_SCHEMA_VERSION,
    generatedAt: canonicalTimestamp(generatedAt, 'generatedAt'),
    sourceBlock: positiveInteger(sourceBlock, 'sourceBlock'),
    sourceBlockHash: sourceBlockHash.toLowerCase(),
    deploymentBlock: positiveInteger(deploymentBlock, 'deploymentBlock'),
    contract: getAddress(contract),
    methodology: PARTICIPANT_METHODOLOGY,
    evidence: validateSnapshotEvidence(evidence),
    count: normalized.length,
    addressesSha256: participantAddressesDigest(normalized),
    addresses: normalized,
  };
}

export function validateParticipantSnapshot(value, expected = {}) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new TypeError('participant snapshot must be an object');
  const expectedKeys = ['schemaVersion', 'generatedAt', 'sourceBlock', 'sourceBlockHash', 'deploymentBlock', 'contract', 'methodology', 'evidence', 'count', 'addressesSha256', 'addresses'];
  if (Object.keys(value).join(',') !== expectedKeys.join(',')) throw new TypeError('participant snapshot has an invalid shape');
  if (value.schemaVersion !== PARTICIPANT_SNAPSHOT_SCHEMA_VERSION) throw new TypeError('participant snapshot schemaVersion is unsupported');
  canonicalTimestamp(value.generatedAt, 'generatedAt');
  positiveInteger(value.sourceBlock, 'sourceBlock');
  if (typeof value.sourceBlockHash !== 'string' || !/^0x[0-9a-f]{64}$/.test(value.sourceBlockHash)) throw new TypeError('participant snapshot sourceBlockHash is invalid');
  positiveInteger(value.deploymentBlock, 'deploymentBlock');
  if (value.sourceBlock < value.deploymentBlock) throw new TypeError('sourceBlock must not precede deploymentBlock');
  canonicalAddress(value.contract, 'contract');
  if (value.methodology !== PARTICIPANT_METHODOLOGY) throw new TypeError('participant snapshot methodology is invalid');
  validateSnapshotEvidence(value.evidence);
  if (!Array.isArray(value.addresses)) throw new TypeError('participant snapshot addresses must be an array');
  if (value.count !== value.addresses.length) throw new TypeError('participant snapshot count must equal addresses length');

  let previous = '';
  const seen = new Set();
  for (const [index, address] of value.addresses.entries()) {
    canonicalAddress(address, `addresses[${index}]`);
    const key = address.toLowerCase();
    if (seen.has(key)) throw new TypeError('participant snapshot addresses must be unique');
    if (previous && key <= previous) throw new TypeError('participant snapshot addresses must be sorted');
    seen.add(key);
    previous = key;
  }
  const digest = participantAddressesDigest(value.addresses);
  if (value.addressesSha256 !== digest) throw new TypeError('participant snapshot address digest does not match');

  if (expected.contract && value.contract !== getAddress(expected.contract)) throw new TypeError('participant snapshot contract does not match');
  if (expected.deploymentBlock !== undefined && value.deploymentBlock !== expected.deploymentBlock) throw new TypeError('participant snapshot deploymentBlock does not match');
  if (expected.sourceBlock !== undefined && value.sourceBlock !== expected.sourceBlock) throw new TypeError('participant snapshot sourceBlock does not match');
  if (expected.sourceBlockHash !== undefined && value.sourceBlockHash !== expected.sourceBlockHash.toLowerCase()) throw new TypeError('participant snapshot sourceBlockHash does not match');
  if (expected.count !== undefined && value.count !== expected.count) throw new TypeError('participant snapshot expected count does not match');
  if (expected.addressesSha256 !== undefined && value.addressesSha256 !== expected.addressesSha256) throw new TypeError('participant snapshot expected digest does not match');
  return value;
}

export function validatePendingWorkBounds({ snapshotBlock, currentBlock, participantCount, chunkCount }, limits) {
  positiveInteger(snapshotBlock, 'snapshotBlock');
  positiveInteger(currentBlock, 'currentBlock');
  positiveInteger(participantCount, 'participantCount');
  positiveInteger(chunkCount, 'chunkCount');
  if (currentBlock < snapshotBlock) throw new RangeError('currentBlock must not precede snapshotBlock');
  if (currentBlock - snapshotBlock > limits.maxDeltaBlocks) throw new RangeError('participant snapshot delta exceeds the operational limit');
  if (participantCount > limits.maxParticipants) throw new RangeError('participant count exceeds the operational limit');
  if (chunkCount > limits.maxChunks) throw new RangeError('multicall chunk count exceeds the operational limit');
  return true;
}

export function mergeParticipantAddresses(snapshot, deltaAddresses) {
  validateParticipantSnapshot(snapshot);
  return sortedUniqueAddresses([...snapshot.addresses, ...deltaAddresses]);
}

export function verifyCanonicalTokenLinks(stakingBytes, tokenStaker, decimals, { tokenContract, stakingContract }) {
  try {
    return getAddress(stakingBytes) === getAddress(tokenContract)
      && getAddress(tokenStaker) === getAddress(stakingContract)
      && BigInt(decimals) === 18n;
  } catch {
    return false;
  }
}

function decimalMetricValue(value, label) {
  const rawValue = formatUnits(value, 18);
  const numericValue = Number(rawValue);
  if (!Number.isFinite(numericValue) || numericValue < 0) throw new TypeError(`${label} must be a finite nonnegative token amount`);
  return { numericValue, rawValue };
}

function observedTokenMetric(value, source, asOf, formula) {
  const { numericValue, rawValue } = decimalMetricValue(value, source);
  return {
    value: numericValue,
    rawValue,
    unit: 'BYTES',
    classification: 'observed',
    source,
    asOf: canonicalTimestamp(asOf, 'asOf'),
    availability: 'available',
    formula,
    assumptions: ['Ethereum chain ID 1', '18 token decimals', 'Bidirectional staking/token identity verified at the same source block'],
  };
}

export function tokenMetrics({ totalSupply, stakingBalance, asOf }) {
  return {
    ethBytes2Supply: observedTokenMetric(
      totalSupply,
      'canonical-ethereum-bytes:totalSupply',
      asOf,
      'staking.BYTES() == canonical token && token.STAKER() == staking contract && token.decimals() == 18; then token.totalSupply()',
    ),
    bytesHeldByStakingContract: observedTokenMetric(
      stakingBalance,
      'canonical-ethereum-bytes:balanceOf(staking-contract)',
      asOf,
      'staking.BYTES() == canonical token && token.STAKER() == staking contract && token.decimals() == 18; then token.balanceOf(staking contract)',
    ),
  };
}

export function canonicalIdentityUnavailableMetrics(asOf, reason = CANONICAL_IDENTITY_FAILURE_REASON) {
  const metric = (source) => ({
    value: null,
    unit: 'BYTES',
    classification: 'observed',
    source,
    asOf: canonicalTimestamp(asOf, 'asOf'),
    availability: 'unavailable',
    reason,
  });
  return {
    ethBytes2Supply: metric('canonical-ethereum-bytes:identity-gated'),
    bytesHeldByStakingContract: metric('canonical-ethereum-bytes:identity-gated'),
  };
}

export function pendingRewardsMetric({ reward, tax, asOf, participantCount, snapshotBlock }) {
  positiveInteger(participantCount, 'participantCount');
  positiveInteger(snapshotBlock, 'snapshotBlock');
  const pending = decimalMetricValue(reward, 'pending reward');
  const daoTax = decimalMetricValue(tax, 'pending DAO tax');
  return {
    value: pending.numericValue,
    rawValue: pending.rawValue,
    unit: 'BYTES',
    classification: 'calculated',
    source: 'staking-contract:getPendingPoolReward-indexed-aggregate',
    asOf: canonicalTimestamp(asOf, 'asOf'),
    availability: 'available',
    formula: 'snapshot-block sum of getPendingPoolReward(pool, participant).reward for every indexed participant and economically claimable pools 0, 1, and 3',
    assumptions: [
      `${participantCount.toLocaleString('en-US')} indexed participants from Stake.staker and Claim.recipient events`,
      'Economically claimable staking pools S1 (0), S2 (1), and LP (3); claimReward does not claim pool 2',
      'DAO tax is summed separately and excluded from the net pending reward snapshot aggregate',
      `Snapshot source block ${snapshotBlock.toLocaleString('en-US')} plus event-log delta through the response source block`,
    ],
    daoTaxExcluded: daoTax.numericValue,
    daoTaxExcludedRawValue: daoTax.rawValue,
  };
}

export function pendingRewardsUnavailableMetric(asOf, reason = PENDING_FAILURE_REASON) {
  return {
    value: null,
    unit: 'BYTES',
    classification: 'calculated',
    source: 'staking-contract:getPendingPoolReward-indexed-aggregate',
    asOf: canonicalTimestamp(asOf, 'asOf'),
    availability: 'unavailable',
    reason,
  };
}
