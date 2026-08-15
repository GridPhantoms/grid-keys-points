# BYTES Intelligence Terminal Implementation Plan

> **For Hermes:** Use subagent-driven-development skill to implement this plan task-by-task.

**Goal:** Add a transparent, mobile-friendly Neo Tokyo BYTES intelligence dashboard to Grid Phantoms with contract-derived emissions, historical decay visualization, scenario projections, and visible methodology.

**Architecture:** Create a new `/bytes` route with a server-rendered shell and one focused client dashboard. A server-only Route Handler queries Ethereum through private RPC configuration, verifies mainnet, normalizes observed metrics, and returns CDN-cacheable JSON; reconstructed configured-emissions history is shipped as a validated static JSON snapshot. Pure model and client-validation/sampling helpers live in testable JavaScript modules.

**Tech Stack:** Next.js 16.2 App Router, React 19, TypeScript, Tailwind CSS 4, ethers 6, native SVG, Node.js built-in test runner.

**Product contract:** `docs/bytes-terminal-metric-contract.md`

---

## Scope boundary

### V1 includes

- `/bytes` route and shared navigation entry.
- Contract-derived configured emissions for all four verified staking pools: S1, S2, BYTES, and LP.
- Stable unavailable/null supply, staking, and pending/unclaimed fields with explicit source-verification gates; no unverified token or aggregate claimable values.
- Historical reconstructed configured-emissions dataset and chart, classified as calculated from observed on-chain windows.
- Formula curve overlay and Genesis milestone lines.
- Steady and maximum-participation remaining-issuance projections.
- Observed/calculated/projected provenance labels.
- Stale/partial data states.
- Mobile and desktop layouts.

### V1 does not claim

- A reconciled ETH+AVAX combined supply.
- Exchange-certified circulating supply.
- Comprehensive burn totals.
- Guaranteed price effects or exact sell pressure.
- A non-null pending-reward aggregate until its methodology and indexer are independently verified.

---

### Task 1: Add deterministic emissions mathematics

**Objective:** Create one pure source of truth for weekly exponential emissions, time-indexing, milestone progress, remaining issuance, and metric-envelope validation.

**Files:**
- Create: `lib/bytes-model.mjs`
- Create: `test/bytes-model.test.mjs`
- Modify: `package.json`

**Step 1: Write failing model tests**

Cover:

- `emissionAtWeek(5875, 155)` is approximately `744.229571294358`, with S1/S2 checkpoints and exact 52-week half-levels.
- `theoreticalWeek` floors complete seven-day periods and `fractionThroughWeek` reports exact boundary/midweek progress.
- `annualizedIssuance` uses 365 days.
- `remainingGeometricIssuance` is finite, prorates the current week, and declines as the rate or remaining fraction declines.
- `progressTowardLowerMilestone` measures bounded progress between explicit levels.
- `metricEnvelope` preserves provenance and rejects invalid values, classifications, sources, timestamps, formulas, and assumptions.
- Invalid negative/non-finite model inputs and invalid ranges throw descriptive errors.

**Step 2: Run the tests to verify failure**

Run:

```bash
node --test test/bytes-model.test.mjs
```

Expected: FAIL because `lib/bytes-model.mjs` does not exist.

**Step 3: Implement the pure functions**

Exports:

```js
export const DECAY_WEEKS_PER_HALF = 52
export const GENESIS_MAX_DAILY_EMISSIONS = 11_000
export function emissionAtWeek(reservoir, week) {}
export function theoreticalWeek(epochSeconds, atSeconds) {}
export function fractionThroughWeek(epochSeconds, atSeconds) {}
export function annualizedIssuance(daily) {}
export function remainingGeometricIssuance(dailyAtStartOfCurrentWeek, fractionOfCurrentWeekElapsed) {}
export function progressTowardLowerMilestone(currentDaily, priorMilestone, nextMilestone) {}
export function metricEnvelope(value, classification, source, asOf, formula, assumptions) {}
```

Use the documented formula `1 / 2^(a/52)` and a prorated weekly geometric series. Keep supply arithmetic out of the model and validate every public metric envelope at construction time.

**Step 4: Add the test script and verify GREEN**

Add:

```json
"test:bytes": "node --test test/*.test.mjs"
```

Run:

```bash
npm run test:bytes
```

Expected: all model tests pass.

**Step 5: Commit**

```bash
git add lib/bytes-model.mjs test/bytes-model.test.mjs package.json
git commit -m "Add tested BYTES emissions model"
```

---

### Task 2: Build the server-only chain data adapter

