# Chrome Web Store Listing Copy / 商店上架文案

本文件为 Chrome Web Store 开发者后台（Developer Dashboard）各字段的可直接粘贴文案，
分中英双语。字符数已按商店限制核对。

---

## 1. Product name / 名称

- 限制：最多 45 字符。
- English: `ChronoNav - Timeline for Gemini`
- 简体中文: `ChronoNav - Timeline for Gemini`
- short_name（工具栏/右键菜单显示）: `ChronoNav`

> 采用 “… for Gemini” 形式以规避「品牌名前缀可能被视为官方出品」的审核风险；`name` 31 字符，在 45 字符上限内。`short_name` 设为 `ChronoNav`，显示在工具栏与右键菜单，保持界面清爽。

---

## 2. Summary (short description) / 简介

- 限制：最多 132 字符，单行。

English（定稿）:
```
Lost in long Gemini chats? Add a clean timeline to jump to any message instantly—with optional local time context for the AI.
```

简体中文（定稿）:
```
在 Gemini 长对话里迷路了？用优雅的时间线一键直达任意消息，还能按需为 Gemini 补充本地时间上下文。
```

---

## 3. Category / 类别

- 建议：`Productivity`（生产力工具）。

---

## 4. Language / 默认语言

- 建议默认 `English`，并在描述中提供中文段落（或按你的主要受众设为简体中文）。

---

## 5. Detailed description / 详细描述

### English（定稿）

```
ChronoNav: Give Gemini Time Awareness & Effortless Long-Chat Navigation

Deep work with AI comes with two everyday frustrations. First, the AI has no real sense of time—it doesn't know how much time passed between your messages. Second, once a chat runs into dozens of turns, finding that one earlier reply means scrolling forever.

ChronoNav is an independent extension built to fix exactly that, making your AI workflow faster, sharper, and fully in your control.

✨ Core Features

- Precise Time Context (off by default): When you turn it on, ChronoNav quietly adds a small local timestamp to the prompts you send to Gemini. This gives the AI a real sense of time, so its answers fit the moment you're actually in. (Note: it only adds the time and a numeric UTC offset—never your location or any personal data.)

- Subway-Map Timeline: Say goodbye to endless scrolling. ChronoNav builds a live, subway-map-style timeline with colored nodes down the right side of the page. Click any node to glide straight to that message, and the timeline highlights where you are as you read.

- Clean, Unobtrusive UI: Designed to feel native, the frosted-glass sidebar adapts to Gemini's light and dark themes. When you're not using it, it tucks away into a row of minimal dots, and reappears gracefully on hover—so it never gets in the way of your focus.

- Keyboard & Accessibility: Single-step prev/next navigation buttons, proper ARIA landmarks, and clear button labels. The sidebar expands automatically on focus—fast and friendly for power users and developers.

🛡️ A Privacy Pledge from the Developer

As an independent developer, I take data security seriously. ChronoNav runs entirely in your browser:

- Zero Tracking, Zero Ads: No analytics, ads, or separate network requests by ChronoNav. When Time Context is on, the timestamp is added locally to your prompt and sent through the normal request to Google's Gemini service.

- Minimal Permissions: It requests only the non-sensitive "storage" permission (to remember your toggle and precision settings locally) plus site access limited to Gemini (gemini.google.com)—nothing else.

- You're in Control: Time Context is entirely opt-in. Only when you switch it on does the timestamp get sent to Google's Gemini service along with your normal request (it's hidden in the UI, but it is still sent to Google's model as background context). The timeline itself is built entirely on your device, using only the messages already loaded on the current page.

Disclaimer: ChronoNav is a third-party extension built by an independent developer. It is not affiliated with, sponsored by, or endorsed by Google or Gemini.
```

### 简体中文（定稿）

```
ChronoNav：为 Gemini 赋予时间感知，让长对话导航如丝般顺滑

在使用大模型进行深度工作时，我们常遇到两个痛点：一是 AI 并没有真实的“时间概念”（它不知道你两句话之间隔了多长时间）；二是当对话积累到几十轮后，想要回头寻找某段上下文，只能在无尽的网页里痛苦地上下滑动。

ChronoNav 是专为解决这些体验而诞生的独立扩展，让你的 AI 工作流更加高效、精准且可控。

✨ 核心功能

- 精准的时间上下文 (Time Context)
  按需开启（默认关闭）。开启后，系统会在你发送给 Gemini 的提示词中，自动且隐秘地附加极简的本地时间戳。这让 AI 真正拥有了“时间感知”，能够理解你所处的时间线，从而给出更符合当下语境的回答。（注：仅附加数字与 UTC 偏移量，绝不涉及设备定位或隐私信息。）

- 地铁图式交互时间线 (Visual Timeline)
  告别无休止的鼠标滚轮。ChronoNav 会在页面右侧实时生成一条带有彩色节点的“地铁图”时间线。点击任意节点，即可平滑滚动至对应对话；阅读时，节点会自动高亮你当前所在的位置。

- 极简且克制的 UI 体验
  遵循现代化设计美学，毛玻璃侧栏完美适配 Gemini 的深浅色主题。闲置时，它会自动收拢为隐形的极简点阵；鼠标悬停时，才会优雅浮现。绝不打扰你的沉浸式思考。

- 键盘与无障碍支持
  提供单步上一条/下一条跳转按钮，配备完整的无障碍地标 (ARIA) 与可读按钮名称，聚焦时侧栏自动展开，为专业开发者提供极致的高效体验。

🛡️ 开发者隐私承诺

作为独立开发者，我深知数据安全的重要性。ChronoNav 采用纯前端本地架构：

- 零追踪、零广告：ChronoNav 不包含分析或广告，也不会另行发起网络请求。开启时间上下文后，时间戳会在本地加入提示词，并随正常请求发送至 Google 的 Gemini 服务。

- 最小权限：仅申请非敏感的 storage 权限（用于在本地保存你的开关与精度偏好），以及仅限于 Gemini（gemini.google.com）的站点访问权限，别无其他。

- 按需授权：时间上下文功能完全由你掌控。当且仅当你主动开启时，时间戳才会在提示词发送至 Google 的 Gemini 服务之前于本地加入（页面 UI 会隐藏该前缀以减少视觉干扰，但时间戳仍是发送给 Gemini 的提示词上下文的一部分）。时间线导航则完全基于当前页面已加载的消息在本地生成。

免责声明：ChronoNav 是一款由独立开发者构建的第三方扩展工具，与 Google 或 Gemini 没有任何官方关联、赞助或背书。
```

