---
title: 'Build and preview the current Jev Trader project'
type: 'chore'
created: '2026-09-17'
status: 'done'
route: 'oneshot'
route_source: 'auto'
review: 'quick'
review_source: 'auto'
lenses_ran: []
review_loop_iteration: 0
context: []
baseline_commit: '4f4bbce'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Confirm that the current Jev Trader project builds and can be viewed locally.

**Approach:** Install or reuse the existing Bun dependencies, run the applicable web build checks, start the dashboard locally, and verify a localhost URL responds.

</frozen-after-approval>

## Implementation Notes

This is a oneshot verification task: preserve the current product code unless a build or runtime failure requires a minimal corrective change. Keep the TypeSafe API key server-side and do not expose `.env` contents.

## Verification

**Commands:**
- `bun install` in `web/` -- expected: dependencies install successfully.
- `bun run build` in `web/` -- expected: Next.js production build succeeds.
- `curl` against the local dashboard -- expected: HTTP success and rendered app response.

## Review Triage Log

- No product-code changes were made. The production build passed TypeScript and Next.js compilation, and the running dashboard returned HTTP 200 with the expected page title.