**Objective:** Query verified contracts without exposing the RPC credential to the browser.

**Files:**
- Create: `lib/bytes-api.mjs`
- Create: `lib/bytes-contracts.ts`
- Create: `app/api/bytes-metrics/route.ts`
- Create: `test/bytes-api.test.mjs`
- Modify: `.env.example` if it exists; otherwise document the variable without adding a secret file

**Step 1: Write a failing response-shape fixture test**

Define and validate this minimum public shape:

```json
{
  "schemaVersion": 1,
  "generatedAt": "ISO UTC",
  "sourceBlock": 0,
  "status": "fresh | partial",
  "freshnessPolicy": {
    "freshForSeconds": 900,
    "staleWhileRevalidateSeconds": 3600,
    "staleIfErrorSeconds": 3600
  },
  "metrics": {
    "currentConfiguredEmissions": { "value": { "S1": 0, "S2": 0, "BYTES": 0, "LP": 0, "total": 0 } },
    "currentModeledRate": {},
    "annualizedConfiguredIssuance": {},
    "configuredVsTheoretical": {},
    "theoreticalWeek": {},
    "ethBytes2Supply": { "value": null, "availability": "unavailable" },
    "bytesHeldByStakingContract": { "value": null, "availability": "unavailable" },
    "pendingUnclaimedRewards": { "value": null, "availability": "unavailable" }
  },
  "projections": {},
  "provenance": {},
  "warnings": []
}
```

Every metric must include `value`, `unit`, `classification`, `availability`, `source`, and `asOf`; unavailable token metrics remain null with a neutral reason.

**Step 2: Verify the test fails**

Run:

```bash
node --test test/bytes-api.test.mjs
```

Expected: FAIL because the fixture/normalizer is absent.

**Step 3: Implement `lib/bytes-api.mjs` and `lib/bytes-contracts.ts`**

Requirements:

- Use ethers `JsonRpcProvider` server-side.
- Read only private server configuration: `ETHEREUM_RPC_URL` or `ALCHEMY_API_KEY`. Never use a `NEXT_PUBLIC_*` credential in the metrics route.
- Never return the RPC URL, credential, stack trace, or raw upstream response.
- Read one latest block and use its timestamp/block number for all calls.
- Call `getTotalEmissions(assetType, blockTimestamp - 86400)` for all four verified staking pools: S1, S2, BYTES, and LP.
- Keep Ethereum supply and direct staking-balance fields unavailable with a neutral source-gate reason until canonical token identity and ERC-20 interface are independently verified. Do not call or document candidate token contracts.
- Keep pending/unclaimed rewards unavailable with source `aggregate-indexer-not-established` until aggregate claimable methodology and an indexer are independently verified; do not tie this gate to token identity.
- Validate finite, non-negative outputs.
- Return `partial` with per-metric warnings if a noncritical metric fails; fail the route only if no primary metric can be produced.

**Step 4: Implement the Route Handler**

`app/api/bytes-metrics/route.ts` should:

- Call the server adapter.
- Return `Response.json(payload)`.
- Add `Cache-Control: public, s-maxage=900, stale-while-revalidate=3600`.
- Return a concise public-safe `503` payload when all primary data is unavailable.
- Remain dynamic; Next 16 Route Handlers are uncached by default, while the explicit CDN header controls the intended 15-minute edge cadence.

**Step 5: Verify shape and live response locally**

Run:

```bash
npm run dev
curl -sS http://localhost:3000/api/bytes-metrics > /tmp/bytes-metrics.json
node -e "const d=require('/tmp/bytes-metrics.json'); if(d.schemaVersion!==1) process.exit(1); console.log(d.status, d.sourceBlock)"
```

Expected: `fresh <positive block>` or an honestly labeled `partial` response with at least configured emissions.

**Step 6: Verify no secret reaches output**

Search the JSON for the provider hostname, `alchemy`, `/v2/`, or key fragments. Expected: no credential or raw RPC URL.

**Step 7: Commit**

```bash
git add lib/bytes-api.mjs lib/bytes-contracts.ts app/api/bytes-metrics/route.ts test/bytes-api.test.mjs
git commit -m "Add BYTES metrics API"
```

---

### Task 3: Generate and validate historical emissions data

**Objective:** Produce a reproducible reconstructed configured-emissions dataset instead of hard-coding chart points.

**Files:**
- Create: `public/data/bytes-emissions-history.json`
- Create: `scripts/validate-bytes-history.mjs`
- Modify: `package.json`

**Step 1: Define failing history validation requirements**

Require:

