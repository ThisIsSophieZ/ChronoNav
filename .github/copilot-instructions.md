# Copilot instructions for ChronoNav

## Quick commands
- No build/test/lint scripts in this repo. This is a plain Chrome extension (MV3). To run locally:
  - Load unpacked extension: Chrome → chrome://extensions → Developer mode → Load unpacked → select repo root (contains manifest.json).
- Manual test: open https://gemini.google.com/ and verify sidebar TOC and that requests to Gemini include a leading `[System Time: YYYY-MM-DD HH:mm:ss]` in applicable request bodies.

## High-level architecture (big picture)
- manifest.json: MV3 config. Declares a content script (content.js) run_at=document_start, sidebar CSS, host_permissions for https://gemini.google.com/*, and inject.js as a web_accessible_resource.
- inject.js (main world): Injected into the page to intercept network calls. Overrides window.fetch and XMLHttpRequest to safely prepend a one-time time-anchor prefix to JSON/text/form bodies when appropriate. Contains URL filtering (shouldAugment), content-type checks, and a JSON-walking routine to find prompt strings and prepend the timestamp.
- content.js (isolated/content world): Injects the main-world script (inject.js) into the page, collects user-message DOM nodes, renders the right-side TOC (sidebar), syncs the last user prompt to the main world via a custom event (`chrono-nav-prompt-sync`), and provides user interactions (smooth scroll, highlight, collapsed/idle UI states).
- sidebar.css: all layout and visual conventions for #mate-sidebar and class patterns used by content.js for collapse/idle/active states.

## Key conventions and implementation patterns (repo-specific)
- Main vs. isolated worlds:
  - content.js runs in an isolated content script environment and communicates to inject.js via DOM events (custom event name: `chrono-nav-prompt-sync`). The main-world script (inject.js) holds the network interception logic.
- One-time prefixing:
  - inject.js maintains a per-request state (`state.done`) to ensure the timestamp prefix is inserted at most once per prompt/request.
  - The prefix format is exactly: `[System Time: YYYY-MM-DD HH:mm:ss]` (see formatPrefix()).
- Conservative augmentation:
  - Only augments requests that match shouldAugment(url) (primarily gemini.google.com or other generative endpoints).
  - Skips multipart/form-data and application/octet-stream to avoid breaking uploads/binaries.
  - Supports application/json, text/plain, application/x-www-form-urlencoded; JSON bodies are parsed, walked (walkJson), and mutated safely (WeakSet to avoid cycles).
- Header/content-type handling:
  - getHeaderValue() normalizes header structures (Headers, array pairs, plain objects) when checking content-type.
- DOM/CSS class/id conventions used by content.js and sidebar.css:
  - Root: #mate-sidebar
  - List container: .mate-list-container
  - TOC item: .chrono-nav-toc-item, .chrono-nav-toc-btn, .chrono-nav-toc-node
  - Collapsed/idle/active states: #mate-sidebar.is-collapsed, #mate-sidebar.is-idle, .toc-item.is-active
- Event syncing:
  - content.js dispatches `chrono-nav-prompt-sync` with { detail: { text: lastPrompt } } to let inject.js know the latest user prompt that should be matched for augmentation.
- Network patching details:
  - fetch override handles Request objects and string/url/init pairs; clones Requests as needed and only rewrites when augmentation occurs.
  - XMLHttpRequest overrides setRequestHeader to capture content-type and override send() to mutate textual bodies.
- Matching heuristics:
  - normalizeText() strips zero-width chars and collapses whitespace before comparing prompt text to request body to avoid false positives.

## Files of interest
- manifest.json — permissions and run_at
- inject.js — network interception, body augmentation logic
- content.js — UI (TOC), DOM scanning, event sync
- sidebar.css — UI visuals and state class names

## AI assistant/other helper configs
- No CLAUDE.md, .cursorrules, AGENTS.md, or other assistant rule files detected in repo root. Consult README.md for additional context included above.

---
If you'd like, configure an MCP server for running browser/playwright tests against the extension (e.g., Playwright to load the unpacked extension and exercise the UI/network flows).