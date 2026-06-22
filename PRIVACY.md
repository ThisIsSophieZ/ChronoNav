# Privacy Policy / 隐私政策

**Extension / 扩展名称:** ChronoNav - Timeline for Gemini
**Last updated / 最后更新:** 2026-06-22

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
that is appended to the Gemini request your browser was already sending to Google.

### What the extension does locally

To provide its features, the extension performs the following entirely on your own
device, within Google's existing request flow:

- **System time anchor.** When you send a message to Gemini, the extension appends a
  local system timestamp with UTC offset and, when available, your browser's IANA
  time zone (format `[System Time: YYYY-MM-DD HH:mm:ss +08:00 (Asia/Shanghai)]`)
  in front of your prompt **inside the request your browser was already sending to
  `gemini.google.com`**. This data travels only with that request to Google and is
  never sent to any other destination. The timestamp is generated on your device
  from your local clock.
- **Conversation outline.** The extension reads the text of user messages already
  present in the page DOM, solely to render the navigation outline on the right side
  of the page. This text is not stored or transmitted anywhere.
- **Local preferences.** The extension uses the browser's `localStorage` to remember
  interface preferences such as whether the outline is collapsed. This stays on your
  device and is never transmitted.

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
<https://github.com/ThisIsSophieZ/Gemini-ChronoNav/issues>

---

## 简体中文

ChronoNav（“本扩展”）是面向 Gemini 网页版（`https://gemini.google.com`）的
独立浏览器扩展。本扩展与 Google 或 Gemini 没有关联，未获得其认可、背书或赞助。
本政策清楚说明本扩展如何处理你的数据。

### 概述

开发者**不会**收集、存储、出售或接收你的个人数据。本扩展不包含任何分析、追踪或
广告组件。除时间戳会随你浏览器原本就要发往 Google 的 Gemini 请求一同发送外，
本扩展的处理均在你的浏览器本地完成。

### 本扩展在本地所做的事

为实现功能，本扩展会在你的设备本地、在 Google 既有的请求链路内进行以下处理：

- **系统时间锚点。** 当你向 Gemini 发送消息时，本扩展会在你**本就要发往
  `gemini.google.com` 的那条请求**中，于提示词前追加一段带 UTC 偏移量、并在可用时
  带浏览器 IANA 时区的本地系统时间（格式
  `[System Time: YYYY-MM-DD HH:mm:ss +08:00 (Asia/Shanghai)]`）。该数据仅随这条发往
  Google 的请求一同发出，不会被发送到任何其他目的地。时间由你设备的本地时钟生成。
- **对话大纲。** 本扩展读取页面 DOM 中已存在的用户消息文本，仅用于在页面右侧渲染
  导航大纲。该文本不会被存储或传输到任何地方。
- **本地偏好。** 本扩展使用浏览器 `localStorage` 记住界面偏好（例如大纲是否折叠）。
  这些数据保存在你的设备本地，绝不外传。

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
- 本扩展**不申请** `tabs`、`cookies`、同步 `storage` 或任何其他敏感/宽泛权限。

### 远程代码

本扩展不包含任何远程代码。所有脚本（`content.js`、`inject.js`）都随扩展包一同发布，
运行时不会从任何服务器拉取代码。

### 政策变更

若本政策发生变更，更新后的版本将发布在同一 URL，并更新“最后更新”日期。

### 联系方式

如有疑问，请提交 issue：
<https://github.com/ThisIsSophieZ/Gemini-ChronoNav/issues>
