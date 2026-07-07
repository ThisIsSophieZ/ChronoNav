# Contributing to ChronoNav

Thanks for helping improve ChronoNav. This project is intentionally small: no build step, no analytics, no remote code, and a very narrow permission surface.

## Local development

1. Clone the repository.
2. Open `chrome://extensions/` in Chrome.
3. Enable **Developer mode**.
4. Click **Load unpacked** and select the repository root containing `manifest.json`.
5. Refresh `https://gemini.google.com/`.
6. After each source change, click **Reload** on the extension card and refresh Gemini.

## Packaging

Build the Chrome Web Store ZIP with:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\package.ps1
```

The ZIP is written to `dist/`, which is intentionally ignored by Git.

## Contribution principles

- Keep the extension privacy-first: no analytics, no ads, no tracking, no developer server.
- Do not add remote code loading. All runtime JavaScript and CSS must ship inside the extension package.
- Keep permissions narrow. Avoid broad permissions such as `tabs`, `cookies`, or all-site access unless there is a clearly reviewed reason.
- Time Context must remain opt-in and off by default.
- Be explicit when changing anything that affects prompts, network requests, storage, or user-visible privacy behavior.
- Keep UI changes lightweight and compatible with Gemini's light and dark themes.

## Pull requests

Before opening a PR:

- Test by loading the unpacked extension locally.
- Verify the timeline still appears only on `gemini.google.com`.
- Verify Time Context remains off by default.
- If you changed packaging, run `scripts/package.ps1` and inspect the ZIP root.
- Update README, `PRIVACY.md`, or `docs/store-listing.md` if behavior or permissions changed.

## Reporting bugs

Please open an issue with:

- Chrome version
- Extension version
- Gemini page state where the bug appears
- Steps to reproduce
- Screenshots or screen recordings if useful

For private security or privacy reports, use [SECURITY.md](./SECURITY.md).
