# BYTES Intelligence Terminal — Metric Contract

**Status:** Implemented v1 metric contract  
**Prepared:** 2026-08-15 UTC  
**Purpose:** Define and govern every v1 public metric so observed values, calculations, projections, unavailable source gates, and market commentary cannot be confused.

---

## Product principle

The terminal must answer four different questions without blending them:

1. **What exists now?** — observed on-chain supply and staking state.
2. **What is being emitted now?** — the configured staking-contract payout rate.
3. **What does the intended curve imply?** — formula-based emissions at the current decay week.
4. **Where could supply converge?** — scenario projections whose assumptions are visible.

Every displayed value must carry a source class and timestamp:

- **Observed:** read directly from a chain, contract, or verified event index.
- **Calculated:** deterministic arithmetic from observed inputs.
- **Projected:** depends on stated future assumptions.
- **Reference:** externally maintained community data used as a cross-check, not primary truth.

## Canonical contracts and sources

| Source | Role | Authority |
|---|---|---|
| Neo Tokyo staking contract `0x67e1eCFA9232E27EAf3133B968A33A9a0dCa9e16` | Configured asset-type indices 0–3; S1 and S2 are the recognized public emission components | Primary and verified |
| Ethereum BYTES 2.0 `0xa19f5264F7D7Be11c451C093D8f92592820Bea86` | Ethereum ERC-20 total supply and direct balances | Primary and verified bidirectionally through `staker.BYTES()` and `token.STAKER()` |
| Legacy Ethereum BYTES token source | Remaining legacy supply | Unresolved; unavailable in v1 until token identity, interface, and economic treatment are independently verified |
| Avalanche BYTES `0x13af0Fe9eB35e91758B467f95cbc78e16FdD8B6b` | Avalanche ERC-20 representation supply | Primary; source-gated by chain 43114, EIP-1967 implementation `0x5430…7874`, BYTES metadata, and verified CCIP BurnMint pool `0xAb2e…0A9A` |
| Chainlink CCIP BYTES directory | Ethereum–Avalanche Lock/Release versus Burn/Mint topology | Canonical bridge reference for the verified release scope; Ethereum is Lock/Release and Avalanche is a Burn/Mint representation |
| Ethereum BYTES/WETH Uniswap V3 pool `0xfeb09c7e130a4b87b27ebd648ec485657b688b34` | BYTES/WETH spot ratio linked from DEXTools | Primary on-chain price venue, paired with Chainlink ETH/USD for USD conversion |
| BYTES 2.0 launch tokenomics document | Reservoir tiers, 3% DAO tax, decay formula | Canonical reference |
| Citizen staking spreadsheet | Independent per-point and participation cross-check | Reference only |
| Ktrap and 0xSanSSerif historical reports | Historical checkpoints and explanatory context | Reference only |

The Ethereum BYTES 2.0 identity is established by a same-block bidirectional contract relationship: the verified staker's immutable `BYTES()` getter returns the token above, the token's `STAKER()` getter returns the verified staker, and `decimals()` returns 18. Avalanche identity is independently established at one Avalanche block through an actual RPC `eth_chainId` response, proxy implementation, name, symbol, decimals, `BurnMintTokenPool.getToken()`, pool version, pool `MINTER_ROLE` linkage, and a block-tagged simulation proving the pool can call the token's public self-burn `burn(uint256)` path. The verified BYTES implementation has no `BURNER_ROLE`; burn capability comes from the pool burning tokens held by its own address. Legacy Ethereum, circulating supply, maximum supply, terminal supply, and summed cross-chain supply remain unavailable unless independently established.

---

## A. Supply Terminal

### A1. Ethereum BYTES 2.0 minted supply

**Public label:** `Ethereum Chain-Local Total Supply`
**Type:** Observed  
**Definition:** ERC-20 `totalSupply()` on the verified Ethereum BYTES 2.0 contract after same-block bidirectional identity and decimals checks.
**Refresh:** 15 minutes.  
**V1 status:** Available as a direct observed Ethereum contract read. This is not circulating, cumulative minted, maximum, terminal, legacy, Avalanche, or combined cross-chain supply.
**Failure behavior:** Return this metric as unavailable in a sanitized HTTP 200 partial response while preserving primary configured-emission data. Successful complete and partial responses use the declared 15-minute CDN policy; no persistent last-known-good metric store is claimed.

### A2. Remaining BYTES 1.0 supply

