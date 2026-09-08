import { createHash } from 'node:crypto';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Contract, FetchRequest, Interface, JsonRpcProvider, getAddress, id } from 'ethers';
import { buildCitizenHolderStats } from '../lib/citizen-holders.mjs';
import { buildOriginalS1Distinctions, originalS1AuditRowsDigest } from '../lib/citizen-lineage.mjs';
import {
  BYTES_STAKING_CONTRACT,
  ETHEREUM_CHAIN_ID,
  MULTICALL3_CONTRACT,
  S1_CITIZEN_CONTRACT,
  S1_LEGACY_CITIZEN_CONTRACT,
  S1_ORIGINAL_IDENTITY_CONTRACT,
  S1_ORIGINAL_ITEM_CONTRACT,
  S1_ORIGINAL_LAND_CONTRACT,
  S1_ORIGINAL_VAULT_CONTRACT,
  S2_OUTER_CITIZEN_CONTRACT,
} from '../lib/bytes-addresses.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const OUTPUT = resolve(ROOT, 'data/citizen-holder-snapshot.json');
const AUDIT_OUTPUT = resolve(ROOT, 'data/citizen-s1-lineage-audit.json');
const PUBLIC_OUTPUT = resolve(ROOT, 'data/citizen-holder-public.json');
const COHORT_MANIFEST = resolve(ROOT, 'data/s1-original-component-cohorts.json');
const PARTICIPANTS = resolve(ROOT, 'data/bytes-staking-participants.json');
const ALCHEMY_PAGE_SIZE = '0x3e8';
const DELTA_LOG_SPAN = 50_000;
const MULTICALL_CHUNK_SIZE = 250;
const TOP_LIMIT = 25;
const EXPECTED_COHORT_MANIFEST_DIGEST = '2fcbe574ba3343dae1294947ddcc67a6ebc28526b51d3d321a520f1e3de4c351';
const COMPONENT_CONTRACTS = {
  identity: S1_ORIGINAL_IDENTITY_CONTRACT,
  vault: S1_ORIGINAL_VAULT_CONTRACT,
  item: S1_ORIGINAL_ITEM_CONTRACT,
  land: S1_ORIGINAL_LAND_CONTRACT,
};
const STAKING_ABI = [
  'function getStakerPositions(address staker) view returns (tuple(tuple(uint256 citizenId, uint256 stakedBytes, uint256 timelockEndTime, uint256 points, uint256 stakedVaultId, bool hasVault)[] stakedS1Citizens, tuple(uint256 citizenId, uint256 stakedBytes, uint256 timelockEndTime, uint256 points)[] stakedS2Citizens, tuple(uint256 amount, uint256 timelockEndTime, uint256 points, uint256 multiplier) stakedLPPosition))',
];
const ERC721_ABI = [
  'function balanceOf(address owner) view returns (uint256)',
  'function totalSupply() view returns (uint256)',
];
const MULTICALL_ABI = [
  'function aggregate3(tuple(address target, bool allowFailure, bytes callData)[] calls) payable returns (tuple(bool success, bytes returnData)[] returnData)',
];
const ownerOfInterface = new Interface(['function ownerOf(uint256 tokenId) view returns (address)']);
const legacyCitizenInterface = new Interface([
  'function getIdentityIdOfTokenId(uint256 citizenId) view returns (uint256)',
  'function getVaultIdOfTokenId(uint256 citizenId) view returns (uint256)',
  'function getItemCacheIdOfTokenId(uint256 citizenId) view returns (uint256)',
  'function getLandDeedIdOfTokenId(uint256 citizenId) view returns (uint256)',
]);
const stakingInterface = new Interface(STAKING_ABI);
const participantTopics = [[
  id('Stake(address,address,uint256,uint256)'),
  id('Claim(address,uint256,uint256)'),
]];
const collections = {
  s1: S1_CITIZEN_CONTRACT,
  s2: S2_OUTER_CITIZEN_CONTRACT,
};

for (const envFile of ['.env.local', '.env']) {
  try { process.loadEnvFile(resolve(ROOT, envFile)); } catch {}
}

