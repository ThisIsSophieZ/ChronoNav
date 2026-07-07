# ⏱️ ChronoNav — Timeline for Gemini

[简体中文](./README.zh-CN.md) · **English**

> Give Gemini real time awareness, and navigate long conversations through a one-click timeline.

ChronoNav is a lightweight Chrome extension for the [Gemini web app](https://gemini.google.com/) that does two things:

1. **Time context (optional, off by default)** — when enabled, it adds your local time and UTC offset before your prompt is sent to Gemini, so the model can reason about "how long ago" something happened and "what time it is now."
2. **Conversation timeline (Timeline TOC)** — a "subway-map" of colored nodes on the right edge of the page; click any node to smooth-scroll to that message.

ChronoNav is an independent extension and is not affiliated with, endorsed by, or sponsored by Google or Gemini.

---

## 💡 Why build it

LLMs are smart but usually lack a real sense of time. In long-running tasks this creates subtle disconnects: the model can't reliably order "the error half an hour ago," "last night's plan," and "the current state." And once a chat runs dozens of turns deep, scrolling back to find earlier context simply doesn't scale.

ChronoNav tackles both: **it adds temporal context under the hood, and reshapes how you navigate long conversations at the UI layer.**

---

## ✨ Core Features

### ⏳ Time Context

- **Off by default, opt-in**: informed consent first — it never silently modifies your prompts.
- **One switch, two entry points**: the extension popup, or the clock icon at the top of the sidebar (lit = on, gray = off).
- **Choose precision**: minute (default, `[System Time: 2026-06-18 21:34 +08:00]`, gentler on privacy) or second (`…21:34:12…`, better for log triage).
- **Minimal data**: only a timestamp + numeric UTC offset — **no IANA city name, location, account, or device info**.
- **Off means clean**: turning it off stops injection and hides every time in the sidebar (including historical parsed ones), leaving only nodes and text; toggle back on and times reappear.
- **Transparent, not "invisible"**: the extension keeps the time prefix hidden in the page UI to reduce visual clutter. The timestamp remains part of the prompt context sent to Gemini, and a first-run notice makes this explicit.

### 🗺️ Interactive Timeline TOC

- A timeline of colored nodes is generated automatically on the right; click any node to smooth-scroll to that message.
- Active item tracking: as you scroll the main page, the sidebar highlights and centers the message currently in view.

### 🖱️ Step-by-Step Navigation

- Minimalist up/down arrows at both ends let you jump one message at a time — no scroll-wheel fatigue.

### 🎨 Restrained, Unobtrusive UI

- Follows Gemini's native light/dark themes.
- Idle state: when the cursor leaves, the sidebar collapses into a minimal column of colored dots pinned to the right edge; hover to expand smoothly.

### ⌨️ Accessibility

- The sidebar is a navigation landmark (`role="navigation"`); items and arrows carry readable names (`aria-label`).
- Keyboard friendly: the idle state expands when focus enters the sidebar.

---

## 🛡️ Data Safety (Zero Tracking)

- **No developer data collection**: no analytics, no tracking, no ads, nothing sent to the developer.
- **Off by default & transparent**: time context is disabled until you opt in; it isn't dressed up as "fully invisible / risk-free."
- **Minimal requests**: when enabled, only the timestamp and a numeric UTC offset are added locally before your prompt is sent to `gemini.google.com`; nothing is sent to any server other than Gemini itself. Be aware this time does go to Google and may be stored by it.
- **Restrained permissions**: a content script runs only on `gemini.google.com` to read the page DOM, plus the non-sensitive `storage` permission to save local preferences (toggle / precision); no `tabs`, `cookies`, or sync `storage`.

See the [privacy policy](./PRIVACY.md) for details.

---

## 🚀 Install & Use

### Load in Developer Mode

1. Clone or download this repository.
2. Open `chrome://extensions/` in Chrome.
3. Enable **Developer mode** (top-right).
4. Click **Load unpacked** and select the project root containing `manifest.json`.
5. Refresh the [Gemini web app](https://gemini.google.com/) — the timeline outline appears on the right.

> Time context is **off by default**. Turn it on from the popup or the clock at the top of the sidebar when you need it.

### Build a store ZIP

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\package.ps1
```

The script packages only runtime files (`manifest.json`, `content.js`, `inject.js`, `sidebar.css`, `popup.*`, `icons/`, `_locales/`) into `dist/`, with `manifest.json` at the ZIP root as required by the Chrome Web Store.

---

## 📁 Architecture & Development

A minimal architecture with zero build step:

| File | Responsibility |
| --- | --- |
| `manifest.json` | MV3 base config (incl. `action` popup, `storage` permission). |
| `content.js` | DOM parsing, outline generation, scroll tracking, UI state machine, and the settings bridge (`chrome.storage` ⇄ main world). |
| `inject.js` | XHR/Fetch interception for time-context injection (gated by toggle/precision, fail-closed off by default). |
| `popup.html` / `popup.js` / `popup.css` | Settings page: time-context toggle, precision, purpose explanation. |
| `sidebar.css` | Glassmorphism, animations, idle-state layout, clock status control, and first-run notice styles. |
| `icons/` | Extension icons (16 / 32 / 48 / 128). |
| `_locales/` | Localized UI and store strings (en / zh_CN, via `chrome.i18n`). |

PRs and [issues](https://github.com/ThisIsSophieZ/ChronoNav/issues) are welcome. After editing the source, hit "Reload" on the extensions page and refresh Gemini.

For contribution guidelines, see [CONTRIBUTING.md](./CONTRIBUTING.md). For private security or privacy reports, email [hi@thebrownielab.com](mailto:hi@thebrownielab.com) or see [SECURITY.md](./SECURITY.md).

---

## 📄 License

[MIT](./LICENSE) © ThisIsSophieZ
