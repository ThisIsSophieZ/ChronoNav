# Privacy Policy / 隐私政策

**Extension / 扩展名称:** ChronoNav - Timeline for Gemini
**Last updated / 最后更新:** 2026-06-26

[English](#english) · [简体中文](#简体中文)

---

## English

ChronoNav ("the extension") is an independent browser extension for the Gemini web
app (`https://gemini.google.com`). It is not affiliated with, endorsed by, or
sponsored by Google or Gemini. This policy explains exactly what the extension
does with your data.

### Summary

The developer does **not** collect, store, sell, or receive any of your personal
data. There are no analytics, no tracking, and no advertising components. The
extension's processing happens locally in your browser, except for the timestamp
that — **only when you turn the feature on** — is appended to the Gemini request
your browser was already sending to Google.

Time context is **off by default**. Nothing is added to your prompts until you
explicitly enable it from the extension popup or the in-page sidebar switch.

### What the extension does locally

To provide its features, the extension performs the following entirely on your own
device, within Google's existing request flow:

- **System time anchor (opt-in).** When the feature is enabled and you send a message
  to Gemini, the extension prepends a local system timestamp with a numeric UTC offset
  only — for example `[System Time: 2026-06-18 21:34 +08:00]` (minute precision) or
  `[System Time: 2026-06-18 21:34:12 +08:00]` (second precision) — in front of your
  prompt **inside the request your browser was already sending to
  `gemini.google.com`**. No IANA time zone, city, location, account, or device
  information is included. This data travels only with that request to Google and is
  never sent to any other destination. The timestamp is generated on your device from
  your local clock. **Note:** the extension hides this prefix in the page UI for
  readability, but hiding is cosmetic — the time has already been sent with the request
  and may be stored by Google as part of your conversation history.
- **Conversation outline.** The extension reads the text of user messages already
  present in the page DOM, solely to render the navigation outline on the right side
  of the page. This text is not stored or transmitted anywhere.
- **Local preferences.** The extension stores interface and feature preferences (such
  as whether the outline is collapsed, whether time context is on, and the chosen
  precision) using the browser's `localStorage` and `chrome.storage.local`. These stay
  on your device and are never transmitted.

### Data collection

The extension collects **no** personally identifiable information, no browsing
history, no message content for the developer, no credentials, and no usage
analytics.

### Data sharing

The extension does **not** share any data with third parties. The only network
interaction is your browser's own request to `gemini.google.com`, which would happen
with or without the extension.

### Permissions

- **Host access to `https://gemini.google.com/*`** is used only to run the extension
  on the Gemini web app: to read the page DOM for the outline and to append the local
  timestamp to outgoing Gemini requests. The extension does not run on any other site.
- **`storage`** is used only to save your local feature preferences (time context
  on/off, precision) so they persist and stay in sync between the popup and the page.
  It is non-sensitive and stores no personal data.
- The extension does **not** request `tabs`, `cookies`, sync `storage`, or any other
  sensitive or broad permissions.

### Remote code

The extension contains no remote code. All scripts (`content.js`, `inject.js`) ship
inside the extension package and are not fetched from any server at runtime.

### Changes to this policy

If this policy changes, the updated version will be published at the same URL with a
revised "Last updated" date.

### Contact

Questions or concerns? Please open an issue:
<https://github.com/ThisIsSophieZ/ChronoNav/issues>

---

## 简体中文

ChronoNav（“本扩展”）是面向 Gemini 网页版（`https://gemini.google.com`）的
独立浏览器扩展。本扩展与 Google 或 Gemini 没有关联，未获得其认可、背书或赞助。
本政策清楚说明本扩展如何处理你的数据。

### 概述

开发者**不会**收集、存储、出售或接收你的个人数据。本扩展不包含任何分析、追踪或
广告组件。除**在你开启该功能后**，时间戳会随你浏览器原本就要发往 Google 的
Gemini 请求一同发送外，本扩展的处理均在你的浏览器本地完成。

时间上下文**默认关闭**。在你通过扩展弹窗或页面内侧栏开关明确开启之前，本扩展不会向
你的提示词追加任何内容。

### 本扩展在本地所做的事

为实现功能，本扩展会在你的设备本地、在 Google 既有的请求链路内进行以下处理：

- **系统时间锚点（需手动开启）。** 当该功能开启且你向 Gemini 发送消息时，本扩展会在你
  **本就要发往 `gemini.google.com` 的那条请求**中，于提示词前追加一段仅带数字 UTC
  偏移量的本地系统时间，例如 `[System Time: 2026-06-18 21:34 +08:00]`（分钟精度）或
  `[System Time: 2026-06-18 21:34:12 +08:00]`（秒精度）。其中**不含** IANA 时区、
  城市、定位、账号或设备信息。该数据仅随这条发往 Google 的请求一同发出，不会被发送到
  任何其他目的地。时间由你设备的本地时钟生成。**注意：** 本扩展会在页面 UI 中隐藏该前缀
  以保持整洁，但隐藏只是表层处理——时间已随请求发出，并可能作为对话历史的一部分被 Google
  保存。
- **对话大纲。** 本扩展读取页面 DOM 中已存在的用户消息文本，仅用于在页面右侧渲染
  导航大纲。该文本不会被存储或传输到任何地方。
- **本地偏好。** 本扩展使用浏览器 `localStorage` 与 `chrome.storage.local` 记住界面与
  功能偏好（例如大纲是否折叠、时间上下文是否开启、所选精度）。这些数据保存在你的设备本地，
  绝不外传。

### 数据收集

本扩展**不收集**任何可识别个人身份的信息、浏览历史、供开发者使用的消息内容、
账号凭据或使用分析数据。

### 数据共享

本扩展**不与任何第三方共享数据**。唯一的网络交互是你的浏览器原本就会发往
`gemini.google.com` 的请求——无论是否安装本扩展，该请求都会发生。

### 权限说明

- **`https://gemini.google.com/*` 的站点访问权限**仅用于在 Gemini 网页版上运行本扩展：
  读取页面 DOM 以生成大纲，并向发往 Gemini 的请求追加本地时间。本扩展不会在任何其他
  网站运行。
- **`storage` 权限**仅用于保存你的本地功能偏好（时间上下文开/关、精度），使其持久化并在
  弹窗与页面之间保持同步。该权限不敏感，也不存储任何个人数据。
- 本扩展**不申请** `tabs`、`cookies`、同步 `storage` 或任何其他敏感/宽泛权限。

### 远程代码

本扩展不包含任何远程代码。所有脚本（`content.js`、`inject.js`）都随扩展包一同发布，
运行时不会从任何服务器拉取代码。

### 政策变更

若本政策发生变更，更新后的版本将发布在同一 URL，并更新“最后更新”日期。

### 联系方式

如有疑问，请提交 issue：
<https://github.com/ThisIsSophieZ/ChronoNav/issues>
