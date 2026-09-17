import type { TradeState } from "./model";

export type JevPosture = "buy" | "sell" | "hold" | "reduce" | "abstain";

export interface RawJevDecision {
  choice: JevPosture;
  probabilities: Partial<Record<JevPosture, number>>;
}

export interface JevDecisionEnvelope {
  decisionClass: "trading_posture";
  posture: JevPosture;
  probabilities: Record<JevPosture, number>;
  confidence: number;
  rationale: string;
  invalidatedBy: string[];
  expiresAt: number;
  source: "typesafe" | "fallback";
  allowedSnapshot: { buy: boolean; sell: boolean };
}

export interface JevDecisionPolicy {
  minConfidence: number;
  ttlMs: number;
}

export interface JevDecisionProvider {
  advise(state: TradeState): Promise<RawJevDecision>;
}

export type JevDecisionResult =
  | { accepted: true; decision: JevDecisionEnvelope }
  | { accepted: false; reason: "in_flight" | "invalid" | "low_confidence" | "error" };

const POSTURES: JevPosture[] = ["buy", "sell", "hold", "reduce", "abstain"];

export function validateJevDecision(raw: unknown, now: number, policy: JevDecisionPolicy, allowedSnapshot = { buy: true, sell: true }): JevDecisionResult {
  if (!Number.isFinite(now) || !Number.isFinite(policy.ttlMs) || policy.ttlMs <= 0 || !Number.isFinite(policy.minConfidence) || policy.minConfidence < 0 || policy.minConfidence > 1) return { accepted: false, reason: "invalid" };
  if (!raw || typeof raw !== "object") return { accepted: false, reason: "invalid" };
  const candidate = raw as Partial<RawJevDecision>;
  if (!POSTURES.includes(candidate.choice as JevPosture) || !candidate.probabilities || typeof candidate.probabilities !== "object") return { accepted: false, reason: "invalid" };
  const unknownKey = Object.keys(candidate.probabilities).some((key) => !POSTURES.includes(key as JevPosture));
  if (unknownKey) return { accepted: false, reason: "invalid" };
  const probabilities = Object.fromEntries(POSTURES.map((key) => [key, candidate.probabilities![key] ?? 0])) as Record<JevPosture, number>;
  const values = Object.values(probabilities);
  if (values.some((value) => !Number.isFinite(value) || value < 0 || value > 1)) return { accepted: false, reason: "invalid" };
  const total = values.reduce((sum, value) => sum + value, 0);
  if (total <= 0 || Math.abs(total - 1) > 0.02) return { accepted: false, reason: "invalid" };
  const confidence = Math.max(...values);
  if (confidence < policy.minConfidence) return { accepted: false, reason: "low_confidence" };
  return {
    accepted: true,
    decision: {
      decisionClass: "trading_posture",
      posture: candidate.choice as JevPosture,
      probabilities,
      confidence,
      rationale: "TypeSafe Choice distribution concentration; not a correctness guarantee.",
      invalidatedBy: ["allowed-side change", "expiry"],
      expiresAt: now + policy.ttlMs,
      source: "typesafe",
      allowedSnapshot,
    },
  };
}

export class JevDecisionPersona {
  private currentDecision: JevDecisionEnvelope | null = null;
  private inFlight = false;

  constructor(private provider: JevDecisionProvider, private policy: JevDecisionPolicy) {}

  current(now = Date.now(), allowed?: { buy: boolean; sell: boolean }): JevDecisionEnvelope | null {
    if (!this.currentDecision || this.currentDecision.expiresAt <= now) return null;
    if (allowed && (allowed.buy !== this.currentDecision.allowedSnapshot.buy || allowed.sell !== this.currentDecision.allowedSnapshot.sell)) return null;
    return this.currentDecision;
  }

  async consult(state: TradeState, now?: number): Promise<JevDecisionResult> {
    if (this.inFlight) return { accepted: false, reason: "in_flight" };
    this.inFlight = true;
    try {
      const raw = await this.provider.advise(state);
      const evaluatedAt = now ?? Date.now();
      const result = validateJevDecision(raw, evaluatedAt, this.policy, state.allowed);
      if (result.accepted) this.currentDecision = result.decision;
      else if (result.reason !== "in_flight" && !this.current(evaluatedAt, state.allowed)) this.currentDecision = this.fallback(evaluatedAt, state.allowed);
      return result;
    } catch {
      this.currentDecision = this.fallback(now ?? Date.now(), state.allowed);
      return { accepted: false, reason: "error" };
    } finally {
      this.inFlight = false;
    }
  }

  private fallback(now: number, allowedSnapshot: { buy: boolean; sell: boolean }): JevDecisionEnvelope {
    return {
      decisionClass: "trading_posture",
      posture: "abstain",
      probabilities: { buy: 0, sell: 0, hold: 0, reduce: 0, abstain: 1 },
      confidence: 1,
      rationale: "Deterministic safe fallback after an unavailable or invalid TypeSafe decision.",
      invalidatedBy: ["next valid decision", "expiry"],
      expiresAt: now + this.policy.ttlMs,
      source: "fallback",
      allowedSnapshot,
    };
  }
}