**Public label:** `Legacy BYTES 1.0`  
**Type:** Observed  
**Definition:** ERC-20 `totalSupply()` for a future independently verified legacy BYTES contract, with any confirmed inaccessible/burn-address treatment documented separately.  
**V1 gate:** Unavailable. The legacy contract identity, interface, and economic treatment are unresolved.  
**Caveat:** Do not automatically call all BYTES 1.0 circulating or economically active.

### A3. Avalanche BYTES supply

**Public label:** `Avalanche Chain-Local BYTES Supply`
**Type:** Observed  
**Definition:** ERC-20 `totalSupply()` on the verified Avalanche proxy at one block after every identity invariant above succeeds.
**Cross-chain treatment:** This is a per-chain representation supply. It is not added to Ethereum `totalSupply()` because Chainlink CCIP burns/mints remote representations while Ethereum uses Lock/Release.
**Refresh:** 15 minutes. Failure degrades only the Avalanche metric.

### A4. Combined minted supply

**Public label:** Not published as a summed metric
**Decision:** Do not add Ethereum and Avalanche `totalSupply()` values. The verified Avalanche Burn/Mint balance represents claims backed through the Ethereum Lock/Release topology, so addition would double count bridged units. Other remote chains are outside this release's runtime-verified scope.
**Public treatment:** Show Ethereum canonical total supply and Avalanche per-chain supply separately. Use canonical Ethereum `totalSupply()` once for Total Supply Valuation.

### A5. Pending staking rewards

**Public label:** `Pending / Unclaimed Rewards`  
**Type:** Calculated from indexed observed contract inputs
**Definition:** Net pending reward snapshot aggregate across indexed stakers at one pinned Ethereum block. It is not an amount claimable by one caller and changes as rewards accrue or claims execute.
**Companion metric:** The aggregate may be shown as a percentage relative to current Ethereum total supply for scale. This is not a supply share: pending rewards are accrued and unclaimed and do not enter `totalSupply()` until claimed and minted.
**Implementation:** Deduplicate all `Stake.staker` and conservative `Claim.recipient` addresses from deployment through a pinned participant snapshot, merge event deltas through the response block, and sum `getPendingPoolReward()` reward outputs for economically claimable S1-position, S2-position, and LP pools through Multicall3. S1/S2 position rewards include BYTES-staking bonus points. The DAO-tax return value is summed separately and excluded from the displayed net pending aggregate.
**Snapshot evidence:** Pin and runtime-validate source block number/hash, contract, deployment block, participant count, canonical address-list SHA-256 digest, Stake/Claim event counts, unique participant counts, collector version, and log-query calls/retries.
**Operational bounds:** The endpoint deduplicates delta addresses during each block batch and fails this secondary metric closed if the snapshot delta exceeds 250,000 blocks, the delta exceeds 10,000 raw Stake/Claim logs, participants exceed 5,000, or Multicall work exceeds 32 chunks. Chunks contain at most 500 calls and execute in one bounded wave of at most 32 chunks. A new snapshot must be generated before a limit is reached.
**V1 status:** Available when the complete index, canonical identity checks, and every bounded pending component succeed at one pinned block; otherwise `null` with partial status.
**Failure behavior:** Never infer it as `projected max − minted supply`.

### A6. BYTES held by staking contract

**Public label:** `BYTES Held by NeoTokyoStaker`
**Type:** Observed  
**Definition:** Direct BYTES `balanceOf(NeoTokyoStaker)` at the response block. Label it only as the contract-held balance; direct transfers mean it is not automatically equivalent to active-position principal.
**Companion metric:** A percentage of current Ethereum BYTES 2.0 total supply may be calculated only with that denominator named explicitly.

### A7. Self-reported circulating supply

**Public label:** `Estimated Liquid Supply`  
**Type:** Calculated  
**Preferred formula:**

```text
Economically net minted supply
− BYTES staked
− confirmed protocol-controlled locked supply
− confirmed burns or inaccessible supply not already removed by totalSupply()
```

**Do not subtract:** Pending/unclaimed rewards if those rewards have not yet entered minted supply.  
**Copy rule:** Always use `estimated`; never present it as an exchange-certified circulating supply.

### A8. Burned BYTES

**Public label:** `Confirmed Burns`  
**Type:** Observed/indexed  
**Definition:** Cumulative BYTES permanently removed through verified burn transactions or contract mechanics.  
**Required breakdown:** protocol burns, same-transaction remints, direct satellite-chain burns, and bridge-mechanic burns.
**Rule:** Transfers to zero or a dead-looking wallet count only after transaction semantics are verified; CCIP bridge burns must remain separate from permanent destruction.
**Release status:** Deferred. The receipt-complete historical Avalanche index did not pass conservation at the release gate, so no burn value or burn panel ships in this release.

