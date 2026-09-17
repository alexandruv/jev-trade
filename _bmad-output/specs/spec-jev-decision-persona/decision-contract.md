# Jev Decision Contract

This companion defines the boundary between TypeSafe Jev and application code. It is a contract for implementation and tests, not a prompt for unrestricted model behavior.

## Decision envelope

```ts
type JevDecision<T> = {
  decision: T | "abstain";
  confidence: number;
  rationale: string;
  risks: string[];
  invalidatedBy: string[];
  nextObservation?: string;
  expiresAt: string;
};
```

The validator must reject malformed values, confidence outside `[0, 1]`, expired decisions, unknown enum values, and decisions that conflict with current deterministic safety state.

## Initial decision classes

| Class | Candidate decisions | Required context |
|---|---|---|
| Trading posture | `buy`, `sell`, `hold`, `reduce`, `abstain` | Window summary, position, exposure, market state, prior posture |
| Market regime | `trending`, `ranging`, `volatile`, `illiquid`, `anomalous`, `unknown` | Recent observations, liquidity, volatility, execution quality |
| Risk response | `continue`, `de_risk`, `pause`, `stop` | Limits, drawdown, errors, slippage, current exposure |
| Research priority | Ranked hypotheses or data sources | Open questions, evidence quality, expected information value |
| Policy evaluation | `improved`, `unchanged`, `worsened`, `inconclusive` | Prior recommendation, realized result, risk-adjusted metrics |

## Mandatory behavior

- `abstain` and `unknown` are valid outcomes, not errors.
- Confidence is evidence about uncertainty, not permission to bypass a gate.
- Decisions must expire and must identify conditions that invalidate them.
- The application owns normalization, validation, persistence, and enforcement.
- The application must retain the last valid decision during a timeout or TypeSafe outage and record the failure.

## Prohibited behavior

Jev must not receive or emit credentials, directly invoke exchange APIs, alter risk limits, generate executable code, or make claims that a strategy is profitable without measured evidence.

