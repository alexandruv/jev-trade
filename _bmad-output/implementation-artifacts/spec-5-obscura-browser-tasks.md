---
title: 'Use Obscura for browser-related project tasks'
type: 'feature'
created: '2026-09-17'
status: 'done'
baseline_commit: '8bd9508'
review: 'thorough'
review_source: 'auto'
lenses_ran:
  - blind-hunter
  - edge-case-hunter
  - verification-gap
  - intent-alignment
review_loop_iteration: 0
route: 'full'
route_source: 'auto'
github_issue: 'https://github.com/alexandruv/jev-trade/issues/5'
github_project: 'https://github.com/users/alexandruv/projects/3'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

Adopt and use [Obscura](https://github.com/h4ckf0r0day/obscura) for browser-related tasks in this repository where it is a good fit. Make the choice operational for local dashboard validation and future browser automation while keeping non-browser work on its existing tools.

## Boundaries & Constraints

**Always:** Use Obscura for browser navigation, DOM/text extraction, screenshots, visual checks, and CDP-driven browser automation when its supported surface is sufficient. Keep the binary external to the application runtime and make its path configurable. Require explicit private-network access for localhost checks. Keep backend/API/RPC checks separate from browser checks.

**Never:** Do not add Obscura to the trading process or production frontend bundle. Do not silently download a browser binary during application startup. Do not enable stealth mode by default or use it to evade access controls. Do not treat a screenshot or browser result as a substitute for deterministic API, risk, or execution tests.

</frozen-after-approval>

## Why

Browser validation is currently ad hoc even though the project has a live Next.js dashboard. A repository-owned Obscura workflow will make localhost smoke checks, screenshots, and future browser automation repeatable while preserving the lightweight application runtime and existing deterministic test layers.

## Capabilities

- **CAP-1**
  - **intent:** The repository provides the Obscura agent skill and a documented policy for choosing Obscura for browser work.
  - **success:** A fresh agent can discover the skill, understand when to use Obscura, and know when to retain API/RPC or existing tools.
- **CAP-2**
  - **intent:** A developer can validate a running local dashboard through Obscura using a single repository command.
  - **success:** The command navigates to a configurable localhost URL, returns a non-empty page signal, and exits nonzero with actionable guidance when Obscura or the target is unavailable.
- **CAP-3**
  - **intent:** A developer can capture a deterministic Obscura screenshot for browser-facing review without changing application code.
  - **success:** A configured output path contains a non-empty PNG after a successful check, and private-network access is explicit.
- **CAP-4**
  - **intent:** Browser checks can be reused in future BMAD verification without coupling them to a specific machine or binary location.
  - **success:** The binary, URL, output directory, wait policy, and timeout are environment-configurable and documented.

## Constraints

- The first integration targets the existing `web/` dashboard and local HTTP server only.
- Obscura is an external executable selected through `OBSCURA_BIN`; it is not bundled into Bun, Next.js, or the trading backend.
- Browser checks must be deterministic enough for smoke validation and must report navigation, empty output, timeout, and missing-binary failures distinctly.
- Screenshots and generated browser artifacts must remain ignored or be written to an explicit temporary/artifact directory.
- Stealth remains opt-in and requires a separate explicit command or environment setting.

## Non-goals

- Rewriting the frontend or backend around Obscura.
- Replacing Bun tests, Next.js builds, RPC checks, or exchange/execution verification.
- Adding hosted scraping, proxy rotation, CAPTCHA handling, login automation, or anti-bot evasion.
- Claiming Chromium-level rendering parity for every CSS/Web API feature.

## Success signal

From a clean checkout with a dashboard running, one documented command uses Obscura to verify the local page and optionally capture a screenshot. The same command fails clearly and safely when the binary or dashboard is missing, without affecting the trader or exposing credentials.

## Assumptions

- Obscura's current CLI supports `fetch`, `--dump text`, `--screenshot`, configurable timeouts, and `--allow-private-network` as documented by the upstream project.
- The project will initially require developers or CI environments to install Obscura separately rather than downloading it automatically.

## Code Map

- `.agents/skills/obscura/SKILL.md` and `skills-lock.json` — install and pin the upstream Obscura guidance for agents.
- `scripts/obscura-check.ts` — new repository command that validates a target URL and optionally captures a screenshot through the configured Obscura binary.
- `package.json` — add the root `browser:check` script without changing trading startup behavior.
- `web/README.md` or root `README.md` — document installation/prerequisites, localhost invocation, environment variables, artifact handling, and browser-tool selection policy.
- `.gitignore` — ignore generated Obscura screenshots/artifacts if the chosen output defaults inside the workspace.

## Tasks & Acceptance

**Execution:**
- [x] Install/pin the upstream Obscura skill using the repository's skill tooling.
- [x] Add the configurable Obscura browser-check command with private-network opt-in, timeout, wait, text-output validation, and optional screenshot capture.
- [x] Add package and documentation entry points with examples for the Next.js dashboard.
- [x] Add focused tests or fixture-level checks for argument construction, missing binary, failed navigation, empty output, and successful output handling.
- [x] Verify the dashboard build remains unchanged; the real Obscura check was attempted and correctly reported the unavailable external binary.

**Acceptance Criteria:**
- Given `OBSCURA_BIN`, `BROWSER_URL`, and a running local dashboard, when `browser:check` runs, then it returns success only after Obscura obtains non-empty page content.
- Given a localhost URL, when the check runs, then private-network permission is explicit and no production/network credentials are required.
- Given `BROWSER_SCREENSHOT`, when the check succeeds, then a non-empty PNG is written to the requested path.
- Given a missing binary, unreachable URL, timeout, or empty page, when the check runs, then it exits nonzero with a distinct actionable message.
- Given ordinary backend, RPC, or trading verification, when a developer chooses a tool, then the documented policy keeps those checks out of Obscura.
- Given a clean web build, when the browser workflow is installed or unavailable, then the frontend build and trader startup behavior remain unchanged.

## Verification

**Commands:**
- `bun run --cwd web build` — expected: existing dashboard production build passes.
- `bun test` — expected: browser-check unit/fixture tests pass.
- `BROWSER_URL=http://127.0.0.1:3000 bun run browser:check` — expected: successful Obscura smoke check when the dashboard and binary are available.
- `BROWSER_SCREENSHOT=/tmp/jev-obscura/dashboard.png BROWSER_URL=http://127.0.0.1:3000 bun run browser:check` — expected: successful check and non-empty PNG when the dashboard and binary are available.

## Review Triage Log

- `blind-hunter`: medium — stale screenshot artifacts could produce false success; patched by deleting the expected artifact before each run and checking the newly produced PNG.
- `blind-hunter`: medium — arbitrary screenshot bytes could satisfy the non-empty check; patched with PNG signature validation and focused invalid-PNG coverage.
- `blind-hunter`: medium — arbitrary URLs combined with private-network permission widened the default workflow; patched by requiring explicit `BROWSER_ALLOW_EXTERNAL=true` for non-local targets.
- `blind-hunter`: low — README lacked a reproducible Obscura installation/version check; patched with upstream release guidance and `--version` verification.
- `blind-hunter`: low — test screenshot artifacts were not cleaned up; rejected as a low-impact test-only hygiene issue unlikely to affect ordinary users.
- `blind-hunter`: maybe-false — custom injected runners cannot be cancelled by the timeout wrapper; deferred because production uses the process runner, which kills its child, and proving a generic cancellation contract requires a broader API change.
- `edge-case-hunter`: medium — screenshot traversal or absolute paths could escape the configured artifact directory; patched with containment validation.
- `edge-case-hunter`: medium — malformed or missing screenshot output lacked negative coverage; patched with stale/missing/invalid screenshot assertions.
- `edge-case-hunter`: low — unusually large timeout values could overflow millisecond conversion; rejected because this is an impractical configuration edge with no demonstrated everyday impact.
- `edge-case-hunter`: false — timeout errors from the production process runner are distinct; the cited concern applied only to a hypothetical custom runner result, while the real runner raises its own timeout error before result classification.
- `verification-gap`: medium — the default subprocess path was untested; patched with a real Bun subprocess fixture and timeout-safe pipe consumption.
- `verification-gap`: medium — screenshot validation lacked a failing-case test; patched with missing and invalid screenshot cases.
- `intent-alignment`: false — the absence of full CDP/visual automation is a documented future surface, while this issue's accepted success signal is the local dashboard smoke-check foundation.