---

## 6. Single purpose / 单一用途（Privacy 选项卡必填）

English:
```
ChronoNav adds the user's local time to messages sent on the Gemini web app and provides an on-page outline to navigate the user's own messages in a conversation.
```

简体中文:
```
ChronoNav 为在 Gemini 网页版发送的消息附加用户本地时间，并提供页面内大纲以导航用户在对话中自己发送的消息。
```

---

## 7. Permission justifications / 权限使用理由（Privacy 选项卡必填）

### Host permission: `https://gemini.google.com/*`

English:
```
The extension's entire functionality targets the Gemini web app. Host access to gemini.google.com is required to (1) inject the content script that reads the page DOM and renders the message-navigation outline, and (2) when the user has enabled the feature, append the user's local timestamp and numeric UTC offset to the outgoing Gemini request. The extension does not run on any other site.
```

简体中文:
```
本扩展的全部功能均面向 Gemini 网页版。需要 gemini.google.com 的站点访问权限以：(1) 注入内容脚本，读取页面 DOM 并渲染消息导航大纲；(2) 在用户开启该功能时，向发往 Gemini 的请求追加用户本地时间戳与数字 UTC 偏移量。本扩展不会在任何其他网站运行。
```

### Permission: `storage`

English:
```
The extension uses chrome.storage.local only to persist the user's local feature preferences (whether time context is on, and the chosen precision) and keep them in sync between the popup and the page. It stores no personal data and is never transmitted off the device.
```

简体中文:
```
本扩展仅使用 chrome.storage.local 持久化用户的本地功能偏好（时间上下文是否开启、所选精度），并使其在弹窗与页面间保持同步。不存储任何个人数据，也不会离开设备外传。
```

> 说明：本扩展未声明 `tabs`、`cookies`、同步 `storage`、`scripting`（动态）等权限，因此无需为这些权限填写理由。已声明的 `storage` 为非敏感权限，仅用于保存本地偏好。`web_accessible_resources` 暴露的 `inject.js` 属于本地打包脚本，不是远程代码。

---

## 8. Remote code / 远程代码（Privacy 选项卡）

- 答案：**No / 否**（所有脚本随包发布，运行时不拉取远程代码）。

---

## 9. Data usage disclosures / 数据用途声明（Privacy 选项卡）

按 Dashboard 勾选项作答：

- 是否收集或使用以下用户数据？
  - 个人身份信息 / 健康 / 财务 / 认证信息 / 个人通讯 / 位置 / 网页历史 / 用户活动：**均不收集**。
  - 网站内容（Website content）：**如实披露本地使用**。扩展会读取页面中已加载的用户消息文本以渲染大纲，但不向开发者传输，也不由扩展持久化；即使仅在设备本地处理，仍需在 Dashboard 中披露。
  - 用户输入内容 / Prompt：当用户开启时间上下文后，扩展会在提示词发送至 Gemini 之前于本地加入时间戳与数字 UTC 偏移量（默认关闭，不含定位/账号/设备）；开发者不接收、不存储、不转发该内容。
- 三项合规承诺（均需勾选 / 如实确认）：
  - 不将用户数据出售或转让给第三方（用于非核准用途）。
  - 不将用户数据用于与本扩展单一用途无关的目的。
  - 不将用户数据用于判定信用资格或贷款用途。

---

## 10. Privacy policy URL / 隐私政策 URL（Privacy 选项卡必填）

- 推荐（零配置，先确认仓库公开且默认分支确实为 `master`；如果默认分支是 `main`，请改成 `/blob/main/PRIVACY.md`）：
  ```
  https://github.com/ThisIsSophieZ/ChronoNav/blob/master/PRIVACY.md
  ```
- 更正式（如开启 GitHub Pages）：
  ```
  https://thisissophiez.github.io/ChronoNav/privacy
  ```

---

## 11. Other fields / 其他字段

- Official URL / 官网：`https://github.com/ThisIsSophieZ/ChronoNav`
- Support / 支持：`https://github.com/ThisIsSophieZ/ChronoNav/issues`
- 联系邮箱：`hi@thebrownielab.com`（在 Developer Dashboard 账号设置中填写并完成验证，商店必填）。

---

## 12. Existing live listing copy to reconcile before v1.0.1 / 现有商店文案核对

The published v1.0.0 listing has used the phrase "no external servers" in its privacy paragraph. For v1.0.1, replace that unqualified phrase with this accurate wording in the Developer Dashboard (and in any localized listing that uses it):

```text
No tracking, ads, analytics, or separate network requests by ChronoNav. When Time Context is on, the timestamp is added to your prompt and sent through the normal request to Google's Gemini service.
```

已发布的 v1.0.0 商店说明曾使用“no external servers”。提交 v1.0.1 时，请在开发者后台及对应本地化文案中改用上面的明确表述，并核对隐私政策链接已指向更新后的公开页面。