### A9. BYTES USD price

**Public label:** `BYTES/USD Spot Price`
**Type:** Calculated from observed on-chain inputs
**Formula:** `(Uniswap V3 sqrtPriceX96 / 2^96)^2 WETH/BYTES × Chainlink ETH/USD`.
**Identity gate:** The DEXTools-linked pool must have canonical Ethereum BYTES as token0, WETH as token1, positive liquidity, the approved Uniswap V3 factory, and factory registry confirmation at the Ethereum source block. The Chainlink answer must be positive, complete, and no more than 7,200 seconds old.
**Caveat:** Single-pool `slot0` spot price; not a TWAP, volume-weighted price, or slippage-adjusted execution quote.

### A10. Market Cap*

**Public label:** `Market Cap*`
**Type:** Calculated
**Formula:** `canonical Ethereum totalSupply × BYTES/USD spot price`.
**Supply definition:** Canonical Ethereum issued supply once. Remote BurnMint supplies are not added.
**Asterisk rule:** The community widely uses this Ethereum canonical total-supply valuation as the effective BYTES market cap. The public label may use `Market Cap*` only when the page footnote states that it is not a conventional circulating market capitalization, because a defensible circulating-supply figure is unavailable. It is also not conventional FDV because no verified maximum supply is applied.

---

## B. Emissions Reactor

### B1. Live configured emissions

**Public label:** `Configured Daily Emissions`
**Type:** Observed  
**Definition:** Sum of the most recent 24-hour output from:

```solidity
getTotalEmissions(0, now - 86400) // S1
getTotalEmissions(1, now - 86400) // S2
getTotalEmissions(2, now - 86400) // internal asset-type index 2
getTotalEmissions(3, now - 86400) // internal asset-type index 3
```

**Display:** BYTES/day plus the community-recognized S1 and S2 components. The verified contract enum names indices 2 and 3 `BYTES` and `LP`, but BYTES staking contributes bonus points to S1/S2 positions rather than exposing a separately claimable BYTES reward category, while LP is a legacy LP-token staking path. Both emission reads are currently zero, so they are not presented publicly as active ecosystem pools. They remain mandatory internal reads; if either becomes nonzero, the headline card must show a conditional legacy-asset emission alert so its total cannot silently exceed the visible S1/S2 split.
**Current research checkpoint:** approximately `744.2296 BYTES/day`, subject to a fresh block read when implemented.  
**Authority:** This is the headline current-emissions metric.

### B2. DAO share

**Public label:** `Treasury Share`  
**Type:** Calculated/reference-validated  
**Definition:** 3% DAO tax from the launch tokenomics and contract configuration.  
**Display:** Optional tooltip or detail row; do not subtract it twice when the aggregate contract emission already includes DAO allocation.

### B3. Observed per-point yield

**Public label:** `Estimated Yield per Point`  
**Type:** Reference/observed sample  
**Definition:** Citizen spreadsheet’s wallet-accrual sampling, split into owner and DAO rates.  
**Current research checkpoint:** S1 owner `0.0451`, S1 DAO `0.0014`, S2 owner `0.0130`, S2 DAO `0.0004` BYTES/point/day.  
**Copy rule:** Label as estimated and cite the sample timestamp/method.

### B4. Modeled curve emissions

**Public label:** `Modeled Current Daily Rate`
**Type:** Projected/calculated  
**Formula:**

```text
active reservoir × 2^(-a / 52)
```

Where `a` is the elapsed weekly decay index from the verified epoch.  
**Purpose:** Show the intended formula separately from the current configured contract window.  
**Never label:** `current emissions`.

### B5. Curve alignment

**Public label:** `Configured vs. Modeled Variance`
**Type:** Calculated  
**Definition:**

```text
live configured emissions − modeled curve emissions
```

**Status language:** `Aligned`, `Contract window above model`, or `Contract window below model`.
**Sign rule:** Positive means configured daily emissions are above the modeled daily rate; negative means configured daily emissions are below it.
**No accusation language:** A difference is not automatically an error; configuration cadence and participation-window rules may explain it.

### B6. Emissions change

