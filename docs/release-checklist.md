# Release Checklist

Use this checklist before making the repository public, submitting to the Chrome Web Store, or announcing ChronoNav.

## Before making the GitHub repository public

- [ ] Confirm `README.md` is English-first and links to `README.zh-CN.md`.
- [ ] Confirm `LICENSE`, `PRIVACY.md`, `CONTRIBUTING.md`, and `SECURITY.md` are present.
- [ ] Confirm contact email is `hi@thebrownielab.com`.
- [ ] Confirm `.gitignore` excludes `dist/` and local-only working logs.
- [ ] Confirm no secrets, API keys, personal tokens, or private notes are committed.
- [ ] Confirm GitHub repository description is concise and English.

Suggested repository description:

```text
A clean timeline navigator and optional time-context helper for long Gemini conversations.
```

Suggested topics:

```text
chrome-extension, gemini, productivity, timeline, privacy-first, mv3
```

## Before Chrome Web Store submission

- [ ] Review `CHANGELOG.md`: every shipped change has a record, validation evidence, and resolved release checks.
- [ ] Run relevant `scripts/test-*.cjs` regression tests and JavaScript syntax checks against the exact release commit. Record commands and results in `CHANGELOG.md`.
- [ ] Reload the unpacked extension and refresh Gemini. With Time Context enabled, send three messages in a new conversation using Enter and the send button; verify all three timeline times, including the first.
- [ ] Cover both event orders: the first message appears before the new-chat URL is finalized, and after it is finalized. Check replacement of the first message node and transient empty chat DOM states.
- [ ] Refresh and switch away/back to that conversation. Compare missing times with the original message time markers; distinguish missing injection/persistence from timeline rendering failure.
- [ ] Confirm untimed historical messages stay untimed, repeated prompts do not reuse another message's time, and disabling Time Context discards pending captures.
- [ ] Confirm timeline navigation works in light/dark themes and no extension errors appear. Record actual browser results; automated mocks alone do not satisfy this gate.
- [ ] Run `powershell -ExecutionPolicy Bypass -File .\scripts\package.ps1`.
- [ ] Confirm the ZIP has `manifest.json` at the root.
- [ ] Confirm `version` in `manifest.json` matches the release.
- [ ] Confirm Time Context is off by default.
- [ ] Confirm the extension only requests `storage` and `https://gemini.google.com/*`.
- [ ] Confirm `docs/store-listing.md` matches the dashboard copy.
- [ ] Confirm screenshots are 1280×800 or 640×400 and show actual product behavior.
- [ ] Confirm the privacy policy URL points to the public repository.
- [ ] Confirm Chrome Web Store contact email is verified: `hi@thebrownielab.com`.

## After Chrome Web Store approval

- [ ] Add the Chrome Web Store link to `README.md`.
- [ ] Create a GitHub release for the submitted version.
- [ ] Announce gradually: personal network first, then Reddit / Hacker News / Product Hunt if early feedback is healthy.
- [ ] Track issues manually through GitHub Issues; do not add analytics just for launch measurement.

## First-message diagnostic readout

For a dedicated test conversation, collect this read-only result immediately after
the first response, before sending a second message or refreshing:

```javascript
({
  timeline: JSON.parse(document.querySelector('#mate-sidebar')?.getAttribute('data-chrono-timing') || 'null'),
  requests: JSON.parse(document.documentElement.getAttribute('data-chrono-requests') || '[]')
})
```

- `sendsCaptured: 0` means no enabled, non-empty send was captured in this page session. Check `lastSendStatus` and the input/send event path.
- `snapshot: "none"` with `draftAvailable: false` means a rewritten request had no prompt source to match. An input draft can still match when no explicit send snapshot exists.
- `snapshot: "live"`, `candidateStrings > 0`, and `matched: false` mean the inspected strings did not equal the normalized prompt. Do not broaden matching without inspecting a sanitized structural reproduction.
- `matched: true` and `changed: true` mean the wrapper modified the body passed to the network API, not that the server accepted or persisted it.
- `skipped` identifies disabled injection, an unsupported content type, or an unsupported/missing body. No report can also mean that traffic bypassed these wrappers; do not infer success from an empty list.
- `pendingMatched` and `lastMatchedIndex` show local time assignment. `routeTransfers` shows a first-message handoff to the finalized conversation route.
- The request list retains the latest 20 structural reports only. These diagnostics contain no prompt, token, full URL, or chat ID, and reset when the page reloads. Do not attach complete request bodies or private chat content.
