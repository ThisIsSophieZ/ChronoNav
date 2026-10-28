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

- [ ] Run `powershell -ExecutionPolicy Bypass -File .\scripts\package.ps1`.
- [ ] Confirm the ZIP has `manifest.json` at the root.
- [ ] Confirm `version` in `manifest.json` matches the release.
- [ ] Confirm Time Context is off by default.
- [ ] Confirm the extension only requests `storage` and `https://gemini.google.com/*`.
- [ ] Confirm `docs/store-listing.md` matches the dashboard copy.
- [ ] Replace any unqualified "no external servers" claim in the live listing with the precise opt-in Gemini request disclosure in `docs/store-listing.md`.
- [ ] Confirm screenshots are 1280×800 or 640×400 and show actual product behavior.
- [ ] Confirm the privacy policy URL points to the public repository.
- [ ] Confirm the linked public `PRIVACY.md` contains the v1.0.1 disclosure and updated date.
- [ ] Confirm Chrome Web Store contact email is verified: `hi@thebrownielab.com`.

## After Chrome Web Store approval

- [ ] Add the Chrome Web Store link to `README.md`.
- [ ] Create a GitHub release for the submitted version.
- [ ] Announce gradually: personal network first, then Reddit / Hacker News / Product Hunt if early feedback is healthy.
- [ ] Track issues manually through GitHub Issues; do not add analytics just for launch measurement.
