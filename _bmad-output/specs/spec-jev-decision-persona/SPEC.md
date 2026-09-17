---
id: SPEC-jev-decision-persona
companions:
  - decision-contract.md
  - interaction-architecture.md
sources: []
title: "Dedicated TypeSafe Jev decision persona"
type: feature
created: "2026-09-17"
status: done
route: full
route_source: auto
baseline_commit: '045f940'
review: 'thorough'
review_source: auto
lenses_ran:
  - blind-hunter
  - edge-case-hunter
  - verification-gap
  - intent-alignment
review_loop_iteration: 0
github_issue: "https://github.com/alexandruv/jev-trade/issues/2"
github_project: "https://github.com/users/alexandruv/projects/3"
---

# Dedicated TypeSafe Jev Decision Persona

## Why

The project needs to use TypeSafe Jev for the decisions it is intended to make while keeping coding, documentation, order execution, and safety enforcement in deterministic or purpose-built components. A dedicated persona makes Jev’s authority, input/output contract, and interaction points explicit before implementation begins.

## Capabilities

- **CAP-1**
  - **intent:** The system can invoke Jev as a dedicated decision-intelligence persona through a future-proof TypeSafe provider alias.
  - **success:** Jev calls are distinguishable from other model calls and do not require changing persona configuration when TypeSafe changes its underlying model.
- **CAP-2**
  - **intent:** Jev can return a typed decision with confidence, rationale, risks, invalidation conditions, expiry, and an abstain outcome.
  - **success:** Invalid, stale, low-confidence, or abstaining decisions are rejected or safely handled by deterministic application logic.
- **CAP-3**
  - **intent:** Trading and BMad workflows can consult Jev at bounded decision boundaries and provide the resulting outcome back as state for later decisions.
  - **success:** The 300 ms trading path remains non-blocking, Jev is initially consulted at approximately three-second boundaries, and previous guidance remains active during errors or in-flight calls.
- **CAP-4**
  - **intent:** BMad personas can delegate decision questions to Jev without delegating implementation, documentation, credential handling, or irreversible actions.
  - **success:** Mary, John, Sally, Winston, Amelia, QA, and documentation workflows have explicit Jev consultation use cases and authority limits.

## Constraints

- Jev is used only for structured decision intelligence; it does not write source code or project documentation.
- Jev cannot place orders, mutate risk limits, access secrets, or bypass deterministic execution and safety gates.
- Jev calls must use typed outputs, support abstention, and pass deterministic validation before affecting application state.
- The hot trading loop must not wait synchronously for Jev; at most one bounded feedback request may be in flight per decision stream.
- The provider configuration must use a TypeSafe alias such as `system-one` or `typesafe-latest`, not an assumed underlying model identifier.
- Jev recommendations are guidance, not profitability guarantees; all outcomes must be observable and auditable.

- The first implementation will use the existing TypeSafe `Choice` primitive and derive the envelope confidence from the returned distribution's maximum probability. This is a concentration signal, not a correctness guarantee.
- The initial production decision class is trading posture; the other consultation classes remain typed extension points and are not required to change the current hot-loop action contract.

## Non-goals

- Building RLVR, reward-model training, automatic prompt search, or policy optimization.
- Allowing Jev to directly execute trades or change risk controls.
- Replacing deterministic risk checks, market-data handling, order encoding, or test assertions with model judgment.
- Assigning Jev responsibility for general-purpose coding, UX design, product documentation, or repository maintenance.

## Success signal

An operator can trace a Jev decision from structured input through typed output, validation, bounded application, and observed outcome. A TypeSafe outage, malformed response, low-confidence response, or stale response leaves the trader in a safe known posture without stalling the hot loop.

## Assumptions

- The TypeSafe SDK continues to support structured state and typed choice/decision responses as represented by the installed TypeSafe skill and SDK documentation.
- The initial Jev integration is advisory and supervisory; execution remains owned by existing application code.

## Code Map

- `src/model.ts` — owns `TradeState`, `Decision`, the `Model` interface, Jev's current TypeSafe `Choice` request, and the mock model. Reuse the existing model boundary; add a separate Jev decision envelope and keep the current `decide()` action contract intact.
- `src/trader.ts` — owns the per-block loop, history, totals, fills, positions, and emitted events. Reuse `BlockEvent`, totals, and existing risk gates; add only bounded supervisory consultation state and outcome recording outside the synchronous action path.
- `src/config.ts` — owns environment configuration. Reuse the existing TypeSafe model configuration and add only decision-persona cadence/history/threshold settings required by the contract.
- `src/index.ts` — owns model/trader wiring and logs. Reuse the existing event broadcast path; add concise Jev decision transition diagnostics without exposing prompts, keys, or raw credentials.
- `package.json` — Bun/TypeScript runtime with `@ai-sdk/typesafe-ai`; preserve the current SDK integration and add no new provider.
- No test suite currently exists for `src/`; add focused pure contract/validation tests using Bun's test runner before changing live execution behavior.

