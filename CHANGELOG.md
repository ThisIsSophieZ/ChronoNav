# Changelog

All product changes and engineering-process changes are recorded here.
Entries under **Unreleased** are not yet shipped. Dates use Asia/Shanghai.

## Unreleased

### 2026-10-28 — First-message timestamp assignment

- **Fixed:** A message sent before the first timeline render can now receive its captured send time. Match the sent text against messages added after the send-time DOM baseline, instead of skipping all pending times during initialization.
- **Fixed:** Correct the timeline's obsolete DOM-hide helper call to the existing `hideSystemTimeInDom` function so the committed fix can render independently of other working-tree changes.
- **Safeguards:** Keep historical messages untimed without a trusted source; consume fallbacks for already-stamped messages; expire unmatched captures after 30 seconds; clear pending captures when Time Context is disabled; reject captures from other established conversations; handle the new-chat URL transition and repeated prompts.
- **Changed:** Lead the English extension description with timeline navigation and retain the optional, off-by-default Time Context explanation.
- **Engineering:** Establish repository-wide rules in `AGENTS.md`, the change-record workflow in `CONTRIBUTING.md`, and runtime release checks in `docs/release-checklist.md`.
- **Validation:** `node --test scripts/test-timeline-times.cjs` passes all 13 tests on the isolated commit snapshot. The same suite reproduces the original first-message failure on the pre-fix source. `node --check content.js` and `git diff --check` pass. The broader working tree also passes all 34 tests with `node --test scripts/test-timeline-times.cjs scripts/test-prompt-snapshot.cjs`; the pre-existing prompt-snapshot work is outside this commit, and its DOM mock was updated locally to support send-time message lookup.
- **Release status:** Browser smoke testing remains required before publication: reload the extension and Gemini, send three messages in a new chat with Time Context enabled, and check the first message before and after refreshing. Confirm the request or persisted message contains a time marker when investigating refresh-related loss.
- **Limitations:** The local fallback exists only in the current page session. Missing timestamps in old messages cannot be reconstructed. A fallback confirms local send capture, not successful network injection or server persistence.
- **Rollback:** Revert the fix commit and repeat the release checklist before distributing a rollback package.
