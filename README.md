# jev-trader

One decision every Monad block. A TypeSafe Jev model watches the Kuru MON-USDC order book and answers buy or sell every ~300 ms. Every block posts a real post-only limit order on that side, one tick inside the touch, replacing the last one. Fills happen when a taker hits it, so the bot earns the spread instead of paying it. A small server streams every block to the dashboard.

## Run

    cp .env.example .env
    bun install
    bun run start

## Browser smoke check

Install a pinned Obscura release from the upstream
[release instructions](https://github.com/h4ckf0r0day/obscura/releases) separately;
application startup never downloads or launches it. Verify the installed
binary before running checks:

    OBSCURA_BIN=/path/to/obscura; "$OBSCURA_BIN" --version

With the web
dashboard running on localhost, run:

    OBSCURA_BIN=obscura BROWSER_URL=http://127.0.0.1:3000 bun run browser:check

The command explicitly enables private-network access, waits for the page to
settle, requests text output, and fails with a distinct message for a missing
binary, navigation failure, timeout, or empty page. Configure `OBSCURA_BIN`,
`BROWSER_URL`, `BROWSER_OUTPUT_DIR`, `BROWSER_WAIT`, and `BROWSER_TIMEOUT`.
Set `BROWSER_SCREENSHOT=dashboard.png` to write a PNG below the configured
output directory (the default `.obscura-artifacts/` is ignored by git):

    BROWSER_SCREENSHOT=dashboard.png BROWSER_URL=http://127.0.0.1:3000 bun run browser:check

Use Obscura for browser navigation, DOM/text extraction, screenshots, visual
checks, and supported CDP automation. Keep backend/API/RPC, trading, risk,
execution, and deterministic frontend build checks on their existing tools.
Stealth is opt-in and is not part of this smoke command.

With no `PRIVATE_KEY` it dry-runs: real book, real decisions, simulated fills. Set `MODEL=jev` and `TYPESAFE_AI_API_KEY` to use Jev; the default `mock` is a momentum heuristic stand-in.

When `MODEL=jev`, the dedicated Jev decision persona also evaluates a bounded trading posture every `JEV_DECISION_WINDOW_BLOCKS` blocks (default 10, about 3 seconds). This supervisory call is asynchronous and cannot bypass position caps, margin checks, order mechanics, or dry-run/live rules. Its typed Choice distribution is validated for confidence, expiry, and abstention before being placed in the next model state. Configure `JEV_DECISION_TTL_MS` and `JEV_DECISION_MIN_CONFIDENCE` as needed. `JEV_MODEL_ID` is a provider alias; do not depend on a TypeSafe model's underlying name.

## Endpoints

Deployed (dry run, mock model): https://jev-trader-production.up.railway.app

- `GET /` snapshot: model, wallet, dryRun, latest block event
- `GET /history` last 1000 block events
- `GET /events` SSE: `snapshot` on connect, then one `block` event per block, plus a `fill` event whenever a live order's receipt lands

Every event (see `src/trader.ts` for types):

    {
      "block": 105488269, "ts": 1789593630676,
      "mid": 0.022636, "bestBid": 0.022628, "bestAsk": 0.022644, "spreadBps": 7.07,
      "decision": { "action": "buy", "probabilities": { "buy": 0.77, "sell": 0.23, "hold": 0 }, "upIn10": 0.77, "latencyMs": 81, "late": false },
      "quote": { "side": "buy", "price": 0.022629, "size": 200, "txHash": "0x…", "gasMon": 0.0357, "cancel": [100295801], "status": "sent", "orderId": null, "capped": false },
      "fill": null,
      "resting": { "bidMon": 200, "askMon": 200 },
      "position": { "side": "short", "size": 200, "entryPrice": 0.022633, "unrealizedUsd": -0.0006, "unrealizedMon": -0.027 },
      "totals": { "blocks": 3, "decisions": 3, "quotes": 3, "fills": 1, "reverted": 0, "lateBlocks": 0, "jevUsd": 0.000004, "gasMon": 0.107, "gasUsd": 0.0024, "realizedUsd": 0, "pnlUsd": -0.003, "pnlMon": -0.13, "pnlPct": -0.003 }
    }

Every block the model is asked about the move over `HORIZON_BLOCKS` (default 100, ~30 s) and answers `buy` or `sell`. `quote` is the order that block put on the book: a post-only limit order of `TRADE_SIZE_MON` on that side, `QUOTE_INSIDE_TICKS` inside the touch (clamped to the touch when the spread is too tight), in one `batchUpdate` that also cancels everything we had resting (`cancel`). `hold` appears only with `decision.late: true`, when the model missed the block and nothing was posted. When the position cap (or, live, margin funds) blocks a side, the quote goes on the other side with `capped: true` and `probabilities` still show the model's call. `resting` is our size known to be on the book after this block. `upIn10` equals the buy probability.

Live sends are fired and forgotten, so the `block` event carries the **intent**: `status: "sent"`, `gasMon` is `gasLimit x (last known base fee + priority)`. Monad charges the gas limit, so that is the real cost whether the order lands or not. The receipt arrives a block or two later as its own SSE event:

    event: quote
    data: { "block": 105488269, "quote": { …, "status": "placed", "orderId": 100295812, "gasMon": 0.0357 } }

`status` becomes `placed` (with the order id) or `reverted` (the book moved through the price before the tx landed, or a cancelled order had already filled). No receipt after 10 blocks gives `lost`. Fills are not in our own transactions: someone else's taker order hits our resting one, and the Trade log for it arrives via the same `eth_getLogs` poll that feeds the model. Each block with fills gets its own SSE event, and `position`, `realizedUsd` and `fills` update then:

    event: fill
    data: { "block": 105488271, "fill": { "side": "buy", "size": 200, "price": 0.022629, "txHash": "0x…", "orderId": 100295812, "simulated": false } }

`txHash` is the taker's transaction. In a dry run the quote is `status: "sim"`: the order rests for one block and a real print crossing its price fills it (`simulated: true`).

## Layout

    src/config.ts   env
    src/chain.ts    block feed (WebSocket newHeads + polling backstop, newest block only), raw RPC
    src/book.ts     one-eth_call order book reader (decodes getL2Book, merges the AMM vault)
    src/market.ts   Kuru: read book, hand-encoded batchUpdate (cancel + post-only place), margin deposits, local nonce, async confirmation
    src/model.ts    Model interface, JevModel (AI SDK experimental_evaluate), MockModel
    src/jev.ts      TypeSafe Jev decision persona, typed envelope, validation, bounded in-flight guard
    src/trader.ts   the loop: one in flight, hold when late, position and P&L accounting, Jev supervision
    src/server.ts   Bun.serve: snapshot, history, SSE

## The 300 ms budget

A decision and an order have to fit in one block, so the hot loop makes exactly two RPC round trips:
one `eth_call` for the book (~18 ms on the public RPC, `READ_RPC_URL`) and one `eth_sendRawTransaction`
(`RPC_URL`), which returns as soon as the tx is accepted. Nothing else is on the path — no
`eth_estimateGas` (Monad charges gas on the limit, so the limit is hardcoded or derived once at
startup), no `eth_sendRawTransactionSync` (it blocks until the tx is Proposed), no gas price lookup
(static type-2 fees: `MAX_FEE_GWEI` cap, 2 gwei priority; the effective price is base + priority).
Receipts, the fee estimate and the vault check run off the hot path on later blocks. Measured in a
dry run with the mock model: read p50 18 ms, whole loop p50 100 ms (80 ms of it the mock's inference stand-in).

    bun run scripts/bench-read.ts     # book reader vs the SDK: exactness and latency
    bun run scripts/dry-encode.ts     # signs a buy and a sell offline, asserts the calldata matches the SDK
