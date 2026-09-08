import { createHash } from 'node:crypto';
import { getAddress } from 'ethers';

const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';
const COMPONENT_KINDS = ['identity', 'vault', 'item', 'land'];
const REQUIRED_COMPONENTS = ['identity', 'item', 'land'];

function normalizeTransfers(transfers) {
  return transfers.map((transfer, sequence) => ({
    ...transfer,
    tokenId: BigInt(transfer.tokenId).toString(),
    from: transfer.from.toLowerCase(),
    to: transfer.to.toLowerCase(),
    txHash: transfer.txHash.toLowerCase(),
    sequence,
  })).sort((left, right) => (
    left.blockNumber - right.blockNumber
    || (left.transactionIndex ?? 0) - (right.transactionIndex ?? 0)
    || (left.logIndex ?? 0) - (right.logIndex ?? 0)
    || left.sequence - right.sequence
  ));
}

function groupBy(rows, field) {
  const grouped = new Map();
  for (const row of rows) {
    const key = String(row[field]).toLowerCase();
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key).push(row);
  }
  return grouped;
}

function tokenIdDigest(tokenIds) {
  const sorted = [...tokenIds].map((value) => BigInt(value)).sort((a, b) => a < b ? -1 : a > b ? 1 : 0);
  return createHash('sha256').update(sorted.map(String).join(',')).digest('hex');
}

function cohortFor(kind, transfers, expected) {
  if (!Number.isSafeInteger(expected.mintEndBlock)) throw new Error(`Original ${kind} cohort requires an immutable mint-end block.`);
  if (!Array.isArray(expected.tokenIds) || expected.tokenIds.length !== expected.count) {
    throw new Error(`Original ${kind} cohort requires the exact immutable token-ID manifest.`);
  }
  const ids = new Set(expected.tokenIds.map((value) => BigInt(value).toString()));
  if (ids.size !== expected.count) throw new Error(`Original ${kind} manifest contains a duplicate token ID.`);
  const mints = transfers.filter((row) => row.from === ZERO_ADDRESS && ids.has(row.tokenId));
  if (mints.length !== ids.size) throw new Error(`Original ${kind} cohort contains a duplicate or missing token ID.`);
  if (mints.some((row) => row.blockNumber > expected.mintEndBlock)) {
    throw new Error(`Original ${kind} manifest includes a mint after its immutable mint-end block.`);
  }
  const digest = tokenIdDigest(ids);
  if (expected.digestSha256 && digest !== expected.digestSha256) {
    throw new Error(`Original ${kind} token IDs do not match the immutable original-distribution cohort.`);
  }
  return { count: mints.length, digestSha256: digest, tokenIds: ids };
}

export function originalS1AuditRowsDigest(rows) {
  const serialized = [...rows]
    .sort((left, right) => Number(BigInt(left.citizenId) - BigInt(right.citizenId)))
    .map((row) => JSON.stringify({
      citizenId: BigInt(row.citizenId).toString(),
      assemblyWallet: row.assemblyWallet.toLowerCase(),
      assemblyBlock: row.assemblyBlock,
      assemblyTxHash: row.assemblyTxHash.toLowerCase(),
      components: {
        identity: row.components.identity == null ? null : BigInt(row.components.identity).toString(),
        vault: row.components.vault == null ? null : BigInt(row.components.vault).toString(),
        item: row.components.item == null ? null : BigInt(row.components.item).toString(),
        land: row.components.land == null ? null : BigInt(row.components.land).toString(),
      },
      location: row.location,
      currentBeneficialOwner: row.currentBeneficialOwner.toLowerCase(),
      originalWallet: Boolean(row.originalWallet),
    }))
    .join('\n');
  return createHash('sha256').update(serialized).digest('hex');
}

function locationCounts(rows) {
  const result = { legacy: 0, v2: 0, staked: 0 };
  for (const row of rows) result[row.location] += 1;
  return result;
}