- `schemaVersion === 1`
- Strictly increasing, continuous UTC dates
- No duplicate dates
- Non-negative finite S1, S2, BYTES, LP, and total values
- `total` approximately equals the four-pool sum
- Source block, generation timestamp, boundaries, and methodology provenance exist
- Declared `start` and `end` match the first and last rows

**Step 2: Verify RED**

Run:

```bash
npm run validate:bytes-history
```

Expected: FAIL because the dataset and validator do not exist.

**Step 3: Normalize the reconstructed research dataset and implement the validator**

Normalize the independently reconstructed `getTotalEmissions()` reward-window series into the public dataset. Requirements:

- Server/local environment only; never write credentials into output.
- Preserve the complete reconstructed daily series without manual chart-point edits.
- Include `generatedAt`, `sourceBlock`, `start`, `end`, methodology, and rows.
- Round only for serialization stability; preserve enough precision to reproduce totals.
- Exit nonzero on missing days, invalid provenance, negative/non-finite values, or totals that differ from their four-pool sum.

**Step 4: Add the validator script**

```json
"validate:bytes-history": "node scripts/validate-bytes-history.mjs"
```

**Step 5: Verify GREEN**

Run:

```bash
npm run validate:bytes-history
```

Expected: the complete daily series validates successfully.

**Step 6: Commit**

```bash
git add public/data/bytes-emissions-history.json scripts/validate-bytes-history.mjs package.json
git commit -m "Add BYTES emissions history snapshot"
```

---

### Task 4: Add a reusable shared site navigation

**Objective:** Add the BYTES route consistently without maintaining seven copied navigation blocks.

**Files:**
- Create: `app/components/SiteNav.tsx`
- Modify: `app/page.tsx`
- Modify: `app/leaderboard/page.tsx`
- Modify: `app/trait-charts/page.tsx`
- Modify: `app/raffle/page.tsx`
- Modify: `app/mint-progress/page.tsx`
- Modify: `app/engine/page.tsx`

**Step 1: Create a navigation smoke checklist**

Expected desktop/mobile order:

1. Home
2. Leaderboards
3. Trait Charts
4. Raffle Tracker
5. Mint Progress
6. `$BYTES Terminal`
7. Engine Room

**Step 2: Implement `SiteNav` as a focused Client Component with caller-supplied route state**

Responsibilities:

- Accept a required caller-supplied `active` prop; route Server Components remain responsible for naming their active destination.
- Own mobile-menu state, active-link styling, and the menu button without deriving route state from a pathname hook.
- Preserve existing GRID/PHANTOMS lockup and sticky behavior.
- Close the mobile menu after navigation.
- Apply `aria-current="page"` to the active desktop and mobile links.
- Use state-aware accessible labels plus `aria-expanded` and `aria-controls` on the menu button, with a visible focus treatment.

**Step 3: Replace copied nav blocks one route at a time**

After each route replacement, run:

```bash
npm run build
```

Expected: successful build and no route-specific active-link regression.

**Step 4: Search for stale copied navigation**

Search for the previous comment/markup and verify only `SiteNav.tsx` owns the full route list.

**Step 5: Commit**

```bash
git add app/components/SiteNav.tsx app/page.tsx app/leaderboard/page.tsx app/trait-charts/page.tsx app/raffle/page.tsx app/mint-progress/page.tsx app/engine/page.tsx
git commit -m "Share site navigation and add BYTES terminal link"
```

---

### Task 5: Build the BYTES Terminal dashboard shell and stat cards

**Objective:** Render the public hierarchy with honest loading, partial, error, source-gated, and provenance states.

**Files:**
- Create: `app/bytes/page.tsx`
- Create: `app/bytes/BytesDashboard.tsx`
- Create: `app/bytes/types.ts`
- Create: `app/bytes/bytes.css`

**Step 1: Implement the route shell**

Keep metadata and `SiteNav active="bytes"` in the Server Component route. Mount the focused dashboard Client Component beneath it.

**Step 2: Implement independent live/history loading**

Responsibilities:

- Fetch and runtime-validate `/api/bytes-metrics`.
- Fetch and runtime-validate `/data/bytes-emissions-history.json` independently.
- Render the last-updated time, source block, freshness/partial warning, and private-safe failure states.
- Never replace observed values with projections or render malformed available/null data as zero.

**Step 3: Render the headline cards and source gates**

Headline cards:

- Live Configured Emissions with visible S1, S2, BYTES, and LP components.
- Current Modeled Rate.
- Annualized Configured Issuance.
- Configured Minus Modeled divergence.

