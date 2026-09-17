# Jev Interaction Architecture

## Runtime boundary

```text
Trading loop or BMad persona
        -> structured state
        -> TypeSafe Jev decision call
        -> typed decision envelope
        -> deterministic validator
        -> bounded application of guidance
        -> observed outcome returned on the next call
```

The 300 ms trading path remains local. The first feedback integration consults Jev at a completed window boundary, initially about every three seconds. One request may be in flight; later boundaries retain the last valid posture until a new valid result arrives.

## BMad consultation map

| Persona/workflow | Jev consultation | Jev does not own |
|---|---|---|
| Mary / analyst | Rank assumptions, evidence gaps, and research priorities | Source verification or final research prose |
| John / PM | Rank options and clarify decision criteria | Product approval or roadmap ownership |
| Sally / UX | Evaluate user-flow alternatives and risks | Final visual design files |
| Winston / architect | Compare bounded architecture alternatives | Architecture authority or code changes |
| Amelia / developer | Request typed edge-case and implementation decision matrices | Source-code edits or commits |
| QA / review | Classify failures and prioritize investigation | Test verdicts or release gates |
| Documentation | Identify missing decisions and reader risks | Writing or publishing documentation |
| Trading loop | Recommend posture, regime, risk response, or abstention | Order placement, risk-limit mutation, and execution |

## Failure and fallback policy

On timeout, malformed output, provider error, overlap, expiry, or insufficient confidence, the caller records a diagnostic and uses the last valid posture or a deterministic safe default. No caller may turn an absent Jev response into an implicit approval.

## Observability

Each call should be traceable by decision class, input-window identifier, request start/end, response validity, confidence, selected decision, fallback reason, and realized outcome. Secrets and raw credentials must never enter the trace.

