# Changelog

## Unreleased

### 2026-10-28 — Gemini processSession time injection

- Confirmed in a live Chrome Web Store v1.0.0 session that Gemini now sends plain-text prompts to `geminiweb-pa.clients6.google.com/v1/processSession` as Base64-encoded protobuf. The old injector does not handle that endpoint; both a new-chat first message and a second message had no System Time in the outgoing prompt, and their temporary timeline times disappeared after refresh.
- Added a narrow XHR handler for the observed plain-text envelope. It prepends the existing System Time marker, updates protobuf lengths, and leaves unrelated, malformed, or mismatched requests unchanged. The marker position, settings, manifest, and permissions remain unchanged.
- Local validation: 5 focused tests pass, including UTF-8 length boundaries and unchanged-request guards; `node --check inject.js` and `git diff --check` pass. Browser validation of this candidate is pending.

### 2026-10-28 — P0 timeline label baseline

- Restored the verified P0-only label fix from the original qa-p0-2026-10-27 test package. Timeline labels read visible message lines without repeating Gemini's screen-reader heading.
- Kept the v1.0.0 System Time prefix, request interception, opt-in setting, manifest version, and permissions unchanged. This candidate does not include the later suffix, send snapshot, or route-handoff changes.
- Local validation: node --test scripts/test-p0-label.cjs passed 2/2 after reproducing both failures on v1.0.0; node --check content.js passed. The restored runtime files are being compared with the original P0 package.
- Browser validation of the P0-only package remains outstanding. Local Gemini connectivity recovered later on 2026-10-28.
- Known limitation: the original prefix may still appear in Gemini-generated conversation titles.