**Public labels:** `7D Change`, `30D Change`, `Since Previous Window`  
**Type:** Calculated from observed historical windows.  
**Rule:** Do not calculate change from two theoretical points when the card is presented as actual emissions.

### B7. Projected next-365-day issuance

**Public label:** `Projected Next-365-Day Issuance`
**Type:** Projected
**Definition:** Sum the current configured S1/S2 daily rate through the remainder of the current decay week, then apply the weekly factor `2^(-1/52)` across the next 365 days.
**Assumptions:** Current participation remains steady and the verified weekly decay continues.
**Rule:** Never substitute `current daily emissions × 365`; that flat run-rate ignores the decay curve and materially overstates modeled issuance.

---

## C. Decay Curve and Genesis Milestones

### C1. Historical configured emissions

**Type:** Observed/reconstructed  
**Definition:** Daily or reward-window totals reconstructed from `getTotalEmissions()` differences.  
**Display:** Stepped line.

### C2. Idealized exponential curve

**Type:** Calculated  
**Definition:** Formula output using a selected participation reservoir.  
**Display:** Smooth or weekly-stepped comparison line, visually distinct from actual contract windows.

### C3. Genesis emissions milestones

**Public label:** `Genesis Emissions Milestones`  
**Reference baseline:** 11,000 BYTES/day maximum launch reservoir.
**Reservoir definition:** A reservoir is the week-zero daily allocation supplied to the decay model before weekly decay. It is a model baseline, not the current daily issuance rate. The steady-participation baseline combines S1 `5,500/day` and S2 `375/day` for `5,875/day`; the maximum-participation baseline uses `11,000/day`.

| Milestone | Rate |
|---|---:|
| Genesis maximum | 11,000/day |
| 1st half-level | 5,500/day |
| 2nd half-level | 2,750/day |
| 3rd half-level | 1,375/day |
| 4th half-level | 687.5/day |

**Copy rule:** Prefer `half-level` or `Genesis emissions milestone` in methodology. The UI may use familiar `halving milestone` language only with a tooltip explaining that participation tiers can move realized emissions independently of the decay factor.

### C4. Next milestone

**Type:** Calculated  
**Definition:** The next 52-week Genesis half-level after the current theoretical model week.
**Current research checkpoint:** Week 208, modeled for June 10, 2027, when S1 reaches `343.75 BYTES/day` and combined S1+S2 reaches `367.1875 BYTES/day`.
**Display:** Date and rate must be labeled projected; realized configured emissions can differ with participation and explicit reward windows.

---

## D. Supply Horizon

V1 publishes projected remaining issuance only. The terminal-supply equations below are future-gated projections, not hard caps, and must remain unpublished until economically net minted supply, pending rewards, burns, migrations, and token identity are independently verified.

### D1. Steady participation scenario

**Public label:** `Steady Scenario`  
**Type:** Projected  
**Assumption:** Current verified reservoir tiers remain constant while the weekly exponential decay continues.  
**Formula:**

```text
projected terminal supply
= economically net minted supply
+ pending/unclaimed rewards
+ remaining geometric emissions under the steady reservoir
```

### D2. Maximum participation scenario

**Public label:** `Maximum Participation Scenario`  
**Type:** Projected  
**Assumption:** Maximum 11,000/day reservoir is used for the remaining curve.  
**Purpose:** Upper-bound comparison, not a likely forecast.

### D3. Configured-window scenario

**Public label:** `Configured Window Scenario`  
**Type:** Projected  
**Assumption:** Uses current configured emissions until the next known configuration point, then follows the modeled curve.  
**Gate:** Ship only if its transition rule is deterministic and documented.

### D4. Remaining issuance

**Public label:** `Projected Remaining Issuance`  
**Type:** Projected  
**Display:** BYTES for each remaining-issuance scenario. Do not publish a percentage of terminal supply while the terminal-supply inputs remain source-gated.

---

## E. Sell-Pressure Lens

This section describes supply mechanics, not price outcomes.

### E1. New issuance value

**Public label:** `Daily New Issuance Value`  
**Type:** Calculated  
**Formula:**

```text
live configured BYTES/day × current BYTES/USD
```

**Caveat:** This is not equivalent to daily sell pressure. Stakers may hold, compound, claim later, or sell.

### E2. Net issuance after confirmed burns

**Public label:** `Net Issuance After Burns`  
**Type:** Calculated  
**Window:** selectable 7D/30D.  
**Formula:**

```text
new emissions during window − confirmed burns during window
```

**Negative result label:** `Net deflationary for selected window`, not `BYTES is permanently deflationary`.