The implemented Ethereum supply, direct staking-contract balance, and pending/unclaimed categories remain visibly unavailable until their respective source and definition gates pass. No circulating, burned, maximum-supply, or terminal-supply value is inferred.

**Step 4: Add provenance badges**

Use mandatory text labels as well as color:

- `OBSERVED` — cyan
- `CALCULATED` — neutral zinc
- `PROJECTED` — violet
- `REFERENCE` — amber

**Step 5: Verify responsive layout and quality gates**

Expected: one mobile column, two tablet columns where appropriate, four desktop headline cards, no clipped values or horizontal overflow.

```bash
npx eslint app/bytes/page.tsx app/bytes/BytesDashboard.tsx app/bytes/types.ts
npx tsc --noEmit
npm run build
```

**Step 6: Commit**

```bash
git add app/bytes
git commit -m "Add BYTES terminal dashboard shell"
```

---

### Task 6: Build the native SVG decay chart and client data guards

**Objective:** Compare reconstructed configured emissions with the modeled curve without adding a chart dependency or trusting unvalidated payloads.

**Files:**
- Create: `app/bytes/EmissionsChart.tsx`
- Create: `lib/bytes-client-data.mjs`
- Create: `test/bytes-client-data.test.mjs`
- Modify: `app/bytes/BytesDashboard.tsx`

**Step 1: Write failing helper tests**

Cover:

- Strict runtime validation for live metrics and history payloads.
- Available/null and malformed numeric/date rejection.
- Empty and single-row history handling.
- Shape-preserving sampling capped at 180 points, with first/last, chronological order, no mutation, and abrupt reward-window boundaries retained.

**Step 2: Implement the chart and guards**

Required layers and behavior:

- Cyan line: reconstructed configured history, labeled calculated from observed inputs.
- Violet dashed line: modeled weekly curve.
- Horizontal milestone context.
- Accessible SVG title/description and textual legend.
- Explicit insufficient-data state for fewer than two validated rows.
- No hover-only dependency, degenerate SVG geometry, or raw validation errors.

**Step 3: Verify known history fidelity**

The sampled production series must retain the June 23, 2023 drop to approximately 6,732/day while remaining at or below 180 ordered points.

**Step 4: Run gates and browser QA**

```bash
npm run test:bytes
npx eslint app/bytes/EmissionsChart.tsx app/bytes/BytesDashboard.tsx lib/bytes-client-data.mjs test/bytes-client-data.test.mjs
npx tsc --noEmit
npm run build
```

Inspect narrow mobile and desktop viewports for legibility and horizontal overflow.

**Step 5: Commit**

```bash
git add app/bytes/EmissionsChart.tsx app/bytes/BytesDashboard.tsx lib/bytes-client-data.mjs test/bytes-client-data.test.mjs
git commit -m "Add validated BYTES emissions chart"
```

---

### Task 7: Add remaining-issuance scenarios and methodology ledger

**Objective:** Explain supply-side mechanics without disguising assumptions as observed facts or claiming a fixed terminal supply.

**Files:**
- Modify: `app/bytes/BytesDashboard.tsx`
- Modify: `lib/bytes-model.mjs`
- Modify: `test/bytes-model.test.mjs`

**Step 1: Add projection model tests**

Verify:

- Remaining issuance prorates the unelapsed fraction of the current weekly period.
- Exact week boundaries match the full-week geometric formula.
- Maximum-participation remaining issuance exceeds steady participation.
- Advancing within or across a decay week reduces remaining issuance.
- Invalid elapsed fractions and model inputs fail safely.

**Step 2: Implement scenario cards**

Each card states its reservoir assumption, projected remaining issuance, source block, formula, assumptions, and `PROJECTED` badge. Do not publish terminal supply while minted, pending, burn, migration, and token-identity inputs remain unresolved.

**Step 3: Implement methodology and source-gate sections**

Expose expandable details for live configured emissions, modeled rate, divergence, annualization, projections, historical methodology, API provenance, classifications, and unavailable supply categories.

**Step 4: Add restrained market context**

Use the metric contract’s conditional supply-side thesis. Do not add price targets, guaranteed scarcity language, or promises that lower issuance increases price.

**Step 5: Run tests, targeted lint, typecheck, build, and copy review**

```bash
npm run test:bytes
npx eslint app/bytes/BytesDashboard.tsx lib/bytes-model.mjs test/bytes-model.test.mjs
npx tsc --noEmit
npm run build
```

**Step 6: Commit**

