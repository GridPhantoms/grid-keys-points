import { createHash } from 'node:crypto';
import { rename, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { id } from 'ethers';
import {
  S1_ORIGINAL_IDENTITY_CONTRACT,
  S1_ORIGINAL_ITEM_CONTRACT,
  S1_ORIGINAL_LAND_CONTRACT,
  S1_ORIGINAL_VAULT_CONTRACT,
} from '../lib/bytes-addresses.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const OUTPUT = resolve(ROOT, 'data/s1-original-component-cohorts.json');
const ZERO = '0x0000000000000000000000000000000000000000';
const PAGE_SIZE = '0x3e8';
const BATCH_SIZE = 100;
const COMPONENTS = {
  identity: {
    contract: S1_ORIGINAL_IDENTITY_CONTRACT,
    mintEndBlock: 13_361_535,
    expectedCount: 2_018,
    paths: ['ownerClaim(uint256)', 'whitelistClaim(uint256,uint256,bytes32[])', 'riddleClaim(address,uint256)'],
  },
  vault: {
    contract: S1_ORIGINAL_VAULT_CONTRACT,
    mintEndBlock: 13_430_633,
    expectedCount: 2_500,
    paths: ['holderClaim(uint256)', 'whitelistClaim(uint256,uint256,bytes32[])', 'ownerClaim(uint256)'],
  },
  item: {
    contract: S1_ORIGINAL_ITEM_CONTRACT,
    mintEndBlock: 13_835_401,
    expectedCount: 2_495,
    paths: ['boxClaim(uint256,uint256,uint256,bytes32[])'],
  },
  land: {
    contract: S1_ORIGINAL_LAND_CONTRACT,
    mintEndBlock: 13_838_837,
    expectedCount: 1_985,
    paths: ['landClaim(uint256,uint256,uint256,uint256,uint256,bytes32[])'],
  },
};

function loadEnvironment() {
  for (const name of ['.env.local', '.env']) {
    try { process.loadEnvFile(resolve(ROOT, name)); } catch {}
  }
}

function alchemyUrl() {
  if (process.env.ETHEREUM_RPC_URL) return process.env.ETHEREUM_RPC_URL;
  if (process.env.ALCHEMY_API_KEY) return `https://eth-mainnet.g.alchemy.com/v2/${process.env.ALCHEMY_API_KEY}`;
  throw new Error('Ethereum RPC configuration is missing.');
}

async function rpc(payload, attempts = 4) {
  let lastError;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const response = await fetch(alchemyUrl(), {
        method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload),
      });
      if ((response.status === 429 || response.status >= 500) && attempt < attempts) {
        await new Promise((resolveDelay) => setTimeout(resolveDelay, 500 * 2 ** (attempt - 1)));
        continue;
      }
      if (!response.ok) throw new Error(`Ethereum RPC returned HTTP ${response.status}.`);
      const value = await response.json();
      if (Array.isArray(value)) {
        const failure = value.find((entry) => entry.error);
        if (failure) throw new Error('Ethereum batch RPC returned an error.');
      } else if (value.error) throw new Error('Ethereum RPC returned an error.');
      return value;
    } catch (error) {
      lastError = error;
      if (attempt < attempts) await new Promise((resolveDelay) => setTimeout(resolveDelay, 500 * 2 ** (attempt - 1)));
    }
  }
  throw lastError instanceof Error ? lastError : new Error('Ethereum RPC failed.');
}

