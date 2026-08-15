import { readFile } from 'node:fs/promises';

import {
  BYTES_PARTICIPANT_SNAPSHOT_BLOCK,
  BYTES_PARTICIPANT_SNAPSHOT_BLOCK_HASH,
  BYTES_PARTICIPANT_SNAPSHOT_COUNT,
  BYTES_PARTICIPANT_SNAPSHOT_DIGEST,
  BYTES_STAKING_CONTRACT,
  BYTES_STAKING_DEPLOYMENT_BLOCK,
} from '../lib/bytes-addresses.mjs';
import { validateParticipantSnapshot } from '../lib/bytes-onchain.mjs';

const snapshot = JSON.parse(await readFile(new URL('../data/bytes-staking-participants.json', import.meta.url), 'utf8'));
validateParticipantSnapshot(snapshot, {
  contract: BYTES_STAKING_CONTRACT,
  deploymentBlock: BYTES_STAKING_DEPLOYMENT_BLOCK,
  sourceBlock: BYTES_PARTICIPANT_SNAPSHOT_BLOCK,
  sourceBlockHash: BYTES_PARTICIPANT_SNAPSHOT_BLOCK_HASH,
  count: BYTES_PARTICIPANT_SNAPSHOT_COUNT,
  addressesSha256: BYTES_PARTICIPANT_SNAPSHOT_DIGEST,
});
console.log(`Validated ${snapshot.count.toLocaleString('en-US')} BYTES staking participants.`);
