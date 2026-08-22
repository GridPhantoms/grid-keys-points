const OPEN_SEA_ORIGIN = 'https://opensea.io';
const OPEN_SEA_USER_AGENT = 'Mozilla/5.0 (compatible; GridPhantomsCitizenTerminal/1.0)';
const MAX_ITEM_PAYLOAD_LENGTH = 200_000;

export type OpenSeaEstimatedRank = {
  rank: number | null;
  status: 'available' | 'unavailable';
  source: 'OpenSea OpenRarity';
  sourceUrl: string;
  asOf: string;
};

export function openSeaItemUrl(contract: string, tokenId: string) {
  return `${OPEN_SEA_ORIGIN}/item/ethereum/${contract.toLowerCase()}/${encodeURIComponent(tokenId)}`;
}

export function extractOpenSeaEstimatedRank(html: string, contract: string, tokenId: string) {
  const start = html.indexOf('"itemByIdentifier":');
  if (start < 0) return null;

  const payload = html.slice(start, start + MAX_ITEM_PAYLOAD_LENGTH);
  const normalizedContract = contract.toLowerCase();
  if (!payload.toLowerCase().includes(`"contractaddress":"${normalizedContract}"`)) return null;
  if (!payload.includes(`"tokenId":"${tokenId}"`)) return null;

  const rarity = payload.match(/"rarity":\{"rank":(\d+),/);
  if (!rarity) return null;
  const rank = Number(rarity[1]);
  return Number.isSafeInteger(rank) && rank > 0 ? rank : null;
}

export async function fetchOpenSeaEstimatedRank(contract: string, tokenId: string): Promise<OpenSeaEstimatedRank> {
  const sourceUrl = openSeaItemUrl(contract, tokenId);
  const asOf = new Date().toISOString();

  try {
    const response = await fetch(sourceUrl, {
      headers: { accept: 'text/html', 'user-agent': OPEN_SEA_USER_AGENT },
      cache: 'no-store',
      signal: AbortSignal.timeout(8_000),
    });
    if (!response.ok) return { rank: null, status: 'unavailable', source: 'OpenSea OpenRarity', sourceUrl, asOf };

    const rank = extractOpenSeaEstimatedRank(await response.text(), contract, tokenId);
    return { rank, status: rank == null ? 'unavailable' : 'available', source: 'OpenSea OpenRarity', sourceUrl, asOf };
  } catch {
    return { rank: null, status: 'unavailable', source: 'OpenSea OpenRarity', sourceUrl, asOf };
  }
}
