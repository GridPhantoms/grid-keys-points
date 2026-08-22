export type ValuationMethod = 'floor' | 'offer';

export type ValuationInputRow = {
  key: string;
  supply: number;
  floorEth: number | null;
  offerEth: number | null;
  offerQuantity: number | null;
};

function checkedInteger(value: number, label: string) {
  if (!Number.isSafeInteger(value) || value < 0) throw new Error(`${label} must be a nonnegative safe integer`);
  return value;
}

export function calculateCitizenSupply({ legacyTotal, legacyHeldByV2, v2Total }: {
  legacyTotal: number;
  legacyHeldByV2: number;
  v2Total: number;
}) {
  const legacyExternal = checkedInteger(legacyTotal, 'legacyTotal') - checkedInteger(legacyHeldByV2, 'legacyHeldByV2');
  if (legacyExternal < 0) throw new Error('Legacy Citizen custody exceeds supply');
  const v2Active = checkedInteger(v2Total, 'v2Total');
  return { legacyExternal, v2Active, economicallyDistinct: legacyExternal + v2Active };
}

export function calculateComponentSupply({ legacyTotal, legacyCitizenHeld, v2WrapperHeld, v2Total, v2CitizenHeld }: {
  legacyTotal: number;
  legacyCitizenHeld: number;
  v2WrapperHeld: number;
  v2Total: number;
  v2CitizenHeld: number;
}) {
  const legacyExternal = checkedInteger(legacyTotal, 'legacyTotal')
    - checkedInteger(legacyCitizenHeld, 'legacyCitizenHeld')
    - checkedInteger(v2WrapperHeld, 'v2WrapperHeld');
  const v2External = checkedInteger(v2Total, 'v2Total') - checkedInteger(v2CitizenHeld, 'v2CitizenHeld');
  if (legacyExternal < 0 || v2External < 0) throw new Error('Component custody exceeds supply');
  return { legacyExternal, v2External, economicallyDistinct: legacyExternal + v2External };
}

export function calculateImpliedValuation(rows: ValuationInputRow[], method: ValuationMethod, ethUsd: number | null, tokenMarketCapUsd: number | null) {
  let nftEth = 0;
  let coverage = 0;
  const calculatedRows = rows.map((row) => {
    const referenceEth = method === 'offer' ? row.offerEth : (row.floorEth ?? row.offerEth);
    const rowMethod = method === 'offer' ? 'top-offer' : row.floorEth != null ? 'floor' : row.offerEth != null ? 'bid-fallback' : 'unavailable';
    const validReference = referenceEth != null && Number.isFinite(referenceEth) && referenceEth > 0;
    const subtotalEth = validReference ? row.supply * referenceEth : null;
    if (subtotalEth != null) { nftEth += subtotalEth; coverage += 1; }
    return { ...row, referenceEth: validReference ? referenceEth : null, subtotalEth, method: rowMethod };
  });
  const complete = coverage === rows.length && ethUsd != null && Number.isFinite(ethUsd) && ethUsd > 0
    && tokenMarketCapUsd != null && Number.isFinite(tokenMarketCapUsd) && tokenMarketCapUsd >= 0;
  const nftUsd = ethUsd != null && Number.isFinite(ethUsd) && ethUsd > 0 ? nftEth * ethUsd : null;
  const totalUsd = complete && nftUsd != null && tokenMarketCapUsd != null ? nftUsd + tokenMarketCapUsd : null;
  return { method, complete, coverage, totalCollections: rows.length, nftEth, nftUsd, tokenMarketCapUsd, totalUsd, rows: calculatedRows };
}

export const NEO_TOKYO_SUPPLY_CONFIG = {
  citizens: [
    { key: 's1-citizens', legacy: '0xb668beb1fa440f6cf2da0399f8c28cab993bdd65', v2: '0xB9951B43802dCF3ef5b14567cb17adF367ed1c0F' },
    { key: 's2-citizens', legacy: '0x9b091d2e0bb88ace4fe8f0fab87b93d8ba932ec4', v2: '0x4481507cc228FA19D203BD42110d679571f7912E' },
  ],
  components: [
    { key: 's1-identities', legacy: ['0x86357A19E5537A8Fba9A004E555713BC943a66C0', '0x835a60cc60B808e47825daa79A9Da6C9fF3a892E'], v2: '0x059174c2Fef43F06178D23572FE5556F078F2F99', legacyCitizen: '0xb668beb1fa440f6cf2da0399f8c28cab993bdd65', v2Citizen: '0xB9951B43802dCF3ef5b14567cb17adF367ed1c0F' },
    { key: 's1-vaults', legacy: ['0xab0b0dD7e4EaB0F9e31a539074a03f1C1Be80879'], v2: '0x17B2f2b8927A8f11edfd7a27E153Be17d68E69C7', legacyCitizen: '0xb668beb1fa440f6cf2da0399f8c28cab993bdd65', v2Citizen: '0xB9951B43802dCF3ef5b14567cb17adF367ed1c0F' },
    { key: 's1-items', legacy: ['0x0938E3F7AC6D7f674FeD551c93f363109bda3AF9'], v2: '0xE7489EA1847395d7EeAd33E9c85fe327D513D249', legacyCitizen: '0xb668beb1fa440f6cf2da0399f8c28cab993bdd65', v2Citizen: '0xB9951B43802dCF3ef5b14567cb17adF367ed1c0F' },
    { key: 's1-lands', legacy: ['0x3C54b798b3aAD4F6089533aF3bdbD6ce233019bB'], v2: '0xCFc6a15b2952B6014A993a0C16c9D580d862e21A', legacyCitizen: '0xb668beb1fa440f6cf2da0399f8c28cab993bdd65', v2Citizen: '0xB9951B43802dCF3ef5b14567cb17adF367ed1c0F' },
    { key: 's2-identities', legacy: ['0x698FbAACA64944376e2CDC4CAD86eaa91362cF54'], v2: '0x8E9F3C6883993A7A69c37213F2eb9A17450ad6D3', legacyCitizen: '0x9b091d2e0bb88ace4fe8f0fab87b93D8bA932EC4', v2Citizen: '0x4481507cc228FA19D203BD42110d679571f7912E' },
    { key: 's2-items', legacy: ['0x7AC66d40d80D2d8D1E45D6b5B10a1C9D1fd69354'], v2: '0x0B8F04F2cA4f15d33274a27439412ab7639EFAd9', legacyCitizen: '0x9b091d2e0bb88ace4fe8f0fab87b93D8bA932EC4', v2Citizen: '0x4481507cc228FA19D203BD42110d679571f7912E' },
    { key: 's2-lands', legacy: ['0xf90980AE7A44E2d18B9615396FF5E9252F1DF639'], v2: '0xB58aE9e93b8bee7d890AD87A2a70c135a3Bf4B4e', legacyCitizen: '0x9b091d2e0bb88ace4fe8f0fab87b93D8bA932EC4', v2Citizen: '0x4481507cc228FA19D203BD42110d679571f7912E' },
  ],
} as const;
