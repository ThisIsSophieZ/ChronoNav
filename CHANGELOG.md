# Changelog

## Unreleased

### 2026-10-28 — P0 timeline label baseline

- Restored the verified P0-only label fix from the original qa-p0-2026-10-27 test package. Timeline labels read visible message lines without repeating Gemini's screen-reader heading.
- Kept the v1.0.0 System Time prefix, request interception, opt-in setting, manifest version, and permissions unchanged. This candidate does not include the later suffix, send snapshot, or route-handoff changes.
- Local validation: node --test scripts/test-p0-label.cjs passed 2/2 after reproducing both failures on v1.0.0; node --check content.js passed. The restored runtime files are being compared with the original P0 package.
- Browser validation remains outstanding. Local Gemini currently returns "Something went wrong (1)", so no send or refresh result is claimed for this branch.
- Known limitation: the original prefix may still appear in Gemini-generated conversation titles.
