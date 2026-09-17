import { describe, expect, test } from "bun:test";
import { JevDecisionPersona, validateJevDecision, type RawJevDecision } from "./jev";
import { toRawJevDecision } from "./model";
import { config } from "./config";
import { Trader } from "./trader";

const valid: RawJevDecision = { choice: "buy", probabilities: { buy: 0.7, sell: 0.1, hold: 0.05, reduce: 0.05, abstain: 0.1 } };

describe("Jev decision contract", () => {
  test("accepts a typed choice and derives concentration confidence", () => {
    const result = validateJevDecision(valid, 1000, { minConfidence: 0.6, ttlMs: 5000 });
    expect(result.accepted).toBe(true);
    if (result.accepted) {
      expect(result.decision.posture).toBe("buy");
      expect(result.decision.confidence).toBe(0.7);
      expect(result.decision.expiresAt).toBe(6000);
    }
  });

  test("preserves abstention as a valid decision", () => {
    const result = validateJevDecision({ choice: "abstain", probabilities: { abstain: 0.8, buy: 0.05, sell: 0.05, hold: 0.05, reduce: 0.05 } }, 1000, { minConfidence: 0.6, ttlMs: 5000 });
    expect(result.accepted).toBe(true);
    if (result.accepted) expect(result.decision.posture).toBe("abstain");
  });

  test("rejects malformed and low-confidence responses", () => {
    expect(validateJevDecision({ choice: "buy", probabilities: { buy: 2 } }, 0, { minConfidence: 0, ttlMs: 1 })).toEqual({ accepted: false, reason: "invalid" });
    expect(validateJevDecision({ choice: "buy", probabilities: { buy: 0.25, sell: 0.25, hold: 0.2, reduce: 0.15, abstain: 0.15 } }, 0, { minConfidence: 0.5, ttlMs: 1 })).toEqual({ accepted: false, reason: "low_confidence" });
  });

  test("rejects malformed objects, unknown probability keys, and invalid policy", () => {
    expect(validateJevDecision(null, 0, { minConfidence: 0, ttlMs: 1 })).toEqual({ accepted: false, reason: "invalid" });
    expect(validateJevDecision({ choice: "buy", probabilities: { buy: 0.7, sell: 0.2, nonsense: 0.1 } }, 0, { minConfidence: 0, ttlMs: 1 })).toEqual({ accepted: false, reason: "invalid" });
    expect(validateJevDecision(valid, 0, { minConfidence: 2, ttlMs: 1 })).toEqual({ accepted: false, reason: "invalid" });
  });

  test("maps the production TypeSafe answer shape", () => {
    expect(toRawJevDecision({ choice: "sell", probabilities: { sell: 0.8, buy: 0.2 } })).toEqual({ choice: "sell", probabilities: { sell: 0.8, buy: 0.2 } });
    expect(() => toRawJevDecision({ choice: "sell" })).toThrow();
  });

  test("allows only one request in flight", async () => {
    let release!: (value: RawJevDecision) => void;
    const persona = new JevDecisionPersona({ advise: () => new Promise((resolve) => { release = resolve; }) }, { minConfidence: 0.5, ttlMs: 5000 });
    const first = persona.consult({} as never, 0);
    expect(await persona.consult({} as never, 0)).toEqual({ accepted: false, reason: "in_flight" });
    release(valid);
    expect((await first).accepted).toBe(true);
  });

  test("keeps a valid decision until expiry and falls back to abstain after an error", async () => {
    let fail = false;
    const persona = new JevDecisionPersona({ advise: async () => { if (fail) throw new Error("offline"); return valid; } }, { minConfidence: 0.5, ttlMs: 100 });
    expect((await persona.consult({ allowed: { buy: true, sell: true } } as never, 0)).accepted).toBe(true);
    expect(persona.current(50, { buy: true, sell: true })?.posture).toBe("buy");
    expect(persona.current(101, { buy: true, sell: true })).toBeNull();
    fail = true;
    expect((await persona.consult({ allowed: { buy: true, sell: true } } as never, 200)).accepted).toBe(false);
    expect(persona.current(201, { buy: true, sell: true })?.source).toBe("fallback");
  });

  test("hands accepted supervisory guidance to the next block without awaiting it", async () => {
    const originalWindow = config.jevDecisionWindowBlocks;
    config.jevDecisionWindowBlocks = 1;
    const states: any[] = [];
    const book = { block: 1, bid: 1, ask: 1.01, mid: 1.005, spreadBps: 99.5, imbalance: 0, levels: { bids: [], asks: [] }, depthBps: {} };
    const market = {
      wallet: null,
      margin: { mon: 0, usdc: 0 },
      readBook: async () => book,
      send: async (_block: number, side: "buy" | "sell", size: number, _book: unknown, cancel: number[], capped: boolean) => ({ side, price: side === "buy" ? 1 : 1.01, size, txHash: null, gasMon: 0, cancel, status: "sim" as const, orderId: null, capped }),
      pollPending: async () => [],
      refresh: async () => {},
      address: null,
    };
    const persona = new JevDecisionPersona({ advise: async () => valid }, { minConfidence: 0.5, ttlMs: 5000 });
    const model = { name: "test", decide: async (state: any) => { states.push(state); return { action: "buy" as const, probabilities: { buy: 1, sell: 0, hold: 0 }, upIn10: 1, latencyMs: 0, inputTokens: 0 }; } };
    const trader = new Trader(market as never, model, () => {}, () => {}, () => {}, persona);
    await trader.onBlock(1);
    await Bun.sleep(0);
    await trader.onBlock(2);
    config.jevDecisionWindowBlocks = originalWindow;
    expect(states[1].supervisory?.posture).toBe("buy");
  });
});