function alchemyUrl() {
  if (!process.env.ALCHEMY_API_KEY) throw new Error('Private Alchemy configuration is required.');
  return `https://eth-mainnet.g.alchemy.com/v2/${process.env.ALCHEMY_API_KEY}`;
}

function rpcUrl() {
  return process.env.ETHEREUM_RPC_URL || alchemyUrl();
}

async function alchemyRpc(method, params) {
  let lastError;
  for (let attempt = 1; attempt <= 4; attempt += 1) {
    try {
      const response = await fetch(alchemyUrl(), {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
      });
      if ((response.status === 429 || response.status >= 500) && attempt < 4) {
        await new Promise((resolveDelay) => setTimeout(resolveDelay, 500 * 2 ** (attempt - 1)));
        continue;
      }
      if (!response.ok) throw new Error(`Alchemy ${method} returned HTTP ${response.status}.`);
      const payload = await response.json();
      if (payload.error) throw new Error(`Alchemy ${method} failed.`);
      return payload.result;
    } catch (error) {
      lastError = error;
      if (attempt === 4) break;
      await new Promise((resolveDelay) => setTimeout(resolveDelay, 500 * 2 ** (attempt - 1)));
    }
  }
  throw lastError instanceof Error ? lastError : new Error(`Alchemy ${method} failed.`);
}

async function verifyAlchemyBlock(block) {
  const observed = await alchemyRpc('eth_getBlockByNumber', [`0x${block.number.toString(16)}`, false]);
  if (!observed?.hash || observed.hash.toLowerCase() !== block.hash.toLowerCase()) {
    throw new Error('Alchemy transfer index does not match the pinned Ethereum source block.');
  }
}

function transferTokenId(transfer) {
  const raw = transfer.erc721TokenId ?? transfer.tokenId ?? transfer.rawContract?.value;
  if (typeof raw !== 'string' || !/^(?:0x[0-9a-f]+|\d+)$/i.test(raw)) throw new Error('Indexed ERC-721 transfer omitted its token ID.');
  return BigInt(raw).toString();
}

function componentManifestDigest(components) {
  const serialized = ['identity', 'vault', 'item', 'land'].flatMap((kind) => (
    components[kind].mints.map((row) => `${kind}:${BigInt(row.tokenId)}:${row.mintBlock}:${row.txHash.toLowerCase()}:${row.issuancePath}`)
  )).join('\n');
  return createHash('sha256').update(serialized).digest('hex');
}

async function loadAndVerifyComponentManifest(componentTransferData) {
  const manifest = JSON.parse(await readFile(COHORT_MANIFEST, 'utf8'));
  if (manifest.schemaVersion !== 1 || manifest.chainId !== ETHEREUM_CHAIN_ID || !manifest.components) {
    throw new Error('Original component cohort manifest schema or chain is invalid.');
  }
  const digest = componentManifestDigest(manifest.components);
  if (digest !== EXPECTED_COHORT_MANIFEST_DIGEST || digest !== manifest.manifestRowsDigestSha256) {
    throw new Error('Original component cohort manifest digest changed.');
  }
  const cohorts = {};
  for (const kind of ['identity', 'vault', 'item', 'land']) {
    const component = manifest.components[kind];
    if (
      !component
      || getAddress(component.contract) !== getAddress(COMPONENT_CONTRACTS[kind])
      || !Number.isSafeInteger(component.mintEndBlock)
      || !Number.isSafeInteger(component.count)
      || !Array.isArray(component.mints)
      || component.mints.length !== component.count
      || !Array.isArray(component.approvedIssuancePaths)
    ) throw new Error(`Original ${kind} cohort manifest is malformed.`);
    const transferMints = new Set(componentTransferData[kind].transfers
      .filter((row) => row.from.toLowerCase() === '0x0000000000000000000000000000000000000000')
      .map((row) => `${BigInt(row.tokenId)}:${row.blockNumber}:${row.txHash.toLowerCase()}`));
    const tokenIds = [];
    for (const row of component.mints) {
      const tokenId = BigInt(row.tokenId).toString();
      if (
        !Number.isSafeInteger(row.mintBlock)
        || row.mintBlock > component.mintEndBlock
        || !/^0x[0-9a-f]{64}$/i.test(row.txHash)
        || !component.approvedIssuancePaths.includes(row.issuancePath)
        || !transferMints.has(`${tokenId}:${row.mintBlock}:${row.txHash.toLowerCase()}`)
      ) throw new Error(`Original ${kind} manifest row ${tokenId} is not supported by the indexed mint ledger.`);
      tokenIds.push(tokenId);
    }
    const tokenDigest = createHash('sha256').update(tokenIds.map(BigInt).sort((a, b) => a < b ? -1 : a > b ? 1 : 0).join(',')).digest('hex');
    if (new Set(tokenIds).size !== component.count || tokenDigest !== component.tokenIdDigestSha256) {
      throw new Error(`Original ${kind} cohort token IDs changed.`);
    }
    cohorts[kind] = {
      count: component.count,
      mintEndBlock: component.mintEndBlock,
      digestSha256: component.tokenIdDigestSha256,
      tokenIds,
    };
  }
  return { cohorts, digest };
}

