# Citizen Terminal metric contract

## Citizen lookup

| Metric | Class | Source | Unavailable state |
|---|---|---|---|
| S1 component token numbers, traits, rarity rank and rarity score | Observed | NeoTokyo.codes current Citizen RPC | Lookup fails closed |
| S2 component token numbers | Observed | S2 Outer Citizen V2 component getters on Ethereum | Lookup fails closed |
| Assembled S1/S2 metadata | Observed | Alchemy metadata for the V2 Citizen contract | Lookup fails closed |
| S1 Elite status | Calculated | Current S1 `rarityMonRank <= 500` | Not classified without a current rank |
| S2 OpenSea estimated rarity rank | Estimated | Current OpenSea item page / OpenRarity output | Explicitly says OpenSea estimate unavailable; never calculates a substitute |

NeoTokyo.codes is an internal endpoint, so it is called server-side and cached. S2 component IDs use deterministic onchain getters. No client credential is exposed. OpenSea's S2 rank is kept in a distinct `estimatedRank` field with source URL and lookup timestamp. It is an OpenSea marketplace estimate, not a canonical official Neo Tokyo S2 rank. If OpenSea does not return a valid positive integer rank for the exact contract and token, the estimate remains explicitly unavailable. Citizen Terminal does not derive or invent a replacement score or rank.

## Staking points

User-facing S1 points:

```text
Credit Yield points × lock multiplier × Vault multiplier + BYTES staked ÷ 200
```

User-facing S2 points:

```text
lock multiplier + BYTES staked ÷ 200
```

The calculation layer enforces the current onchain caps: 2,000 BYTES for an S1 with a Vault and 200 BYTES for an S2 or an S1 without a Vault. Lookup-derived Vault status is isolated to the S1 calculator. S1 and S2 retain separate lock/BYTES form state, so switching pools cannot carry an incompatible amount into the other pool.

The deployed staking contract stores 100 internal units per user-facing point.

## Current BYTES per point per day

Classification: **Calculated from observed inputs**.

All inputs are pinned to one Ethereum block. For each pool independently:

```text
emissionPerSecond = getTotalEmissions(pool, blockTimestamp - 1)
currentEmissionPerDay = emissionPerSecond × 86,400
userFacingPoolPoints = privatePool.totalPoints ÷ 100
grossRate = currentEmissionPerDay ÷ userFacingPoolPoints
netRate = grossRate × (10,000 - daoTaxBps) ÷ 10,000
```

A one-second contract interval is dailyized instead of reading the trailing 24 hours, because a trailing interval may blend two reward windows. Raw pool storage is read only after verifying Ethereum mainnet and the expected deployed runtime bytecode hash. If the contract bytecode, source chain, pool denominator or tax cannot be verified, the rate fails closed.

The rate is a current snapshot estimate. Staking changes, withdrawals, reward-window configuration and DAO tax can change it.

## Market references

- Collection floors: lowest executable listing returned by the current price-sorted OpenSea listing feed. The unauthenticated collection-statistics endpoint is not used because it returns unauthorized responses without an API key.
- Elite floor: lowest current listed S1 in the scanned listing set whose current NeoTokyo.codes rank is 500 or better.
- Elite table: current listed S1s joined to the current rank feed.
- No executable listing: display `No Listings`, never a stale sale-derived floor.
- Market timestamp: API response generation time.

Listings can change or disappear before a transaction confirms.

## APY scenario

Classification: **Projected**.

```text
position cost = current Citizen floor in USD + entered BYTES × current BYTES spot price
annual reward value = current net BYTES/day × 365 × selected reward-valuation price
hypothetical APY = annual reward value ÷ position cost × 100
```

With Speculator Mode off, the selected reward-valuation price is current BYTES spot. With it on, only the projected reward valuation uses the target BYTES price; acquisition cost remains based on current spot. The projection excludes gas, marketplace fees, taxes, slippage, liquidity, rate changes and floor movement. It is informational and not financial advice.