async function collectMints(component) {
  const rows = [];
  let pageKey;
  do {
    const request = {
      fromBlock: '0x0', toBlock: `0x${component.mintEndBlock.toString(16)}`,
      contractAddresses: [component.contract], fromAddress: ZERO, category: ['erc721'],
      withMetadata: false, excludeZeroValue: false, maxCount: PAGE_SIZE, order: 'asc',
    };
    if (pageKey) request.pageKey = pageKey;
    const response = await rpc({ jsonrpc: '2.0', id: 1, method: 'alchemy_getAssetTransfers', params: [request] });
    if (!Array.isArray(response.result?.transfers)) throw new Error('Malformed mint transfer response.');
    for (const transfer of response.result.transfers) {
      const raw = transfer.erc721TokenId ?? transfer.tokenId ?? transfer.rawContract?.value;
      if (typeof raw !== 'string' || !transfer.hash || !transfer.blockNum) throw new Error('Mint transfer omitted required fields.');
      rows.push({ tokenId: BigInt(raw).toString(), mintBlock: Number.parseInt(transfer.blockNum, 16), txHash: transfer.hash.toLowerCase() });
    }
    pageKey = response.result.pageKey;
  } while (pageKey);
  return rows;
}

async function transactionSelectors(hashes) {
  const result = new Map();
  for (let start = 0; start < hashes.length; start += BATCH_SIZE) {
    const chunk = hashes.slice(start, start + BATCH_SIZE);
    const response = await rpc(chunk.map((hash, index) => ({ jsonrpc: '2.0', id: index + 1, method: 'eth_getTransactionByHash', params: [hash] })));
    const byId = new Map(response.map((entry) => [entry.id, entry.result]));
    chunk.forEach((hash, index) => {
      const transaction = byId.get(index + 1);
      if (!transaction?.input || transaction.hash?.toLowerCase() !== hash) throw new Error(`Transaction lookup failed for ${hash}.`);
      result.set(hash, transaction.input.slice(0, 10).toLowerCase());
    });
  }
  return result;
}

function digestTokenIds(rows) {
  return createHash('sha256').update(rows.map((row) => row.tokenId).join(',')).digest('hex');
}

function digestRows(components) {
  const serialized = Object.entries(components).flatMap(([kind, component]) => component.mints.map((row) => (
    `${kind}:${row.tokenId}:${row.mintBlock}:${row.txHash}:${row.issuancePath}`
  ))).join('\n');
  return createHash('sha256').update(serialized).digest('hex');
}

async function main() {
  loadEnvironment();
  const collected = {};
  for (const [kind, component] of Object.entries(COMPONENTS)) {
    const mints = await collectMints(component);
    if (mints.length !== component.expectedCount || new Set(mints.map((row) => row.tokenId)).size !== mints.length) {
      throw new Error(`${kind} original cohort count or token uniqueness changed.`);
    }
    mints.sort((left, right) => BigInt(left.tokenId) < BigInt(right.tokenId) ? -1 : BigInt(left.tokenId) > BigInt(right.tokenId) ? 1 : 0);
    const selectorToPath = new Map(component.paths.map((path) => [id(path).slice(0, 10).toLowerCase(), path]));
    const selectors = await transactionSelectors([...new Set(mints.map((row) => row.txHash))]);
    for (const row of mints) {
      row.issuancePath = selectorToPath.get(selectors.get(row.txHash));
      if (!row.issuancePath) throw new Error(`${kind} mint ${row.txHash} used an unapproved issuance path.`);
    }
    collected[kind] = {
      contract: component.contract,
      mintEndBlock: component.mintEndBlock,
      count: mints.length,
      tokenIdDigestSha256: digestTokenIds(mints),
      approvedIssuancePaths: component.paths,
      mints,
    };
  }
  const output = {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    chainId: 1,
    serialization: 'Component order identity,vault,item,land; rows sorted by numeric tokenId; row format kind:tokenId:mintBlock:lowercaseTxHash:issuancePath joined by LF.',
    components: collected,
  };
  output.manifestRowsDigestSha256 = digestRows(collected);
  const temporary = `${OUTPUT}.tmp`;
  await writeFile(temporary, `${JSON.stringify(output, null, 2)}\n`);
  await rename(temporary, OUTPUT);
  console.log(`Wrote S1 original component manifest: ${Object.entries(collected).map(([kind, value]) => `${kind} ${value.count}`).join(', ')}.`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : 'S1 component manifest generation failed.');
  process.exitCode = 1;
});