async function collectTransferOwners(contract, toBlock) {
  const owners = new Map();
  const transfers = [];
  let pageKey;
  let eventCount = 0;
  let pageCount = 0;
  do {
    const request = {
      fromBlock: '0x0',
      toBlock: `0x${toBlock.toString(16)}`,
      contractAddresses: [contract],
      category: ['erc721'],
      withMetadata: false,
      excludeZeroValue: false,
      maxCount: ALCHEMY_PAGE_SIZE,
      order: 'asc',
    };
    if (pageKey) request.pageKey = pageKey;
    const result = await alchemyRpc('alchemy_getAssetTransfers', [request]);
    if (!Array.isArray(result?.transfers)) throw new Error('Alchemy returned a malformed ERC-721 transfer page.');
    for (const transfer of result.transfers) {
      const tokenId = transferTokenId(transfer);
      if (!transfer.from || !transfer.to || typeof transfer.hash !== 'string' || typeof transfer.blockNum !== 'string') {
        throw new Error('Indexed ERC-721 transfer omitted lineage fields.');
      }
      transfers.push({
        tokenId,
        from: transfer.from,
        to: transfer.to,
        txHash: transfer.hash,
        blockNumber: Number.parseInt(transfer.blockNum, 16),
      });
      if (transfer.to.toLowerCase() === '0x0000000000000000000000000000000000000000') owners.delete(tokenId);
      else owners.set(tokenId, getAddress(transfer.to));
      eventCount += 1;
    }
    pageKey = result.pageKey;
    pageCount += 1;
  } while (pageKey);
  return { owners, transfers, eventCount, pageCount };
}

async function collectParticipants(provider, sourceBlock) {
  const snapshot = JSON.parse(await readFile(PARTICIPANTS, 'utf8'));
  if (!Array.isArray(snapshot.addresses) || !Number.isSafeInteger(snapshot.sourceBlock)) throw new Error('Participant snapshot is malformed.');
  const participants = new Map(snapshot.addresses.map((address) => [address.toLowerCase(), getAddress(address)]));
  let deltaEventCount = 0;
  for (let start = snapshot.sourceBlock + 1; start <= sourceBlock; start += DELTA_LOG_SPAN) {
    const logs = await provider.getLogs({
      address: BYTES_STAKING_CONTRACT,
      topics: participantTopics,
      fromBlock: start,
      toBlock: Math.min(sourceBlock, start + DELTA_LOG_SPAN - 1),
    });
    deltaEventCount += logs.length;
    for (const log of logs) {
      const topic = log.topics[1];
      if (typeof topic !== 'string' || topic.length !== 66) throw new Error('Malformed staking participant topic.');
      const address = getAddress(`0x${topic.slice(26)}`);
      participants.set(address.toLowerCase(), address);
    }
  }
  return { participants: [...participants.values()], baselineBlock: snapshot.sourceBlock, deltaEventCount };
}

