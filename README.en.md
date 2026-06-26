# ⏱️ ChronoNav

[简体中文](./README.md) · **English**

**Give Gemini a real sense of time, and take back control of long conversations.**

ChronoNav is a lightweight Chrome extension built for the Gemini web app. When enabled, it anchors your local system time onto every prompt you send (**off by default — opt in, toggle any time**), while rendering an elegant, fully interactive conversation timeline (Timeline TOC) on the right edge of the page.

ChronoNav is an independent extension and is not affiliated with, endorsed by, or sponsored by Google or Gemini.

If you run cross-session DevOps investigations, long-threaded debugging, or frequently lose context in conversations that span hundreds of screens, this extension is made for you.

## 💡 Why build it?

Large language models are smart, but they often lack a real sense of time.

This creates subtle disconnects in long-running tasks: the model can't reliably relate "the error half an hour ago," "last night's plan," and "the current state." And once a conversation runs dozens of turns deep, scrolling around to relocate key context simply doesn't scale.

ChronoNav tackles both pain points: **it fills in temporal context under the hood, and reshapes long-conversation navigation on the surface.**

## ✨ Core Features

- **⏳ Time Context (off by default, toggleable)**
  - When enabled, the extension appends a local timestamp tagged with a **numeric UTC offset** only (e.g. `+08:00` — no IANA city name or location) into the request payload, so the model can convert times correctly across zones.
  - Choose your precision: **minute** (default, `[System Time: 2026-06-18 21:34 +08:00]`, gentler on privacy) or **second** (`[System Time: 2026-06-18 21:34:12 +08:00]`, better for log triage).
  - Transparent and in your control: off by default with a first-run notice; toggle any time from the extension popup or the "Time context: On/Off" status control in the sidebar.
  - Your chat bubbles stay clean while the model gains a temporal cue. Note: hiding it in the UI is cosmetic — the time has already been sent with the request and may be stored by Google.
- **🗺️ Interactive Timeline TOC**
  - A "subway-map" style timeline with colored nodes is generated automatically on the right. Click any node to smooth-scroll straight to the matching message.
  - Active item tracking: as you scroll the main page, the sidebar highlights and centers the conversation node currently in view.
- **🖱️ Step-by-Step Navigation**
  - Minimalist up/down arrows sit at both ends of the sidebar, letting you jump one message at a time between adjacent context blocks — no more scroll-wheel fatigue.
- **🎨 Restrained, Breathing UI (Glassmorphism & Idle State)**
  - Adapts seamlessly to Gemini's native light/dark themes.
  - Idle state: when your cursor leaves, the sidebar collapses into a minimal column of colored dots pinned to the right edge, staying out of your way; hover to expand it smoothly, with the send time surfacing right where you need it.
- **⌨️ A11y Semantics**
  - The sidebar is marked as a navigation landmark (`role="navigation"`), and items and arrows carry readable names (`aria-label`).
  - Keyboard friendly: when focus enters the sidebar, the idle state expands automatically.

## 🛡️ Data Safety (Zero Tracking)

For a companion tool, safety and compliance come first:

- **No developer data collection**: no analytics, no tracking, no ads, and no data sent to the developer.
- **Off by default & transparent**: time context is disabled until you opt in; we don't pretend it's "fully invisible/risk-free."
- **Minimal requests**: when enabled, only the timestamp and a numeric UTC offset (no location/account/device) travel with the request you were already sending to `gemini.google.com`; the extension never talks to any third-party server. Be aware this time does go to Google and may be stored by it.
- **Restrained permissions**: it injects a content script on `gemini.google.com` to read page DOM, and uses the non-sensitive `storage` permission only to save local preferences (toggle/precision); it does not request `tabs`, `cookies`, or sync `storage` permissions.

## 🚀 Install & Use

The project currently runs via Developer Mode:

1. Clone or download this repository.
2. Open `chrome://extensions/` in Chrome.
3. Enable **Developer mode** in the top-right corner.
4. Click **Load unpacked** and select the project root that contains `manifest.json`.
5. Refresh the [Gemini web app](https://gemini.google.com/), and the breathing timeline outline will appear on the right.

## 📁 Architecture & Development

The project keeps a minimal architecture with zero build step:

- `manifest.json`: MV3 base configuration.
- `content.js`: DOM parsing, outline generation, scroll tracking, the UI state machine, and the settings bridge (chrome.storage ⇄ main world).
- `inject.js`: XHR/Fetch interception responsible for time-context injection (gated by the toggle/precision, fail-closed off by default).
- `popup.html` / `popup.js` / `popup.css`: the settings page (time-context toggle, precision, purpose explanation).
- `sidebar.css`: glassmorphism effects, easing animations, the responsive idle-state layout, plus the time-context status control and first-run notice.
- `icons/`: extension icon assets (16 / 32 / 48 / 128).
- `_locales/`: localized UI and store-description strings (en / zh_CN, via `chrome.i18n`).

PRs and issues are welcome. After editing the source, just hit "Reload" on the extensions page and refresh Gemini to see your changes.
