# Citizen Terminal metric contract

## Citizen lookup

| Metric | Class | Source | Unavailable state |
|---|---|---|---|
| S1 component token numbers, traits, trait-sum score, rarity ranking score and rarity rank | Observed | NeoTokyo.codes current Citizen RPC (`componentScore`, `rarityMonScore`, `rarityMonRank`) | Lookup fails closed |
| S2 component token numbers | Observed | S2 Outer Citizen V2 component getters on Ethereum | Lookup fails closed |
| Assembled S1/S2 metadata | Observed | Alchemy metadata for the V2 Citizen contract | Lookup fails closed |
| S1 Elite status | Calculated | Current S1 `rarityMonRank <= 500` | Not classified without a current rank |
| S2 OpenSea estimated rarity rank | Estimated | Current OpenSea item page / OpenRarity output | Explicitly says OpenSea estimate unavailable; never calculates a substitute |

NeoTokyo.codes is an internal endpoint, so it is called server-side and cached. S2 component IDs use deterministic onchain getters. No client credential is exposed. OpenSea's S2 rank is kept in a distinct `estimatedRank` field with source URL and lookup timestamp. It is an OpenSea marketplace estimate, not a canonical official Neo Tokyo S2 rank. If OpenSea does not return a valid positive integer rank for the exact contract and token, the estimate remains explicitly unavailable. Citizen Terminal does not derive or invent a replacement score or rank.

For S1 component cards, **Trait sum score** displays NeoTokyo.codes `componentScore`. **Rarity ranking score** displays its RarityMon-derived `rarityMonScore`, which accompanies the published component rarity rank. The score formulas are not recalculated or reinterpreted by Citizen Terminal.

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

The calculator displays this live onchain-derived rate as a read-only current statistic. Users cannot override the rate; hypothetical controls are limited to the target BYTES price used by Speculator Mode.

## Market references

- Collection floors: lowest executable listing returned by the current price-sorted OpenSea listing feed. The unauthenticated collection-statistics endpoint is not used because it returns unauthorized responses without an API key.
- Elite floor: lowest current listed S1 in the scanned listing set whose current NeoTokyo.codes rank is 500 or better.
- Elite table: current listed S1s joined to the current rank feed.
- No executable listing: display `No Listings`, never a stale sale-derived floor.
- Market timestamp: API response generation time.

Listings can change or disappear before a transaction confirms.

### Implied ecosystem valuation supply model

The live implied Neo Tokyo ecosystem valuation accounts for both legacy and V2 custody. V2 Citizen migration locks the legacy Citizen NFT in the V2 Citizen contract; migrated Citizens do not mint their V2 components until disassembly. Therefore, a V2 component contract's `totalSupply()` is not the complete historical component count, and legacy components permanently held by a legacy Citizen contract are not counted again beside the assembled Citizen.

At one pinned Ethereum block, economically distinct supply is calculated as:

- **Active assembled Citizens:** `V2 Citizen totalSupply + legacy Citizen totalSupply - legacy Citizen balanceOf(V2 Citizen contract)`.
- **Unassembled component supply:** `(legacy component totalSupply - legacy component balanceOf(legacy Citizen contract) - legacy component balanceOf(V2 component wrapper)) + (V2 component totalSupply - V2 component balanceOf(V2 Citizen contract))`.
- S1 Identity legacy supply combines the original Identity and Bought Identity contracts because both migrate into the same V2 Identity collection.
- Vaults remain optional, so Vault custody must be measured directly rather than inferred from the assembled Citizen count.

The valuation exposes its pinned block, distinguishes legacy and V2 custody in collection math, and labels the result as an **implied ecosystem value**, not a company market cap or realizable liquidation value. `FLOOR-LED` uses each executable listing floor and falls back to the highest eligible collection offer only when that collection has no listing. `OFFER-LED` uses the highest eligible active collection-wide offer for every row. Offer quantity is shown because a bid has limited depth. Either method fails closed as `INCOMPLETE VALUATION` if a required collection has no eligible price reference. Elite Citizens are excluded because they overlap S1 Citizen supply. The existing canonical Ethereum `$BYTES` total-supply valuation is added exactly once.

## APY scenario

Classification: **Projected**.

```text
position cost = current Citizen floor in USD + entered BYTES × current BYTES spot price
annual reward value = current net BYTES/day × 365 × selected reward-valuation price
hypothetical APY = annual reward value ÷ position cost × 100
```

With Speculator Mode off, the selected reward-valuation price is current BYTES spot. With it on, only the projected reward valuation uses the target BYTES price; acquisition cost remains based on current spot. The projection excludes gas, marketplace fees, taxes, slippage, liquidity, rate changes and floor movement. It is informational and not financial advice.