### E3. Absorption ratio

**Deferred from v1.** Trading volume is not equivalent to net demand, and a ratio based on headline volume would imply more certainty than the data supports.

### Required thesis language

Approved analytical framing:

> Structurally lower new issuance may require less demand to absorb newly created BYTES than in earlier cycles. Price still depends on demand, liquidity, holder behavior, and wider market conditions.

Prohibited framing:

- Scarcity guarantees price appreciation.
- A bull market will cause BYTES to reach a stated price.
- Daily issuance equals daily sell pressure.
- Projected terminal supply is a hard-coded maximum unless the contract proves it.

---

## Refresh, storage, and provenance

### Recommended cadence

| Data | Cadence |
|---|---|
| Contract supply, balances, configured emissions | Every 15 minutes |
| Staked Citizen/BYTES participation | Every 15 minutes or hourly |
| Historical window reconstruction | Daily and when configuration changes |
| Market price | Every 5–15 minutes |
| Burn index | Hourly |
| Supply-horizon projections | Recalculate whenever an input changes |
| Community spreadsheet cross-check | Hourly; never block primary data |

### Snapshot shape

The public API and archived snapshot should include:

```json
{
  "schemaVersion": 1,
  "generatedAt": "ISO-8601 UTC",
  "sourceBlock": 1,
  "status": "fresh | partial",
  "freshnessPolicy": {
    "freshForSeconds": 900,
    "staleWhileRevalidateSeconds": 3600,
    "staleIfErrorSeconds": 3600
  },
  "metrics": {},
  "projections": {},
  "provenance": {},
  "warnings": []
}
```

This is the successful HTTP 200 shape. A total primary-read failure uses a separate sanitized, private/no-store HTTP 503 response with `sourceBlock: null` and `status: unavailable`; it is never accepted as successful dashboard data.

Each metric record should contain:

```json
{
  "value": 0,
  "unit": "BYTES/day",
  "classification": "observed | calculated | projected | reference",
  "availability": "available | partial | unavailable",
  "source": "staking-contract",
  "asOf": "ISO-8601 UTC"
}
```

### Stale-data contract

- Never silently replace a failed observed value with a theoretical estimate.
- Preserve the last verified value and expose age/staleness.
- A failed secondary source cannot mark primary contract data invalid.
- If cross-chain supply reconciliation fails, show chain values separately and suppress combined supply.
- Public errors remain concise; endpoint details, provider keys, and traces stay private.

---

## V1 public metric set

Ship first:

1. Live configured emissions with public S1 and S2 components plus source block/time; internal indices 2 and 3 remain completeness-gated but hidden while zero.
2. Historical configured emissions chart.
3. Modeled curve overlay and Genesis milestone lines.
4. Stable source-gated supply fields that remain unavailable/null until canonical token identity and interface are independently verified.
5. Stable source-gated staking fields that remain unavailable/null until position accounting and denominator definitions are independently verified.
6. Stable source-gated pending-reward fields that remain unavailable/null until aggregate claimable methodology is independently reproduced.
7. Steady and maximum-participation remaining-issuance projections; no fixed terminal-supply or hard-cap claim.
8. Methodology panel with formulas, sources, and observed/calculated/projected badges.
9. Balanced Ethereum/Avalanche chain-local supply rows, Market Cap* with a visible caveat, staking-contract balance percentage, SanSerif community credit, CMC context, and a grounded plain-English summary.

Hold until verified:

- Combined ETH+AVAX supply.
- Cross-chain circulating supply.
- Comprehensive burn total.
- “Net sell pressure” or absorption metrics.
- Any price implication beyond conditional supply-side analysis.

## Resolved v1 decisions

1. Public route/name: `$BYTES Terminal` at `/bytes`.
2. Navigation placement: top-level link immediately before Engine Room.
3. Default story emphasis: observed configured emissions first, with modeled and projected values visibly separate.
4. SanSerif's manual BytesMetrics.io work receives public credit at the top of the terminal; the link uses the canonical X profile `https://x.com/0xSanSSerif`.
5. V1 includes restrained conditional supply-side context, with no price targets, guarantees, or fixed-hard-cap claims.

## Deferred v1 follow-up

- Receipt-complete burned totals, keeping direct burns, remints, and CCIP bridge burns distinct.
- Staked S1 and S2 token counts and each count as a percentage of its collection supply.
- Independently verified remaining non-migrated BYTES 1.0 and its economic treatment.