async function readStakedOwners(multicall, participants, blockNumber) {
  const result = { s1: new Map(), s2: new Map() };
  const calls = participants.map((address) => ({
    target: BYTES_STAKING_CONTRACT,
    allowFailure: false,
    callData: stakingInterface.encodeFunctionData('getStakerPositions', [address]),
  }));
  for (let start = 0; start < calls.length; start += MULTICALL_CHUNK_SIZE) {
    const chunk = calls.slice(start, start + MULTICALL_CHUNK_SIZE);
    const responses = await multicall.aggregate3.staticCall(chunk, { blockTag: blockNumber });
    responses.forEach((response, index) => {
      if (!response.success) throw new Error('A staker-position read failed.');
      const [positions] = stakingInterface.decodeFunctionResult('getStakerPositions', response.returnData);
      const owner = participants[start + index];
      for (const position of positions.stakedS1Citizens) {
        const tokenId = position.citizenId.toString();
        if (result.s1.has(tokenId)) throw new Error(`Duplicate S1 staking position ${tokenId}.`);
        result.s1.set(tokenId, owner);
      }
      for (const position of positions.stakedS2Citizens) {
        const tokenId = position.citizenId.toString();
        if (result.s2.has(tokenId)) throw new Error(`Duplicate S2 staking position ${tokenId}.`);
        result.s2.set(tokenId, owner);
      }
    });
  }
  return result;
}

async function verifyOwners(multicall, contract, owners, blockNumber) {
  const entries = [...owners.entries()];
  for (let start = 0; start < entries.length; start += MULTICALL_CHUNK_SIZE) {
    const chunk = entries.slice(start, start + MULTICALL_CHUNK_SIZE);
    const responses = await multicall.aggregate3.staticCall(chunk.map(([tokenId]) => ({
      target: contract,
      allowFailure: false,
      callData: ownerOfInterface.encodeFunctionData('ownerOf', [tokenId]),
    })), { blockTag: blockNumber });
    responses.forEach((response, index) => {
      if (!response.success) throw new Error('A Citizen ownerOf verification failed.');
      const [actual] = ownerOfInterface.decodeFunctionResult('ownerOf', response.returnData);
      if (getAddress(actual) !== chunk[index][1]) throw new Error(`Indexed owner mismatch for Citizen ${chunk[index][0]}.`);
    });
  }
  return entries.length;
}

async function verifyOriginalDistinctions(multicall, distinctions, blockNumber) {
  const methods = [
    ['identity', 'getIdentityIdOfTokenId'],
    ['vault', 'getVaultIdOfTokenId'],
    ['item', 'getItemCacheIdOfTokenId'],
    ['land', 'getLandDeedIdOfTokenId'],
  ];
  let componentMappingsVerified = 0;
  for (let start = 0; start < distinctions.originalUpload.rows.length; start += MULTICALL_CHUNK_SIZE) {
    const chunk = distinctions.originalUpload.rows.slice(start, start + MULTICALL_CHUNK_SIZE);
    const calls = chunk.flatMap((row) => methods.map(([, method]) => ({
      target: row.location === 'legacy' ? S1_LEGACY_CITIZEN_CONTRACT : S1_CITIZEN_CONTRACT,
      allowFailure: false,
      callData: legacyCitizenInterface.encodeFunctionData(method, [row.citizenId]),
    })));
    const responses = await multicall.aggregate3.staticCall(calls, { blockTag: blockNumber });
    responses.forEach((response, index) => {
      if (!response.success) throw new Error('An Original Upload component read failed.');
      const row = chunk[Math.floor(index / methods.length)];
      const [kind, method] = methods[index % methods.length];
      const [actual] = legacyCitizenInterface.decodeFunctionResult(method, response.returnData);
      const expected = row.components[kind] ?? '0';
      if (actual.toString() !== expected) throw new Error(`Original Upload ${kind} mapping mismatch for Citizen ${row.citizenId}.`);
      componentMappingsVerified += 1;
    });
  }

  const legacyRows = distinctions.originalUpload.rows.filter((row) => row.location === 'legacy');
  if (legacyRows.length) {
    const responses = await multicall.aggregate3.staticCall(legacyRows.map((row) => ({
      target: S1_LEGACY_CITIZEN_CONTRACT,
      allowFailure: false,
      callData: ownerOfInterface.encodeFunctionData('ownerOf', [row.citizenId]),
    })), { blockTag: blockNumber });
    responses.forEach((response, index) => {
      if (!response.success) throw new Error('An Original Upload legacy owner read failed.');
      const [owner] = ownerOfInterface.decodeFunctionResult('ownerOf', response.returnData);
      if (getAddress(owner) !== legacyRows[index].currentBeneficialOwner) throw new Error(`Original Upload legacy owner mismatch for Citizen ${legacyRows[index].citizenId}.`);
    });
  }
  return { componentMappingsVerified, legacyOwnersVerified: legacyRows.length };
}

