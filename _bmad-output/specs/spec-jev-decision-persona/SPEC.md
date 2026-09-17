---
id: SPEC-jev-decision-persona
companions:
  - decision-contract.md
  - interaction-architecture.md
sources: []
title: "Dedicated TypeSafe Jev decision persona"
type: feature
created: "2026-09-17"
status: draft
route: full
route_source: approved-user-direction
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

## Open Questions

- Which concrete TypeSafe response primitives should back the first production contract: `Choice`, typed fields, confidence, or a combination?
- What minimum confidence and expiry policy should be used for each decision class?

