# ⏱️ ChronoNav — Timeline for Gemini

[简体中文](./README.zh-CN.md) · **English**

> Give Gemini real time awareness, and navigate long conversations through a one-click timeline.

ChronoNav is a lightweight Chrome extension for the [Gemini web app](https://gemini.google.com/).

It solves two specific problems:

1. **Time context (optional, off by default)** — when enabled, it prepends your local time and UTC offset to prompts sent to Gemini, so the model can reason more accurately about "how long ago," "what time it is now," and "yesterday."
2. **Conversation timeline (Timeline TOC)** — a colored-node timeline on the right edge of the page; click any node to jump to that message.

> 🐌 ChronoNav has passed **100+ installs**, and it continues to pick up users through organic store traffic.

ChronoNav is an independently developed browser extension. It is not affiliated with, endorsed by, or sponsored by Google or Gemini.

---

## 💡 Why build it

LLMs are smart, but they usually lack reliable real-world time context.

In long-running tasks this creates subtle but real disconnects: the model may not reliably tell apart "the error half an hour ago," "last night's plan," and "the current state." And once a chat runs dozens or hundreds of turns deep, scrolling back to find earlier context simply doesn't scale.

ChronoNav tackles both layers:

**It adds temporal context under the hood, and reshapes how you navigate long conversations at the UI layer.**

---

## ✨ Core Features

### ⏳ Time Context

- **Off by default, opt-in**: informed consent first — it never silently modifies your prompts.
- **One setting, two entry points**: the extension popup, or the clock icon at the top of the sidebar (lit = on, gray = off).
- **Choose precision**:
  - Minute (default): `[System Time: 2026-06-18 21:34 +08:00]`
  - Second: `[System Time: 2026-06-18 21:34:12 +08:00]`
- **Minimal data**: only a timestamp + numeric UTC offset — **no IANA city name, location, account, or device info**.
- **Off means hidden**: turning it off stops injection and hides every time in the sidebar (including historically parsed ones), leaving only nodes and text; toggle back on and times reappear.
- **Transparent, not invisible**: hiding the time prefix in the page UI is a presentation choice. The timestamp is still part of the prompt sent to Gemini, and a first-run notice makes this explicit.

### 🗺️ Interactive Timeline TOC

- A timeline of colored nodes is generated automatically on the right.
- Click any node to smooth-scroll to that message.
- As you scroll the main page, the sidebar highlights and centers the message currently in view.

### 🖱️ Step-by-Step Navigation

- Minimalist up/down arrows at both ends of the sidebar.
- Jump one message at a time without scroll-wheel fatigue.

### 🎨 Restrained, Unobtrusive UI

- Follows Gemini's native light/dark themes.
- When the cursor leaves, the sidebar collapses into a minimal column of colored dots on the right edge.
- Hover to expand the full timeline.

### ⌨️ Accessibility

- The sidebar is a navigation landmark (`role="navigation"`).
- Timeline items and arrows carry readable names (`aria-label`).
- Keyboard friendly: the idle state expands when focus enters the sidebar.

---

## 🛡️ Data Safety (Zero Tracking)

ChronoNav is local-first, with a minimal permission surface.

- **No developer data collection**: no analytics, no tracking, no ads, nothing sent to the developer.
- **Off by default & transparent**: time context stays off until you opt in.
- **Minimal requests**: when enabled, only the timestamp and a numeric UTC offset are added locally before your prompt is sent to Google's Gemini service. Nothing is sent to any third-party server other than Gemini itself.
- **Clear data boundary**: that timestamp does go to Google, and may be stored under Gemini / Google's data-handling rules.
- **Restrained permissions**: a content script runs only on `gemini.google.com` to read the page DOM, plus the non-sensitive `storage` permission to save local preferences (toggle / precision); no `tabs`, `cookies`, or sync `storage`.

See the [privacy policy](./PRIVACY.md) for details.

---

## 🚀 Install & Use

### Chrome Web Store

ChronoNav is live on the [Chrome Web Store](https://chromewebstore.google.com/detail/chrononav-timeline-for-ge/phcknoabakcbekcpfghehngmpgaodabd).

> Currently **100+ installs** 🐌

If you just want to use ChronoNav, install the published build from the Chrome Web Store.

### Load in Developer Mode

If you want to run it from source:

1. Clone or download this repository.
2. Open `chrome://extensions/` in Chrome.
3. Enable **Developer mode** (top-right).
4. Click **Load unpacked** and select the project root containing `manifest.json`.
5. Refresh the [Gemini web app](https://gemini.google.com/) — the ChronoNav timeline appears on the right.

> Time context is **off by default**. Turn it on from the popup or the clock at the top of the sidebar when you need it.

### Build a store ZIP

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\package.ps1
```

The script packages only runtime files:

`manifest.json`, `content.js`, `inject.js`, `sidebar.css`, `popup.*`, `icons/`, `_locales/`

Output lands in `dist/`, with `manifest.json` at the ZIP root as required by the Chrome Web Store.

---

## 📁 Architecture & Development

ChronoNav stays a minimal architecture with **zero build step**.

| File | Responsibility |
| --- | --- |
| `manifest.json` | MV3 base config, including the `action` popup and `storage` permission |
| `content.js` | DOM parsing, outline generation, scroll tracking, UI state machine, and the settings bridge (`chrome.storage` ⇄ main world) |
| `inject.js` | XHR / Fetch interception and time-context injection, gated by toggle/precision, fail-closed by default |
| `popup.html` / `popup.js` / `popup.css` | Settings UI: time-context toggle, precision, and purpose explanation |
| `sidebar.css` | Glassmorphism, animations, idle-state layout, clock status control, and first-run notice styles |
| `icons/` | Extension icons (16 / 32 / 48 / 128) |
| `_locales/` | Localized UI and store strings (`en` / `zh_CN`, via `chrome.i18n`) |

After editing the source, hit "Reload" on the extensions page and refresh Gemini.

PRs and [issues](https://github.com/ThisIsSophieZ/ChronoNav/issues) are welcome.

For contribution guidelines, see [CONTRIBUTING.md](./CONTRIBUTING.md).

For private security or privacy reports, email `hi@thebrownielab.com` or see [SECURITY.md](./SECURITY.md).

---

## 📈 Project Milestones

* **2026-07** — ChronoNav v1.0 shipped
* **2026-09** — Passed **100+ installs**
* Still picking up organic installs after active promotion stopped 🐌

ChronoNav is a small, independent, actively maintained project.

If it happens to solve your problem, feedback, issues, or a ⭐ are all welcome.

---

## 📄 License

[MIT](./LICENSE) © ThisIsSophieZ
