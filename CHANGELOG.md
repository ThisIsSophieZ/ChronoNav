# Changelog

## Unreleased

### 2026-10-29 — processSession envelope follow-up

- Release smoke testing reproduced an intermittent missing persisted time after consecutive Enter sends: messages 3–5 lost the label after refresh, while messages 1–2 and 6–7 retained it. The failing sends reached the `processSession` XHR without a body rewrite.
- Kept the existing opt-in setting, System Time prefix, and exact prompt match. The `processSession` parser now accepts optional protobuf sibling fields and preserves them byte-for-byte while changing only the matched prompt leaf and its enclosing lengths.
- A new-chat first send used a two-part `processSession` batch after a 21-second delay: `req0` contained metadata and the prompt was in `req1`. The injector now checks each request part, changes only a unique exact prompt match, and retains the send snapshot for up to 60 seconds.
- Local validation: 9 focused tests pass, including optional fields, a new-chat batch, duplicate-match rejection, and editor-clear timing.
- Browser validation: with the single unpacked v1.0.1 QA extension enabled, a new-chat first message sent by button and a second message sent by Enter both had persisted System Time after refresh, one visible timeline time each, and hidden marker text in the visible message. With Time Context off, a third message had no marker or timeline time after refresh; turning it back on restored the first two times. One sidebar was present and no extension console errors were observed. The optional-field parser was covered by a focused test; the observed new-chat failure was the `req1` batch and delayed send.

### 2026-10-28 — Enter send timing follow-up

- Release smoke testing found one same-tab Enter send (`CN-SMOKE-MANUAL-04`) without a persisted System Time marker, while the preceding button send (`CN-SMOKE-MANUAL-03`) persisted. The later browser retest is recorded in the 2026-10-29 entry above.
- Preserved the send-time prompt across the input editor clearing before the outbound `processSession` XHR starts. Matching remains exact and expires after 15 seconds; other request formats and the marker position are unchanged.
- Local validation at that stage: 6 focused tests passed, including the editor-clear-before-XHR sequence. Subsequent browser findings and the final retest are recorded above.

### 2026-10-28 — Gemini processSession time injection

- Confirmed in a live Chrome Web Store v1.0.0 session that Gemini now sends plain-text prompts to `geminiweb-pa.clients6.google.com/v1/processSession` as Base64-encoded protobuf. The old injector does not handle that endpoint; both a new-chat first message and a second message had no System Time in the outgoing prompt, and their temporary timeline times disappeared after refresh.
- Added a narrow XHR handler for the observed plain-text envelope. It prepends the existing System Time marker, updates protobuf lengths, and leaves unrelated, malformed, or mismatched requests unchanged. The marker position, settings, and permissions remain unchanged.
- Bumped the extension to v1.0.1 and restored the previously agreed English extension description, which introduces the timeline before the optional time context. The Chinese description was already aligned and remains unchanged.
- Local validation: 5 focused tests pass, including UTF-8 length boundaries and unchanged-request guards; `node --check inject.js` and `git diff --check` pass.
- Browser validation: in Chrome with the unpacked QA build, a new-chat first message sent with the button and a second message sent with Enter both carried System Time in the outgoing `/v1/processSession` request. After each refresh, the corresponding historical `user-query` retained the marker and the timeline time remained visible. The visible message hid the marker, timeline labels appeared once, and only one ChronoNav sidebar was present. The live send bubble initially lacked the marker; Gemini hydrated it from history on refresh.

### 2026-10-28 — P0 timeline label baseline

- Restored the verified P0-only label fix from the original qa-p0-2026-10-27 test package. Timeline labels read visible message lines without repeating Gemini's screen-reader heading.
- Kept the v1.0.0 System Time prefix, request interception, opt-in setting, manifest version, and permissions unchanged. This candidate does not include the later suffix, send snapshot, or route-handoff changes.
- Local validation: node --test scripts/test-p0-label.cjs passed 2/2 after reproducing both failures on v1.0.0; node --check content.js passed. The restored runtime files are being compared with the original P0 package.
- Browser validation of the P0-only package remains outstanding. Local Gemini connectivity recovered later on 2026-10-28.
- Known limitation: the original prefix may still appear in Gemini-generated conversation titles.
