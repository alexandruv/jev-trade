---
title: 'Add bounded feedback steering to the Jev trading loop'
type: 'feature'
created: '2026-09-17'
status: 'draft'
route: 'full'
route_source: 'auto'
review: ''
review_source: ''
lenses_ran: []
review_loop_iteration: 0
context: []
baseline_commit: '4a394b6'
github_issue: 'https://github.com/alexandruv/jev-trade/issues/1'
github_project: 'https://github.com/users/alexandruv/projects/3'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** The trader currently makes independent block-level decisions, so a run of trades cannot inform the next run. It needs a bounded adaptation cycle that uses recent execution results without slowing the roughly 300 ms decision path or claiming that adaptation guarantees profitability.

**Approach:** Add a rolling feedback window, defaulting to 10 blocks (about 3 seconds), that summarizes decisions, fills, latency, action mix, and P&L changes. At each boundary, ask Jev for one typed next-window trading posture and pass that posture as named state into subsequent decisions; keep the previous posture if the feedback request fails or is still in flight.

## Boundaries & Constraints

**Always:** Keep the hot block loop non-blocking with at most one feedback request in flight. Keep position caps, margin checks, order size, quote mechanics, and dry-run/live execution rules unchanged. Make the window size and retained feedback history configurable, with defaults of 10 blocks and 10 summaries. Treat feedback as contextual guidance, expose uncertainty, and retain the current guidance on errors.

**Never:** Do not add RLVR, policy search, reward-model training, automatic instruction generation, or a profitability claim in this change. Do not let feedback bypass risk gates or turn a failed/uncertain feedback request into a new trade rule. Do not expose the API key or send credentials to the client.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Window closes | 10 completed block events with available totals | One summary is produced and one feedback evaluation is started; the next blocks keep running | No blocking of the block decision; retain prior guidance until a result arrives |
| Feedback succeeds | Summary plus prior posture | Typed posture, probabilities, confidence, and guidance become the next `TradeState.feedback` | Apply only the returned bounded posture |
| Feedback fails or overlaps | API error, timeout, or an existing request | Trading continues with the previous posture and a logged diagnostic | Never throw from or stall `onBlock` |
| Sparse/late window | Fewer than 10 events or delayed fills | No premature adaptation; late blocks and available P&L remain represented | Wait for the next complete window; use only observed values |

</frozen-after-approval>

## Code Map

- `src/trader.ts` -- owns the per-block hot loop, event history, fills, totals, and the state assembled for the model; add window collection and non-blocking feedback orchestration here.
- `src/model.ts` -- owns the `TradeState`, Jev Choice question, MockModel, and `Model` interface; add bounded feedback summary/context types and a typed adaptation method without changing the existing action contract.
- `src/config.ts` -- central environment configuration; add feedback window size and retained-window settings.
- `src/index.ts` -- current logging and model/trader wiring; surface feedback transitions without changing execution semantics.
- `package.json` / Bun test files -- existing Bun/TypeScript test surface; add focused pure-summary tests and run the project checks with Bun.

## Tasks & Acceptance

**Execution:**
- [ ] Add typed feedback summary/posture models and a Jev Choice adaptation request in `src/model.ts`, with a deterministic MockModel fallback.
- [ ] Add window aggregation, bounded request scheduling, stale-result/error fallback, and feedback injection into `src/trader.ts`.
- [ ] Add configurable `FEEDBACK_WINDOW_BLOCKS` and `FEEDBACK_HISTORY_WINDOWS` defaults in `src/config.ts` and concise transition logging in `src/index.ts`.
- [ ] Add unit coverage for complete, sparse, and failed-feedback summaries using Bun’s test runner.
- [ ] Update `README.md` with the cadence, safety boundaries, and non-guarantee that feedback does not prove profitability.

**Acceptance Criteria:**
- Given a running trader, when 10 block events complete, then one feedback evaluation is launched without delaying the next block’s book read, decision, or order path.
- Given a successful typed feedback response, when the next decision is assembled, then the response’s bounded posture and confidence are present in the named model state.
- Given a failed, slow, or overlapping feedback request, when the next block arrives, then the trader continues with the last known posture and the block event still completes.
- Given live or dry-run execution, when feedback changes, then position caps, margin checks, trade size, and quote placement behavior remain enforced exactly as before.
- Given a fresh process with no prior guidance, when the first window is incomplete, then no feedback request is made and the existing model behavior is preserved.

## Implementation Notes

Use TypeSafe Choice probabilities and confidence for a small closed set of postures. The feedback request is an asynchronous supervisory signal, not a second blocking decision in the 300 ms loop. The split RLVR work is recorded in `deferred-work.md`.

## Spec Change Log

## Review Triage Log

## Design Notes

The first implementation should retain the latest 10 summaries as compact state rather than growing the prompt indefinitely. A posture can change model context, but it must not directly mutate risk limits or order mechanics; this preserves the existing safety envelope while making adaptation observable and testable.

## Verification

**Commands:**
- `bun test` -- expected: feedback aggregation and existing tests pass.
- `bun run src/index.ts` with `MODEL=mock` and no `PRIVATE_KEY` -- expected: dry-run starts and logs feedback boundaries without sending live orders.
- `bun run scripts/dry-encode.ts` -- expected: existing order encoding assertions still pass.
- `bun run scripts/bench-read.ts` -- expected: existing book-reader benchmark remains executable; feedback work does not enter the read hot path.
