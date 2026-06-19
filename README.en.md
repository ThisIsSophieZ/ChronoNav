# ⏱️ Gemini ChronoNav

[简体中文](./README.md) · **English**

**Give Gemini a real sense of time, and take back control of long conversations.**

Gemini ChronoNav is a lightweight Chrome extension built for the Gemini web app. It silently anchors your local system time onto every prompt you send — with zero noise in the UI — while rendering an elegant, fully interactive conversation timeline (Timeline TOC) on the right edge of the page.

If you run cross-session DevOps investigations, long-threaded debugging, or frequently lose context in conversations that span hundreds of screens, this extension is made for you.

## 💡 Why build it?

Large language models are smart, but they often lack a real sense of time.

This creates subtle disconnects in long-running tasks: the model can't reliably relate "the error half an hour ago," "last night's plan," and "the current state." And once a conversation runs dozens of turns deep, scrolling around to relocate key context simply doesn't scale.

ChronoNav tackles both pain points: **it fills in temporal context under the hood, and reshapes long-conversation navigation on the surface.**

## ✨ Core Features

- **⏳ Implicit Time Anchor (System Time Injection)**
  - The moment you hit send, the extension silently appends a local timestamp — accurate to the second — into the request payload (e.g. `[System Time: 2026-06-18 21:34:12]`).
  - Your chat bubbles stay clean, while the model gains a clear temporal cue that meaningfully improves log triage and schedule reasoning.
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

- **Zero data collection**: runs fully locally — nothing is collected, stored, or uploaded.
- **Minimal requests**: the timestamp travels only with the request you were already sending to `gemini.google.com`, and never talks to any third-party server.
- **No sensitive permissions**: it only injects a content script on `gemini.google.com` to read page DOM; it does not request `tabs`, `cookies`, or sync `storage` permissions.

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
- `content.js`: DOM parsing, outline generation, scroll tracking, and the UI state machine.
- `inject.js`: XHR/Fetch interception responsible for silent time injection.
- `sidebar.css`: glassmorphism effects, easing animations, and the responsive idle-state layout.
- `icons/`: extension icon assets (16 / 32 / 48 / 128).

PRs and issues are welcome. After editing the source, just hit "Reload" on the extensions page and refresh Gemini to see your changes.
