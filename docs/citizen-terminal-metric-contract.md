# Citizen Terminal metric contract

## Citizen lookup

| Metric | Class | Source | Unavailable state |
|---|---|---|---|
| S1 component token numbers, traits, rarity rank and rarity score | Observed | NeoTokyo.codes current Citizen RPC | Lookup fails closed |
| S2 component token numbers | Observed | S2 Outer Citizen V2 component getters on Ethereum | Lookup fails closed |
| Assembled S1/S2 metadata | Observed | Alchemy metadata for the V2 Citizen contract | Lookup fails closed |
| S1 Elite status | Calculated | Current S1 `rarityMonRank <= 500` | Not classified without a current rank |
| S2 rarity rank | Unavailable | No canonical current rank source is published | UI says rank not published |

NeoTokyo.codes is an internal endpoint, so it is called server-side and cached. S2 component IDs use deterministic onchain getters. No client credential is exposed.

## Staking points

User-facing S1 points:

```text
Credit Yield points × lock multiplier × Vault multiplier + BYTES staked ÷ 200
```

User-facing S2 points:

```text
lock multiplier + BYTES staked ÷ 200
```

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

- Collection floors: current OpenSea collection statistics.
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
