# Citizen Interlink metric contract

## Citizen holder map

| Metric | Class | Source | Unavailable state |
|---|---|---|---|
| S1/S2 Owners (Unique) | Calculated from observed ownership | Current V2 ERC-721 Transfer history plus same-block `ownerOf`; NeoTokyoStaker custody resolved through active `getStakerPositions` records | Snapshot generation fails closed |
| Held / staked token split | Calculated from observed ownership | Current V2 token owner plus staking-position owner at one finalized Ethereum block | Snapshot generation fails closed |
| Top holders | Calculated from observed ownership | Per-address sum of directly held and actively staked current V2 Citizens | Snapshot generation fails closed |
| Original Upload / Original Wallet | Calculated from observed lineage | Original S1 Identity, Vault, Item Cache, Land Deed, legacy Citizen, V2 Citizen, and verified staking histories at one finalized block | Snapshot generation fails closed |

The OpenSea-style percentage denominator is each current V2 Citizen contract's same-block `totalSupply()`. Unmigrated legacy Citizens are excluded because they are outside those current marketplace collection contracts. The collector replays every indexed ERC-721 transfer chronologically, verifies every reconstructed token owner with `ownerOf`, requires the staking contract's custody token-ID set to equal the active position token-ID set, and requires both counts to equal `balanceOf(NeoTokyoStaker)`. A wallet holding Citizens both directly and through staking is counted once per season. Counts are onchain addresses, not known people: one person using multiple addresses remains multiple owners, and unrelated custody contracts are not beneficially resolved without a verified protocol mapping.

### Original Upload and Original Wallet