```bash
git add app/bytes/BytesDashboard.tsx lib/bytes-model.mjs test/bytes-model.test.mjs
git commit -m "Add BYTES issuance scenarios and methodology"
```

---

### Task 8: Add deterministic refresh automation

**Objective:** Keep history and validation snapshots current without invoking an LLM.

**Files:**
- Create: `scripts/grid_phantoms_bytes_terminal_refresh.py` under the established Hermes scripts directory, not the public repo
- Create: focused script tests under the established Hermes scripts test directory
- Modify: project documentation with the cron name, cadence, outputs, and failure rules

**Step 1: Write failing tests for change detection and redaction**

Cover:

- No repo mutation when generated history is unchanged.
- Build/deploy path only when tracked target files change.
- Provider errors are redacted.
- Primary data failure produces private attention output.
- Secondary spreadsheet failure does not block contract data.

**Step 2: Implement the deterministic refresh script**

Flow:

1. Fetch/reset safely to `origin/main` only when the working tree has no tracked pre-run edits.
2. Run the separately reviewed reconstruction/normalization step. V1 intentionally ships no unattended history writer; add one only after it has deterministic tests and source-integrity review.
3. Run `npm run test:bytes` and `npm run validate:bytes-history`.
4. Run `npm run build`.
5. If target files changed, push only approved files through the Grid Phantoms GitHub REST helper.
6. Deploy through the established Vercel path.
7. Verify the live API/page timestamp and current configured emission value.
8. Stay silent on unchanged success; send a concise private report on changes or failure.

**Step 3: Create a fixed-wall-clock no-agent cron**

Recommended cadence: daily history refresh. The live API handles 15-minute current metrics through CDN caching, so a deployment every 15 minutes is unnecessary.

**Step 4: Run a dry run and one controlled live refresh**

Verify no public Discord output and no secrets in stdout.

---

### Task 9: Full QA and production readiness review

**Objective:** Prove the terminal works before any public launch.

**Files:**
- Modify only files required by findings.

**Step 1: Run automated gates**

```bash
npm run test:bytes
npm run validate:bytes-history
npx eslint app/components/SiteNav.tsx app/bytes/page.tsx app/bytes/BytesDashboard.tsx app/bytes/EmissionsChart.tsx app/bytes/types.ts app/api/bytes-metrics/route.ts app/layout.tsx lib/bytes-model.mjs lib/bytes-api.mjs lib/bytes-contracts.ts lib/bytes-client-data.mjs scripts/validate-bytes-history.mjs test/*.test.mjs
npx tsc --noEmit
npm run build
git diff --check
```

Expected: the feature-scoped gates pass. Full-repository `npm run lint` has pre-existing failures in unrelated legacy files and is recorded separately rather than misrepresented as a BYTES release gate.

**Step 2: Run browser QA**

Viewports:

- 390×844 mobile
- 768×1024 tablet
- 1440×1000 desktop

Check:

- Navigation and mobile menu.
- No horizontal overflow.
- Large values do not clip.
- Chart remains legible.
- Projection badges are visible.
- Stale/partial states are understandable.
- Methodology links open safely.

**Step 3: Data reconciliation**

Compare:

- API configured emissions against direct contract reads.
- Supply and direct-balance fields remain unavailable/null unless canonical token identity and interface evidence have passed a separate source-verification gate.
- Pending/unclaimed rewards remain unavailable/null with the aggregate-indexer source gate unless independently verified aggregate claimable methodology exists.
- Historical tail against the current API.
- Per-point values against the Citizen spreadsheet as a nonblocking cross-check.
- Any displayed projection against an independent calculation.

**Step 4: Security and privacy review**

Verify:

- No RPC key in browser bundles, HTML, JSON, logs, or git diff.
- No raw provider diagnostics in public responses.
- No local paths in public UI.
- No unverified combined cross-chain supply.

**Step 5: Review exact diff**

```bash
git status --short
git diff --stat origin/main...HEAD
git diff origin/main...HEAD
```

**Step 6: Stop for Ktrap’s production approval**

Do not push/deploy the public route until Ktrap approves the final screenshots and launch copy.

---

## Acceptance criteria

- The headline emissions number is derived from the staking contract, not the curve or spreadsheet.
- Actual and modeled emissions are visibly distinct.
- Every projection states its reservoir and supply assumptions.
- The page can show partial/stale data without lying or collapsing.
- No private RPC credential reaches the client.
- Mobile, tablet, and desktop layouts pass visual inspection.
- Lint, build, model tests, history tests, and direct data reconciliation all pass.
- Public copy communicates scarcity mechanics conditionally, without guarantees or price targets.
