# Security Policy

ChronoNav handles privacy-sensitive user workflows, so security and transparency matter.

## Supported versions

Security fixes are handled on the latest public version of the extension.

## Reporting a vulnerability

If you find a security or privacy issue, please email:

hi@thebrownielab.com

Please include:

- A short description of the issue
- Steps to reproduce
- The affected browser and extension version
- Any relevant screenshots, logs, or proof of concept details

Please do not publicly disclose vulnerabilities before there has been a reasonable chance to investigate and fix them.

## Project security principles

- No analytics, ads, tracking, or developer-operated backend.
- No remote code. Runtime scripts ship inside the extension package.
- Narrow site access: the extension is scoped to `https://gemini.google.com/*`.
- Time Context is opt-in and off by default.
- Prompt-related behavior should remain visible in documentation and privacy disclosures.