## Tasks & Acceptance

**Execution:**
- [x] Add a dedicated TypeSafe Jev decision-persona interface and typed envelope with choice, probability distribution, derived concentration confidence, rationale metadata, invalidation, expiry, and abstention handling.
- [x] Add deterministic validation and safe fallback behavior for malformed, stale, low-confidence, failed, or overlapping Jev decisions.
- [x] Add bounded supervisory consultation orchestration that can consume trading-window state without blocking the 300 ms action loop; preserve the last valid posture during in-flight requests.
- [x] Add configuration and observability for the decision persona without logging secrets or unbounded model state.
- [x] Add focused tests for valid, abstaining, malformed, expired, low-confidence, failed, and overlapping responses; preserve existing dry-run and execution gates.
- [x] Update project documentation with Jev's authority boundary, interaction map, and provider alias policy.

**Acceptance Criteria:**
- Given a valid TypeSafe Choice result, when Jev returns a decision, then application code receives a typed envelope with a bounded choice, probabilities, derived confidence, expiry, and invalidation conditions.
- Given an abstain, malformed, expired, low-confidence, failed, or overlapping result, when the caller evaluates it, then it uses the previous valid decision or deterministic safe default and records the fallback reason.
- Given the 300 ms trading loop, when a supervisory Jev consultation is started, then the next block read, action decision, risk gate, and order path do not wait for its completion.
- Given a Jev recommendation, when it reaches execution, then position caps, margin checks, order mechanics, and dry-run/live rules remain enforced by existing deterministic code.
- Given a TypeSafe provider/model change, when the configured alias changes, then persona wiring remains stable and no persona-specific underlying model name is required.
- Given tests and a dry-run process, when verification runs, then the new contract tests pass and no live order or secret is required.

## Implementation Notes

Use the installed TypeSafe integration's `Choice` answer and probability distribution as the first decision primitive. Keep rationale as bounded metadata supplied by application context rather than treating model-generated prose as an authority signal. The decision persona is supervisory; it must not replace the existing action model until a separate approved scope changes that contract.

## Verification

**Commands:**
- `bun test` — expected: new decision-contract tests and any existing tests pass.
- `MODEL=mock DRY_RUN=true bun run src/index.ts` — expected: the trader starts without credentials and keeps the action path operational.
- `bun run scripts/dry-encode.ts` — expected: existing order encoding assertions remain unchanged.

## Review Triage Log

| Lens | Finding | Verdict | Route / evidence |
|---|---|---|---|
| blind-hunter | Supervisory posture was only logged and not handed into later action state. | false | The final diff includes `supervisory` in `TradeState` and the action question explicitly consumes it on the next block. |
| blind-hunter | Invalidation metadata was not enforced. | patch | Added allowed-side snapshots and invalidation on allowed-side changes; expiry remains enforced. |
| blind-hunter | Fallback envelope was declared but unused. | patch | Invalid/error results now preserve a valid decision or install deterministic `abstain` fallback state. |
| blind-hunter | Policy values were not validated. | patch | Validator and config now enforce finite positive TTL, valid confidence, and positive cadence. |
| blind-hunter | Unknown probability keys could be silently discarded. | patch | Unknown distribution keys are rejected. |
| blind-hunter | Edge cases lacked tests. | patch | Added malformed object, invalid policy, expiry, error fallback, adapter-shape, and supervisory handoff tests. |
| blind-hunter | Production adapter cast SDK answers without shape validation. | patch | Added `toRawJevDecision` runtime validation before the contract validator. |
| blind-hunter | New environment values lacked range validation. | patch | Added bounded parsing and integer cadence normalization. |
| edge-case-hunter | Null or malformed raw input could throw. | patch | Runtime object and probability-shape guards return `invalid`. |
| edge-case-hunter | Invalid policy values could create unsafe behavior. | patch | Policy validation rejects invalid thresholds and TTLs. |
| edge-case-hunter | Selected posture was not guaranteed to be the highest probability. | false | TypeSafe Choice selection is the decision value; concentration is explicitly treated as uncertainty, not a requirement to recompute the selected choice. |
| edge-case-hunter | Provider latency could expire a decision on arrival. | patch | Production calls validate using response time; deterministic timestamps remain available for tests. |
| edge-case-hunter | Rejected results did not apply fallback state. | patch | The persona now retains the previous valid decision or installs abstention fallback. |
| edge-case-hunter | Declared invalidation conditions were metadata only. | patch | Allowed-side changes invalidate the active decision before state assembly. |
| verification-gap | Production TypeSafe adapter was untested. | patch | Added a production answer-shape mapping test and runtime parser. |
| verification-gap | Trader supervisory state handoff was untested. | patch | Added a focused two-block Trader integration test proving non-blocking consultation and next-state handoff. |
| intent-alignment | The implementation chose the bounded supervisory interpretation while preserving deterministic execution ownership. | accepted | This matches the approved persona contract and authority boundaries; no intent divergence requiring loopback was identified. |
