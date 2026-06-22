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

English (1 选):
```
Anchor real local time to every Gemini prompt, and navigate long chats with an elegant message timeline.
```
（约 104 字符）

简体中文:
```
为每条 Gemini 消息注入本地真实时间，并用优雅的对话时间线快速导航长对话。
```

---

## 3. Category / 类别

- 建议：`Productivity`（生产力工具）。

---

## 4. Language / 默认语言

- 建议默认 `English`，并在描述中提供中文段落（或按你的主要受众设为简体中文）。

---

## 5. Detailed description / 详细描述

### English

```
ChronoNav gives Gemini a real sense of time, and makes long conversations easy to navigate.

WHY
Large language models don't always know what time it was when you sent each message. Say "good morning," then "good evening" a minute later, and the model can't tell what happened in between. ChronoNav fixes this by silently attaching your local system time to every prompt you send, and by adding a clickable timeline of your messages on the right side of the page.

FEATURES
- System time anchor: appends an accurate, to-the-second local timestamp with UTC offset and browser time zone (e.g. [System Time: 2026-06-18 21:34:12 +08:00 (Asia/Shanghai)]) into the request you were already sending to Gemini. Your chat bubbles stay clean; the model gets the time context.
- Interactive timeline outline: a subway-map style list of your messages with colored nodes. Click any node to smooth-scroll to that message. The current message is highlighted automatically as you scroll.
- Step navigation: up/down arrows jump between adjacent messages, so you don't have to scroll endlessly.
- Restrained, theme-aware UI: glassmorphism sidebar that follows Gemini's light/dark theme, collapses into a minimal dot column when idle, and surfaces the send time on hover.
- Keyboard and accessibility: navigation landmark and readable button names; the sidebar expands when focused.

PRIVACY
No developer data collection, no tracking, no ads, and no third-party servers. The timestamp travels only with the request your browser already sends to gemini.google.com. The timeline is generated locally from messages already visible on the page. The extension runs only on gemini.google.com and requests no sensitive permissions. See the privacy policy for details.

ChronoNav is an independent extension and is not affiliated with, endorsed by, or sponsored by Google or Gemini.
```

### 简体中文

```
ChronoNav 让 Gemini 拥有真实的时间感，也让长对话重新变得好导航。

为什么需要它
大模型并不总是知道你发送每条消息时的真实时间。你早上说“早上好”，一分钟后又说“晚上好”，模型无法判断这之间发生了什么。ChronoNav 会在你发送的每条消息上静默附加本地系统时间，并在页面右侧生成一条可点击的消息时间线。

功能
- 系统时间锚点：在你本就要发往 Gemini 的请求中，附加精确到秒、带 UTC 偏移量和浏览器时区的本地时间戳（如 [System Time: 2026-06-18 21:34:12 +08:00 (Asia/Shanghai)]）。聊天气泡保持纯净，模型获得时间上下文。
- 交互式时间线大纲：地铁图风格的消息列表，带彩色节点。点击任意节点即可平滑滚动到对应消息，滚动页面时自动高亮当前消息。
- 单步导航：上下箭头在相邻消息间跳转，免去无尽滚动。
- 克制且跟随主题的界面：毛玻璃侧栏跟随 Gemini 深浅色主题，闲置时收拢为极简点阵，悬停时浮现发送时间。
- 键盘与无障碍：导航地标与可读按钮名称，聚焦时侧栏自动展开。

隐私
开发者不收集数据，不追踪，不投放广告，也不与任何第三方服务器通信。时间戳仅随你浏览器原本就要发往 gemini.google.com 的请求一同发送。时间线仅基于页面上已显示的消息在本地生成。扩展仅在 gemini.google.com 运行，且不申请任何敏感权限。详见隐私政策。

ChronoNav 是独立扩展，与 Google 或 Gemini 没有关联，未获得其认可、背书或赞助。
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
The extension's entire functionality targets the Gemini web app. Host access to gemini.google.com is required to (1) inject the content script that reads the page DOM and renders the message-navigation outline, and (2) append the user's local timestamp, UTC offset, and browser time zone to the outgoing Gemini request. The extension does not run on any other site.
```

简体中文:
```
本扩展的全部功能均面向 Gemini 网页版。需要 gemini.google.com 的站点访问权限以：(1) 注入内容脚本，读取页面 DOM 并渲染消息导航大纲；(2) 向发往 Gemini 的请求追加用户本地时间戳、UTC 偏移量和浏览器时区。本扩展不会在任何其他网站运行。
```

> 说明：本扩展未声明 `tabs`、`cookies`、`storage`（同步）、`scripting`（动态）等权限，因此无需为这些权限填写理由。`web_accessible_resources` 暴露的 `inject.js` 属于本地打包脚本，不是远程代码。

---

## 8. Remote code / 远程代码（Privacy 选项卡）

- 答案：**No / 否**（所有脚本随包发布，运行时不拉取远程代码）。

---

## 9. Data usage disclosures / 数据用途声明（Privacy 选项卡）

按 Dashboard 勾选项作答：

- 是否收集或使用以下用户数据？
  - 个人身份信息 / 健康 / 财务 / 认证信息 / 个人通讯 / 位置 / 网页历史 / 用户活动：**均不收集**。
  - 网站内容（Website content）：扩展会在本地读取页面中用户消息文本以渲染大纲，但**不传输、不存储**到扩展之外；如 Dashboard 要求按“在设备本地处理、不传输”口径如实勾选。
  - 用户输入内容 / Prompt：扩展会把本地时间戳、UTC 偏移量和浏览器时区追加到用户本就要发往 Gemini 的请求中；开发者不接收、不存储、不转发该内容。
- 三项合规承诺（均需勾选 / 如实确认）：
  - 不将用户数据出售或转让给第三方（用于非核准用途）。
  - 不将用户数据用于与本扩展单一用途无关的目的。
  - 不将用户数据用于判定信用资格或贷款用途。

---

## 10. Privacy policy URL / 隐私政策 URL（Privacy 选项卡必填）

- 推荐（零配置，先确认仓库公开且默认分支确实为 `master`；如果默认分支是 `main`，请改成 `/blob/main/PRIVACY.md`）：
  ```
  https://github.com/ThisIsSophieZ/Gemini-ChronoNav/blob/master/PRIVACY.md
  ```
- 更正式（如开启 GitHub Pages）：
  ```
  https://thisissophiez.github.io/Gemini-ChronoNav/privacy
  ```

---

## 11. Other fields / 其他字段

- Official URL / 官网：`https://github.com/ThisIsSophieZ/Gemini-ChronoNav`
- Support / 支持：`https://github.com/ThisIsSophieZ/Gemini-ChronoNav/issues`
- 联系邮箱：在 Developer Dashboard 账号设置中填写并完成验证（商店必填）。
