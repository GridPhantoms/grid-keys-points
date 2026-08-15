import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { FetchRequest, JsonRpcProvider, getAddress, id } from 'ethers';

import {
  BYTES_PARTICIPANT_SNAPSHOT_BLOCK,
  BYTES_PARTICIPANT_SNAPSHOT_BLOCK_HASH,
  BYTES_PARTICIPANT_SNAPSHOT_COUNT,
  BYTES_PARTICIPANT_SNAPSHOT_DIGEST,
  BYTES_STAKING_CONTRACT,
  BYTES_STAKING_DEPLOYMENT_BLOCK,
  ETHEREUM_CHAIN_ID,
} from '../lib/bytes-addresses.mjs';
import { buildParticipantSnapshot, validateParticipantSnapshot } from '../lib/bytes-onchain.mjs';

const INITIAL_BLOCK_CHUNK = 50_000;
const MINIMUM_BLOCK_CHUNK = 100;
const OUTPUT = resolve(dirname(fileURLToPath(import.meta.url)), '../data/bytes-staking-participants.json');
const EVENT_TOPICS = [
  id('Stake(address,address,uint256,uint256)'),
  id('Claim(address,uint256,uint256)'),
];

for (const envFile of ['.env.local', '.env']) {
  try { process.loadEnvFile(envFile); } catch {}
}

function rpcUrl() {
  if (process.env.ETHEREUM_RPC_URL) return process.env.ETHEREUM_RPC_URL;
  if (process.env.ALCHEMY_API_KEY) return `https://eth-mainnet.g.alchemy.com/v2/${process.env.ALCHEMY_API_KEY}`;
  throw new Error('Private Ethereum RPC configuration is required.');
}

function indexedAddress(topic) {
  if (typeof topic !== 'string' || topic.length !== 66) throw new Error('Malformed indexed participant topic.');
  return getAddress(`0x${topic.slice(26)}`);
}

export async function collectParticipantEvidence(provider, fromBlock, toBlock) {
  const addresses = [];
  const stakeParticipants = new Set();
  const claimRecipients = new Set();
  let stakeEventCount = 0;
  let claimEventCount = 0;
  let logQueryCalls = 0;
  let logQueryRetries = 0;
  let start = fromBlock;
  let chunkSize = INITIAL_BLOCK_CHUNK;

  while (start <= toBlock) {
    const end = Math.min(toBlock, start + chunkSize - 1);
    try {
      logQueryCalls += 1;
      const logs = await provider.getLogs({
        address: BYTES_STAKING_CONTRACT,
        topics: [EVENT_TOPICS],
        fromBlock: start,
        toBlock: end,
      });
      for (const log of logs) {
        const address = indexedAddress(log.topics[1]);
        addresses.push(address);
        if (log.topics[0].toLowerCase() === EVENT_TOPICS[0].toLowerCase()) {
          stakeEventCount += 1;
          stakeParticipants.add(address.toLowerCase());
        } else if (log.topics[0].toLowerCase() === EVENT_TOPICS[1].toLowerCase()) {
          claimEventCount += 1;
          claimRecipients.add(address.toLowerCase());
        } else {
          throw new Error('Unexpected participant event topic.');
        }
      }
      start = end + 1;
      chunkSize = Math.min(INITIAL_BLOCK_CHUNK, chunkSize * 2);
      process.stdout.write(`\rIndexed through block ${end.toLocaleString('en-US')}`);
    } catch (error) {
      if (chunkSize <= MINIMUM_BLOCK_CHUNK) throw error;
      logQueryRetries += 1;
      chunkSize = Math.max(MINIMUM_BLOCK_CHUNK, Math.floor(chunkSize / 2));
    }
  }
  process.stdout.write('\n');
  return {
    addresses,
    evidence: {
      collectorVersion: '1.0.0',
      stakeEventCount,
      claimEventCount,
      uniqueStakeParticipants: stakeParticipants.size,
      uniqueClaimRecipients: claimRecipients.size,
      logQueryCalls,
      logQueryRetries,
    },
  };
}

async function main() {
  const request = new FetchRequest(rpcUrl());
  request.timeout = 20_000;
  const provider = new JsonRpcProvider(request, ETHEREUM_CHAIN_ID, { staticNetwork: true });
  const network = await provider.getNetwork();
  if (network.chainId !== BigInt(ETHEREUM_CHAIN_ID)) throw new Error('Unexpected Ethereum chain.');
  const sourceBlock = await provider.getBlock(BYTES_PARTICIPANT_SNAPSHOT_BLOCK);
  if (!sourceBlock) throw new Error('Pinned source block is unavailable.');

  if (sourceBlock.hash?.toLowerCase() !== BYTES_PARTICIPANT_SNAPSHOT_BLOCK_HASH) throw new Error('Pinned source block hash does not match.');
  const { addresses, evidence } = await collectParticipantEvidence(
    provider,
    BYTES_STAKING_DEPLOYMENT_BLOCK,
    BYTES_PARTICIPANT_SNAPSHOT_BLOCK,
  );
  const snapshot = buildParticipantSnapshot({
    generatedAt: new Date(sourceBlock.timestamp * 1_000).toISOString(),
    sourceBlock: sourceBlock.number,
    sourceBlockHash: sourceBlock.hash,
    deploymentBlock: BYTES_STAKING_DEPLOYMENT_BLOCK,
    contract: BYTES_STAKING_CONTRACT,
    evidence,
    addresses,
  });
  validateParticipantSnapshot(snapshot, {
    contract: BYTES_STAKING_CONTRACT,
    deploymentBlock: BYTES_STAKING_DEPLOYMENT_BLOCK,
    sourceBlock: BYTES_PARTICIPANT_SNAPSHOT_BLOCK,
    sourceBlockHash: BYTES_PARTICIPANT_SNAPSHOT_BLOCK_HASH,
    count: BYTES_PARTICIPANT_SNAPSHOT_COUNT,
    addressesSha256: BYTES_PARTICIPANT_SNAPSHOT_DIGEST,
  });
  if (snapshot.count !== BYTES_PARTICIPANT_SNAPSHOT_COUNT) {
    throw new Error(`Participant count ${snapshot.count} does not match verified checkpoint ${BYTES_PARTICIPANT_SNAPSHOT_COUNT}.`);
  }

  await mkdir(dirname(OUTPUT), { recursive: true });
  await writeFile(OUTPUT, `${JSON.stringify(snapshot, null, 2)}\n`);
  console.log(`Wrote ${snapshot.count.toLocaleString('en-US')} participants at block ${snapshot.sourceBlock.toLocaleString('en-US')}.`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch(() => {
    console.error('Participant snapshot generation failed.');
    process.exitCode = 1;
  });
}
