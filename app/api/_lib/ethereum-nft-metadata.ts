const TOKEN_URI_SELECTOR = 'c87b56dd';
const RPC_TIMEOUT_MS = 12_000;
const MAX_RPC_HEX_LENGTH = 4_000_000;
const MAX_METADATA_LENGTH = 2_000_000;

function ethereumRpcUrl() {
  const configured = process.env.ETHEREUM_RPC_URL?.trim();
  if (configured) return configured;
  const apiKey = process.env.ALCHEMY_API_KEY?.trim();
  return apiKey ? `https://eth-mainnet.g.alchemy.com/v2/${apiKey}` : null;
}

function tokenCallData(tokenId: string) {
  return `0x${TOKEN_URI_SELECTOR}${BigInt(tokenId).toString(16).padStart(64, '0')}`;
}

export function decodeAbiString(encoded: string) {
  if (!/^0x[0-9a-fA-F]+$/.test(encoded) || encoded.length > MAX_RPC_HEX_LENGTH) throw new Error('Invalid tokenURI response');
  const bytes = Buffer.from(encoded.slice(2), 'hex');
  if (bytes.length < 64) throw new Error('Invalid tokenURI ABI string');
  const offset = Number(BigInt(`0x${bytes.subarray(0, 32).toString('hex')}`));
  if (!Number.isSafeInteger(offset) || offset < 0 || offset + 32 > bytes.length) throw new Error('Invalid tokenURI offset');
  const length = Number(BigInt(`0x${bytes.subarray(offset, offset + 32).toString('hex')}`));
  if (!Number.isSafeInteger(length) || length < 0 || length > MAX_METADATA_LENGTH || offset + 32 + length > bytes.length) {
    throw new Error('Invalid tokenURI length');
  }
  return bytes.subarray(offset + 32, offset + 32 + length).toString('utf8');
}

export function parseMetadataUri(tokenUri: string) {
  const base64Prefix = 'data:application/json;base64,';
  const utf8Prefix = 'data:application/json;utf8,';
  let json = '';
  if (tokenUri.startsWith(base64Prefix)) json = Buffer.from(tokenUri.slice(base64Prefix.length), 'base64').toString('utf8');
  else if (tokenUri.startsWith(utf8Prefix)) json = decodeURIComponent(tokenUri.slice(utf8Prefix.length));
  else return null;
  if (!json || json.length > MAX_METADATA_LENGTH) throw new Error('Unexpected metadata size');
  const metadata = JSON.parse(json) as { image?: unknown; image_data?: unknown };
  const image = (typeof metadata.image === 'string' ? metadata.image.trim() : '')
    || (typeof metadata.image_data === 'string' ? metadata.image_data.trim() : '');
  return image.startsWith('data:image/') || image.startsWith('https://') ? image : null;
}

export async function getOnchainMetadataImage(contract: string, tokenId: string) {
  const rpcUrl = ethereumRpcUrl();
  if (!rpcUrl) return null;
  if (!/^0x[0-9a-fA-F]{40}$/.test(contract) || !/^\d{1,78}$/.test(tokenId)) return null;
  const response = await fetch(rpcUrl, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      method: 'eth_call',
      params: [{ to: contract, data: tokenCallData(tokenId) }, 'latest'],
    }),
    cache: 'no-store',
    signal: AbortSignal.timeout(RPC_TIMEOUT_MS),
  });
  if (!response.ok) throw new Error('Ethereum metadata request failed');
  const payload = await response.json() as { result?: unknown; error?: unknown };
  if (payload.error || typeof payload.result !== 'string') throw new Error('Ethereum metadata response failed');
  return parseMetadataUri(decodeAbiString(payload.result));
}