function ownershipDigest(stats) {
  const rows = stats.top.map((row) => `${row.rank}:${row.address.toLowerCase()}:${row.count}:${row.held}:${row.staked}`);
  return createHash('sha256').update(rows.join('\n')).digest('hex');
}

async function main() {
  const transport = new FetchRequest(rpcUrl());
  transport.timeout = 30_000;
  const provider = new JsonRpcProvider(transport, ETHEREUM_CHAIN_ID, { staticNetwork: true });
  try {
    const [network, block] = await Promise.all([provider.getNetwork(), provider.getBlock('finalized')]);
    if (network.chainId !== BigInt(ETHEREUM_CHAIN_ID) || !block?.hash) throw new Error('Finalized Ethereum source is unavailable.');
    await verifyAlchemyBlock(block);
    const multicall = new Contract(MULTICALL3_CONTRACT, MULTICALL_ABI, provider);
    const [
      s1Transfers,
      s2Transfers,
      originalIdentityTransfers,
      originalVaultTransfers,
      originalItemTransfers,
      originalLandTransfers,
      legacyS1Transfers,
      participantData,
    ] = await Promise.all([
      collectTransferOwners(S1_CITIZEN_CONTRACT, block.number),
      collectTransferOwners(S2_OUTER_CITIZEN_CONTRACT, block.number),
      collectTransferOwners(S1_ORIGINAL_IDENTITY_CONTRACT, block.number),
      collectTransferOwners(S1_ORIGINAL_VAULT_CONTRACT, block.number),
      collectTransferOwners(S1_ORIGINAL_ITEM_CONTRACT, block.number),
      collectTransferOwners(S1_ORIGINAL_LAND_CONTRACT, block.number),
      collectTransferOwners(S1_LEGACY_CITIZEN_CONTRACT, block.number),
      collectParticipants(provider, block.number),
    ]);
    const componentManifest = await loadAndVerifyComponentManifest({
      identity: originalIdentityTransfers,
      vault: originalVaultTransfers,
      item: originalItemTransfers,
      land: originalLandTransfers,
    });
    const stakedOwners = await readStakedOwners(multicall, participantData.participants, block.number);
    const seasonData = {};
    const verification = {};
    for (const season of ['s1', 's2']) {
      const contract = collections[season];
      const transferData = season === 's1' ? s1Transfers : s2Transfers;
      const nft = new Contract(contract, ERC721_ABI, provider);
      const [supplyRaw, custodyRaw, ownerOfVerified] = await Promise.all([
        nft.totalSupply({ blockTag: block.number }),
        nft.balanceOf(BYTES_STAKING_CONTRACT, { blockTag: block.number }),
        verifyOwners(multicall, contract, transferData.owners, block.number),
      ]);
      const supply = Number(supplyRaw);
      const custody = Number(custodyRaw);
      if (!Number.isSafeInteger(supply) || !Number.isSafeInteger(custody)) throw new Error('Citizen supply exceeds the safe integer range.');
      const stats = buildCitizenHolderStats({
        directOwners: transferData.owners,
        stakedOwners: stakedOwners[season],
        stakingContract: BYTES_STAKING_CONTRACT,
        supply,
        topLimit: TOP_LIMIT,
      });
      if (custody !== stats.stakedTokens) throw new Error(`${season.toUpperCase()} staking balance does not match active positions.`);
      seasonData[season] = { ...stats, topDigestSha256: ownershipDigest(stats) };
      verification[season] = {
        transferEvents: transferData.eventCount,
        transferPages: transferData.pageCount,
        reconstructedTokens: transferData.owners.size,
        ownerOfVerified,
        stakingCustody: custody,
        activePositions: stakedOwners[season].size,
      };
    }
    const distinctionsFull = buildOriginalS1Distinctions({
      componentTransfers: {
        identity: originalIdentityTransfers.transfers,
        vault: originalVaultTransfers.transfers,
        item: originalItemTransfers.transfers,
        land: originalLandTransfers.transfers,
      },
      legacyCitizenTransfers: legacyS1Transfers.transfers,
      v2CitizenTransfers: s1Transfers.transfers,
      currentV2Owners: s1Transfers.owners,
      currentStakedOwners: stakedOwners.s1,
      legacyCitizenContract: S1_LEGACY_CITIZEN_CONTRACT,
      v2CitizenContract: S1_CITIZEN_CONTRACT,
      stakingContract: BYTES_STAKING_CONTRACT,
      expectedComponentCohorts: componentManifest.cohorts,
    });
    const distinctionVerification = await verifyOriginalDistinctions(multicall, distinctionsFull, block.number);
    const originalWalletIds = new Set(distinctionsFull.originalWallet.tokenIds);
    const originalUploadRows = distinctionsFull.originalUpload.rows.map((row) => ({
      ...row,
      originalWallet: originalWalletIds.has(row.citizenId),
    }));
    const originalUpload = {
      ...distinctionsFull.originalUpload,
      lookupTokenIds: distinctionsFull.originalUpload.rows.filter((row) => row.location !== 'legacy').map((row) => row.citizenId),
    };
    delete originalUpload.rows;
    const originalWallet = {
      ...distinctionsFull.originalWallet,
      lookupTokenIds: distinctionsFull.originalWallet.rows.filter((row) => row.location !== 'legacy').map((row) => row.citizenId),
    };
    delete originalWallet.rows;
    const distinctions = {
      ...distinctionsFull,
      originalUpload,
      originalWallet,
      rowsDigestSha256: originalS1AuditRowsDigest(originalUploadRows),
    };
    if (Object.values(originalUpload.locations).reduce((sum, count) => sum + count, 0) !== originalUpload.citizens) {
      throw new Error('Original Upload locations do not reconcile.');
    }
    if (Object.values(originalWallet.locations).reduce((sum, count) => sum + count, 0) !== originalWallet.citizens) {
      throw new Error('Original Wallet locations do not reconcile.');
    }
    const originalUploadIds = new Set(originalUpload.tokenIds);
    if (originalWallet.tokenIds.some((tokenId) => !originalUploadIds.has(tokenId))) {
      throw new Error('Original Wallet must be a strict subset of Original Upload.');
    }

    const confirmed = await provider.getBlock(block.number);
    if (!confirmed?.hash || confirmed.hash !== block.hash) throw new Error('Ethereum source block changed during collection.');
    await verifyAlchemyBlock(block);
    const output = {
      schemaVersion: 3,
      generatedAt: new Date().toISOString(),
      source: { chainId: ETHEREUM_CHAIN_ID, blockNumber: block.number, blockHash: block.hash, asOf: new Date(block.timestamp * 1_000).toISOString() },
      methodology: 'Current V2 Citizen ownership reconstructed from chronological ERC-721 transfers, verified token-by-token with ownerOf at one finalized block, then NeoTokyoStaker custody replaced with the originating wallet from active getStakerPositions records. Addresses are deduplicated per season; one person using multiple addresses remains multiple owners.',
      contracts: {
        s1: S1_CITIZEN_CONTRACT,
        s1Legacy: S1_LEGACY_CITIZEN_CONTRACT,
        s1OriginalIdentity: S1_ORIGINAL_IDENTITY_CONTRACT,
        s1OriginalVault: S1_ORIGINAL_VAULT_CONTRACT,
        s1OriginalItem: S1_ORIGINAL_ITEM_CONTRACT,
        s1OriginalLand: S1_ORIGINAL_LAND_CONTRACT,
        s2: S2_OUTER_CITIZEN_CONTRACT,
        staker: BYTES_STAKING_CONTRACT,
      },
      participantIndex: { baselineBlock: participantData.baselineBlock, addressesChecked: participantData.participants.length, deltaEvents: participantData.deltaEventCount },
      verification: {
        ...verification,
        s1HistoricalDistinctions: {
          componentManifestDigestSha256: componentManifest.digest,
          originalIdentityTransferEvents: originalIdentityTransfers.eventCount,
          originalIdentityTransferPages: originalIdentityTransfers.pageCount,
          originalVaultTransferEvents: originalVaultTransfers.eventCount,
          originalVaultTransferPages: originalVaultTransfers.pageCount,
          originalItemTransferEvents: originalItemTransfers.eventCount,
          originalItemTransferPages: originalItemTransfers.pageCount,
          originalLandTransferEvents: originalLandTransfers.eventCount,
          originalLandTransferPages: originalLandTransfers.pageCount,
          legacyCitizenTransferEvents: legacyS1Transfers.eventCount,
          legacyCitizenTransferPages: legacyS1Transfers.pageCount,
          ...distinctionVerification,
        },
      },
      seasons: seasonData,
      s1HistoricalDistinctions: {
        ...distinctions,
        definition: 'Original Upload requires every constituent NFT used in the first S1 upload to come from its original 2021 claim distribution, excluding bought and later-issued components, and the Citizen never to have been disassembled or reassembled. Original Wallet is the Original Upload subset whose first assembly wallet remains the uninterrupted beneficial owner. Verified legacy-to-V2 migration and NeoTokyoStaker custody preserve both distinctions; ordinary wallet changes and transfer-backs break Original Wallet permanently.',
      },
    };
    const auditOutput = {
      schemaVersion: 2,
      generatedAt: output.generatedAt,
      source: output.source,
      definition: output.s1HistoricalDistinctions.definition,
      rowsDigestSha256: distinctions.rowsDigestSha256,
      originalUploadRows,
    };
    const publicOutput = {
      schemaVersion: 1,
      generatedAt: output.generatedAt,
      source: output.source,
      methodology: output.methodology,
      seasons: output.seasons,
      s1HistoricalDistinctions: {
        originalComponentUploads: distinctions.originalComponentUploads,
        originalUpload: {
          citizens: originalUpload.citizens,
          uniqueWallets: originalUpload.uniqueWallets,
          percentageOfOriginalComponentUploads: originalUpload.percentageOfOriginalComponentUploads,
          locations: originalUpload.locations,
        },
        originalWallet: {
          citizens: originalWallet.citizens,
          uniqueWallets: originalWallet.uniqueWallets,
          percentageOfOriginalComponentUploads: originalWallet.percentageOfOriginalComponentUploads,
          locations: originalWallet.locations,
        },
        definition: output.s1HistoricalDistinctions.definition,
      },
    };
    await mkdir(dirname(OUTPUT), { recursive: true });
    const temporary = `${OUTPUT}.tmp`;
    const auditTemporary = `${AUDIT_OUTPUT}.tmp`;
    const publicTemporary = `${PUBLIC_OUTPUT}.tmp`;
    await Promise.all([
      writeFile(temporary, `${JSON.stringify(output, null, 2)}\n`),
      writeFile(auditTemporary, `${JSON.stringify(auditOutput, null, 2)}\n`),
      writeFile(publicTemporary, `${JSON.stringify(publicOutput, null, 2)}\n`),
    ]);
    await Promise.all([rename(temporary, OUTPUT), rename(auditTemporary, AUDIT_OUTPUT), rename(publicTemporary, PUBLIC_OUTPUT)]);
    console.log(`Wrote Citizen holder snapshot at block ${block.number.toLocaleString('en-US')}: S1 ${seasonData.s1.uniqueOwners.toLocaleString('en-US')} owners, S2 ${seasonData.s2.uniqueOwners.toLocaleString('en-US')} owners, ${originalUpload.citizens.toLocaleString('en-US')} Original Uploads, ${originalWallet.citizens.toLocaleString('en-US')} Original Wallets.`);
  } finally {
    provider.destroy();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : 'Citizen holder snapshot generation failed.');
  process.exitCode = 1;
});