export function buildOriginalS1Distinctions({
  componentTransfers,
  legacyCitizenTransfers,
  v2CitizenTransfers,
  currentV2Owners,
  currentStakedOwners,
  legacyCitizenContract,
  v2CitizenContract,
  stakingContract,
  expectedComponentCohorts,
}) {
  const legacy = getAddress(legacyCitizenContract).toLowerCase();
  const v2 = getAddress(v2CitizenContract).toLowerCase();
  const staker = getAddress(stakingContract).toLowerCase();
  const components = Object.fromEntries(COMPONENT_KINDS.map((kind) => [kind, normalizeTransfers(componentTransfers[kind] ?? [])]));
  const componentByTx = Object.fromEntries(COMPONENT_KINDS.map((kind) => [kind, groupBy(components[kind], 'txHash')]));
  const componentByToken = Object.fromEntries(COMPONENT_KINDS.map((kind) => [kind, groupBy(components[kind], 'tokenId')]));
  const cohorts = Object.fromEntries(COMPONENT_KINDS.map((kind) => [
    kind,
    cohortFor(kind, components[kind], expectedComponentCohorts[kind]),
  ]));
  const legacyCitizens = normalizeTransfers(legacyCitizenTransfers);
  const v2Citizens = normalizeTransfers(v2CitizenTransfers);
  const legacyByToken = groupBy(legacyCitizens, 'tokenId');
  const v2ByToken = groupBy(v2Citizens, 'tokenId');
  const v2ByTx = groupBy(v2Citizens, 'txHash');
  const exclusions = {
    malformedUpload: 0,
    nonOriginalComponents: 0,
    disassembledOrReassembled: 0,
    inactiveOrUnresolved: 0,
  };
  const qualifyingUploads = [];

  for (const citizenMint of legacyCitizens.filter((row) => row.from === ZERO_ADDRESS)) {
    const assemblyWallet = citizenMint.to;
    const componentIds = {};
    let malformed = false;
    let original = true;
    for (const kind of COMPONENT_KINDS) {
      const deposits = (componentByTx[kind].get(citizenMint.txHash) ?? []).filter((row) => (
        row.from === assemblyWallet && row.to === legacy
      ));
      const required = REQUIRED_COMPONENTS.includes(kind);
      if (deposits.length > 1) {
        malformed = true;
        break;
      }
      if (required && deposits.length === 0) original = false;
      if (!deposits.length) {
        componentIds[kind] = null;
        continue;
      }
      const deposit = deposits[0];
      componentIds[kind] = deposit.tokenId;
      const history = componentByToken[kind].get(deposit.tokenId) ?? [];
      const depositIndex = history.indexOf(deposit);
      const priorDeposits = history.slice(0, depositIndex).some((row) => row.to === legacy);
      const latestMint = history.slice(0, depositIndex + 1).filter((row) => row.from === ZERO_ADDRESS).at(-1);
      if (
        priorDeposits
        || !latestMint
        || latestMint.blockNumber > expectedComponentCohorts[kind].mintEndBlock
        || !cohorts[kind].tokenIds.has(deposit.tokenId)
      ) original = false;
    }
    if (malformed) {
      exclusions.malformedUpload += 1;
      continue;
    }
    if (!original) {
      exclusions.nonOriginalComponents += 1;
      continue;
    }
    qualifyingUploads.push({
      citizenId: citizenMint.tokenId,
      assemblyWallet: getAddress(assemblyWallet),
      assemblyBlock: citizenMint.blockNumber,
      assemblyTxHash: citizenMint.txHash,
      components: componentIds,
      mintEvent: citizenMint,
    });
  }

  const originalUploadRows = [];
  const originalWalletRows = [];
  for (const upload of qualifyingUploads) {
    const wallet = upload.assemblyWallet.toLowerCase();
    const legacyHistory = legacyByToken.get(upload.citizenId) ?? [];
    const mintIndex = legacyHistory.indexOf(upload.mintEvent);
    if (mintIndex < 0) throw new Error(`Missing original upload mint for Citizen ${upload.citizenId}.`);
    const laterLegacy = legacyHistory.slice(mintIndex + 1);
    if (laterLegacy.some((row) => row.to === ZERO_ADDRESS)) {
      exclusions.disassembledOrReassembled += 1;
      continue;
    }

    let location = 'legacy';
    let beneficialOwner = laterLegacy.at(-1)?.to ?? wallet;
    let migrated = false;
    let migrationEvent = null;
    const legacyToV2 = laterLegacy.filter((row) => row.to === v2);
    if (legacyToV2.length > 1) {
      exclusions.inactiveOrUnresolved += 1;
      continue;
    }
    if (legacyToV2.length === 1) {
      migrationEvent = legacyToV2[0];
      const v2Mints = (v2ByTx.get(migrationEvent.txHash) ?? []).filter((row) => (
        row.from === ZERO_ADDRESS && row.tokenId === upload.citizenId && row.to === migrationEvent.from
      ));
      if (v2Mints.length !== 1) {
        exclusions.inactiveOrUnresolved += 1;
        continue;
      }
      migrated = true;
      const v2History = v2ByToken.get(upload.citizenId) ?? [];
      const v2MintIndex = v2History.indexOf(v2Mints[0]);
      if (v2MintIndex < 0 || v2History.slice(v2MintIndex + 1).some((row) => row.to === ZERO_ADDRESS)) {
        exclusions.disassembledOrReassembled += 1;
        continue;
      }
      const finalOwner = v2History.at(-1)?.to;
      const indexedOwner = currentV2Owners.get(upload.citizenId)?.toLowerCase();
      if (!finalOwner || finalOwner !== indexedOwner) throw new Error(`Current V2 owner mismatch for original upload ${upload.citizenId}.`);
      if (finalOwner === staker) {
        const stakedOwner = currentStakedOwners.get(upload.citizenId)?.toLowerCase();
        if (!stakedOwner) {
          exclusions.inactiveOrUnresolved += 1;
          continue;
        }
        location = 'staked';
        beneficialOwner = stakedOwner;
      } else {
        location = 'v2';
        beneficialOwner = finalOwner;
      }
    } else if (!beneficialOwner || beneficialOwner === ZERO_ADDRESS || beneficialOwner === v2) {
      exclusions.inactiveOrUnresolved += 1;
      continue;
    }

    const row = { ...upload, location, currentBeneficialOwner: getAddress(beneficialOwner) };
    delete row.mintEvent;
    originalUploadRows.push(row);

    let walletContinuous = true;
    for (const event of laterLegacy) {
      if (event === migrationEvent) {
        if (event.from !== wallet) walletContinuous = false;
      } else if (event.from !== wallet || event.to !== wallet) walletContinuous = false;
    }
    if (migrated && walletContinuous) {
      const v2History = v2ByToken.get(upload.citizenId) ?? [];
      const mintIndexV2 = v2History.findIndex((event) => event.from === ZERO_ADDRESS && event.txHash === migrationEvent.txHash);
      let custody = 'direct';
      for (const event of v2History.slice(mintIndexV2 + 1)) {
        if (custody === 'direct' && event.from === wallet && event.to === staker) custody = 'staked';
        else if (custody === 'staked' && event.from === staker && event.to === wallet) custody = 'direct';
        else if (event.from !== wallet || event.to !== wallet) walletContinuous = false;
      }
      if (custody === 'staked' && currentStakedOwners.get(upload.citizenId)?.toLowerCase() !== wallet) walletContinuous = false;
    }
    if (beneficialOwner !== wallet) walletContinuous = false;
    if (walletContinuous) originalWalletRows.push(row);
  }

  originalUploadRows.sort((a, b) => Number(BigInt(a.citizenId) - BigInt(b.citizenId)));
  originalWalletRows.sort((a, b) => Number(BigInt(a.citizenId) - BigInt(b.citizenId)));
  const output = (rows) => ({
    citizens: rows.length,
    uniqueWallets: new Set(rows.map((row) => row.currentBeneficialOwner.toLowerCase())).size,
    percentageOfOriginalComponentUploads: qualifyingUploads.length ? rows.length / qualifyingUploads.length * 100 : 0,
    locations: locationCounts(rows),
    tokenIds: rows.map((row) => row.citizenId),
    rows,
  });
  return {
    componentCohorts: Object.fromEntries(COMPONENT_KINDS.map((kind) => [kind, {
      count: cohorts[kind].count,
      mintEndBlock: expectedComponentCohorts[kind].mintEndBlock,
      digestSha256: cohorts[kind].digestSha256,
    }])),
    originalComponentUploads: qualifyingUploads.length,
    originalUpload: output(originalUploadRows),
    originalWallet: output(originalWalletRows),
    exclusions,
  };
}