Each original-distribution component cohort is reconstructed independently from its legacy claim path and pinned in the versioned `data/s1-original-component-cohorts.json` manifest. Every row records component kind, token ID, mint block, mint transaction hash, and verified issuance path; the snapshot generator requires the checked-in full-manifest digest, contract address, approved issuance method, token-ID digest, and a matching zero-address mint in the live indexed transfer ledger. The manifest contains **2,018 Identities** through block `13,361,535`; **2,500 Vault Cards** through `13,430,633`; **2,495 Item Caches** claimed through `boxClaim` by block `13,835,401`; and **1,985 Land Deeds** claimed through `landClaim` by block `13,838,837`. This excludes the separate [Bought Identity contract](https://etherscan.io/address/0x835a60cc60b808e47825daa79a9da6c9ff3a892e), `buyItems`, `buyLand`, later-issued components, and later remints even when they reuse a historical token number.

An **Original Upload** is a first S1 upload whose Identity, Item Cache, Land Deed, and Vault Card when present all belong to those original 2021 claim cohorts. Component trading before that Citizen's first upload does not disqualify it; the distinction concerns the provenance and continued integrity of the uploaded composition. The Citizen must remain currently assembled and must never have been disassembled or reassembled. Legacy-to-V2 migration and verified NeoTokyoStaker custody preserve Original Upload because neither operation changes its component composition.

An **Original Wallet** is an Original Upload whose first assembly wallet remains its uninterrupted beneficial owner. A transfer to any other ordinary wallet breaks the distinction permanently, including a later transfer-back. Legacy-to-V2 migration preserves continuity only when the V2 Citizen is issued to the same wallet. NeoTokyoStaker custody preserves it only when the active staking position attributes that Citizen to the same original assembly wallet. Original Wallet is therefore always a subset of Original Upload. Citizen and unique-wallet totals are reported separately.

The shared denominator is the number of provenance-qualified first uploads assembled from original components. The generator pins a finalized Ethereum block, requires the Alchemy transfer index to report the same block hash both before and after collection, verifies every surviving Original Upload's four component getter values at that block, treats an absent Vault as token ID `0`, verifies current legacy and V2 ownership, requires exact staking custody/position parity, and fails closed on ambiguous migration or inactive state.

Original Upload and Original Wallet headline counts and the holder leaderboard are stored in the compact client projection `data/citizen-holder-public.json`. Lookup token-ID sets remain server-only in `data/citizen-holder-snapshot.json`; per-Citizen assembly wallet, assembly block and transaction, current beneficial owner, location, constituent IDs, and nested-wallet classification are stored in `data/citizen-s1-lineage-audit.json`. The runtime and audit artifacts share one pinned block and a SHA-256 digest over every versioned audit-row evidence field. S1 lookup renders the lineage block/time beside the result. Both badges fail closed after **36 hours** without a regenerated snapshot because a transfer or disassembly can invalidate either distinction; stale results explicitly say badges are hidden pending refresh. S2 never receives these historical fields.

## Citizen lookup

| Metric | Class | Source | Unavailable state |
|---|---|---|---|
| S1 component token numbers, traits, trait-sum score, rarity ranking score and rarity rank | Observed | NeoTokyo.codes current Citizen RPC (`componentScore`, `rarityMonScore`, `rarityMonRank`) | Lookup fails closed |
| S2 component token numbers | Observed | S2 Outer Citizen V2 component getters on Ethereum | Lookup fails closed |
| Assembled S1/S2 metadata | Observed | Alchemy metadata for the V2 Citizen contract | Lookup fails closed |
| S1 Elite status | Calculated | Current S1 `rarityMonRank <= 500` | Not classified without a current rank |
| S1 Original Upload badge | Calculated from pinned lineage snapshot | Current S1 token ID belongs to the verified Original Upload set | Badge omitted |
| S1 Original Wallet badge | Calculated from pinned lineage snapshot | Current S1 token ID belongs to the verified Original Wallet subset | Badge omitted |
| S2 OpenSea estimated rarity rank | Estimated | Current OpenSea item page / OpenRarity output | Explicitly says OpenSea estimate unavailable; never calculates a substitute |

NeoTokyo.codes is an internal endpoint, so it is called server-side and cached. S2 component IDs use deterministic onchain getters. No client credential is exposed. OpenSea's S2 rank is kept in a distinct `estimatedRank` field with source URL and lookup timestamp. It is an OpenSea marketplace estimate, not a canonical official Neo Tokyo S2 rank. If OpenSea does not return a valid positive integer rank for the exact contract and token, the estimate remains explicitly unavailable. Citizen Interlink does not derive or invent a replacement score or rank.

For S1 component cards, **Trait sum score** displays NeoTokyo.codes `componentScore`. **Rarity ranking score** displays its RarityMon-derived `rarityMonScore`, which accompanies the published component rarity rank. The score formulas are not recalculated or reinterpreted by Citizen Interlink.

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

Refresh target: **1 hour**. The response remains pinned to one Ethereum block and publishes that block and timestamp. The hourly cache reduces unnecessary RPC reads while preserving an adequate informational rate for the calculator.

The calculator displays this live onchain-derived rate as a read-only current statistic. Users cannot override the rate; hypothetical controls are limited to the target BYTES price used by Speculator Mode.

## Market references

- Collection floors: lowest executable listing returned by the current price-sorted OpenSea listing feed. The unauthenticated collection-statistics endpoint is not used because it returns unauthorized responses without an API key.
- Elite floor: lowest current listed S1 in the scanned listing set whose current NeoTokyo.codes rank is 500 or better.
- Elite table: current listed S1s joined to the current rank feed.
- No executable listing: display `No Listings`, never a stale sale-derived floor.
- Floors and Elite listing scan: cached independently for **5 minutes**.
- Collection offers: cached independently for **15 minutes**.
- NeoTokyo.codes S1 ranking table: cached independently for **1 hour**.
- Valuation supply and custody: calculated at one pinned Ethereum block and cached independently for **1 hour**.
- Market source timestamps: listing, offer and ranking acquisition times are returned separately. Supply retains its own pinned block time. The `$BYTES` market-cap input retains its separate first-party block and timestamp.

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
position cost = entered Citizen ETH price × current ETH/USD + entered BYTES × current BYTES spot price
annual reward value = current net BYTES/day × 365 × selected reward-valuation price
hypothetical APY = annual reward value ÷ position cost × 100
```

The Citizen ETH price defaults to the current executable Citizen floor for the selected season and can be replaced with a specific listing or historical purchase price. Historical ETH prices are converted using current ETH/USD, not the exchange rate at purchase. With Speculator Mode off, the selected reward-valuation price is current BYTES spot. With it on, only the projected reward valuation uses the target BYTES price; acquisition cost remains based on current spot. The projection excludes gas, marketplace fees, taxes, slippage, liquidity, rate changes and floor movement. It is informational and not financial advice.
