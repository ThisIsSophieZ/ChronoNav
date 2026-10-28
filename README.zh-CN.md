# ⏱️ ChronoNav — Timeline for Gemini

[English](./README.md) · **简体中文**

> 为 Gemini 补全真实的时间上下文，并把冗长对话梳理成可一键跳转的时间线。

ChronoNav 是一款专为 [Gemini 网页版](https://gemini.google.com/) 设计的轻量级 Chrome 扩展。

它解决两个很具体的问题：

1. **时间上下文（可选，默认关闭）** —— 开启后，在你发往 Gemini 的请求中、于提示词前插入本地时间与 UTC 偏移量，让模型更准确地理解“多久之前”“现在几点”“昨天”等时序信息。
2. **对话时间线（Timeline TOC）** —— 在页面右侧生成一条彩色节点时间线，点击即可快速跳转到任意一条历史消息。

> 🐌 ChronoNav 已突破 **100+ installs**，并持续通过自然流量获得新用户。

ChronoNav 是独立开发的浏览器扩展，与 Google 或 Gemini 无关联，也未获得其认可、背书或赞助。

---

## v1.0.1 更新内容

v1.0.1 已于 2026 年 10 月 29 日提交 Chrome Web Store 审核。审核通过前，商店可能仍提供 v1.0.0。

- 修复刷新后时间线时间消失的问题，包括新对话首条消息及使用 Enter 发送的消息。
- 改进时间线标签，避免重复显示 Gemini 的屏幕阅读器标题。
- 时间上下文仍需主动开启、默认关闭；没有新增权限。

详细修复记录见 [CHANGELOG.md](./CHANGELOG.md)。

---

## 💡 为什么做它

大模型很聪明，但通常缺少可靠的真实时间上下文。

在长线任务里，这会造成一些微妙但真实的脱节：模型可能无法准确区分“半小时前的报错”“昨晚的计划”和“现在的状态”。与此同时，当一段对话累积到几十甚至上百轮后，单靠滚动页面寻找历史上下文也会变得非常低效。

ChronoNav 从两个层面解决这些问题：

**底层补全时间上下文，表层重塑长对话导航。**

---

## ✨ 核心特性

### ⏳ 时间上下文（Time Context）

- **默认关闭、需手动开启**：知情同意优先，不会在用户不知情的情况下修改 prompt。
- **一处设置，两个入口**：可通过扩展弹窗，或右侧侧栏顶部的时钟图标控制（点亮 = 开启，灰色 = 关闭）。
- **精度可选**：
  - 分钟级（默认）：`[System Time: 2026-06-18 21:34 +08:00]`
  - 秒级：`[System Time: 2026-06-18 21:34:12 +08:00]`
- **信息最小化**：仅附加时间戳与数字 UTC 偏移量，**不包含 IANA 城市名、定位、账号或设备信息**。
- **关闭即隐藏**：关闭后不再注入时间上下文，同时隐藏侧栏中的所有时间信息（包括已解析的历史时间），仅保留节点与文本；重新开启后立即恢复。
- **透明可见**：UI 中隐藏时间前缀仅属于界面层处理。时间信息已经随请求发送至 Gemini，并可能由 Google 保存。首次启用时会明确提示这一点。

### 🗺️ 动态全局大纲（Interactive Timeline TOC）

- 在页面右侧自动生成带彩色节点的对话时间线。
- 点击任意节点即可平滑滚动至对应消息。
- 主页面滚动时，侧栏自动追踪当前视口中的消息，高亮并居中对应节点。

### 🖱️ 单步极速导航

- 侧栏上下两端提供极简导航箭头。
- 可在相邻消息之间逐条跳转，减少长对话中的滚轮操作。

### 🎨 克制且低干扰的 UI

- 自动跟随 Gemini 的深色 / 浅色主题。
- 鼠标离开后，侧栏收拢为最右侧的极简彩色点阵，尽量减少对正文区域的遮挡。
- 悬停后自动展开完整时间线。

### ⌨️ 无障碍语义

- 侧栏使用导航地标语义（`role="navigation"`）。
- 时间线条目与导航箭头均提供可读名称（`aria-label`）。
- 支持键盘访问；焦点进入侧栏时会自动展开闲置态。

---

## 🛡️ 数据安全（Zero Tracking）

ChronoNav 采用本地优先、最小权限设计。

- **开发者不收集数据**：无分析、无追踪、无广告，不向开发者发送任何用户数据。
- **默认关闭 + 透明可控**：时间上下文功能默认关闭，需要用户主动开启。
- **请求信息最小化**：开启后，仅时间戳与数字 UTC 偏移量会在本地加入即将发送至 Google 的 Gemini 服务的请求中。除 Gemini 本身外，不向任何第三方服务器发送这些信息。
- **明确的数据边界**：时间信息会随请求发送给 Google，并可能按照 Gemini / Google 的数据处理规则被保存。
- **权限克制**：仅在 `gemini.google.com` 注入内容脚本并读取页面 DOM；仅申请非敏感的 `storage` 权限保存本地设置（开关 / 精度）。不申请 `tabs`、`cookies` 或同步 `storage` 等额外权限。

完整说明见 [隐私政策](./PRIVACY.md)。

---

## 🚀 安装与使用

### Chrome Web Store

ChronoNav 已发布至 [Chrome Web Store](https://chromewebstore.google.com/detail/chrononav-timeline-for-ge/phcknoabakcbekcpfghehngmpgaodabd)。

> 当前已有 **100+ installs** 🐌

如果你只是想使用 ChronoNav，推荐直接通过 Chrome Web Store 安装正式版本。

### 开发者模式加载

如果你希望从源码运行：

1. 克隆或下载本仓库源码。
2. 在 Chrome 打开 `chrome://extensions/`。
3. 开启右上角「开发者模式」。
4. 点击「加载已解压的扩展程序」，选择包含 `manifest.json` 的项目根目录。
5. 刷新 [Gemini 网页版](https://gemini.google.com/)，右侧即可看到 ChronoNav 时间线。

> 时间上下文**默认关闭**。需要时，可通过扩展弹窗或侧栏顶部的时钟图标开启。

### 打包为商店 ZIP

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\package.ps1
```

脚本只会打包运行时所需文件：

`manifest.json`、`content.js`、`inject.js`、`sidebar.css`、`popup.*`、`icons/`、`_locales/`

产物位于 `dist/`，且 `manifest.json` 位于 ZIP 根目录，符合 Chrome Web Store 打包要求。

---

## 📁 架构与开发

ChronoNav 保持极简架构，**无构建依赖（Zero Build Step）**。

| 文件 | 职责 |
| --- | --- |
| `manifest.json` | MV3 基础配置，包括 `action` 弹窗与 `storage` 权限 |
| `content.js` | DOM 解析、大纲生成、滚动监听、UI 状态机，以及设置桥接（`chrome.storage` ⇄ 主世界） |
| `inject.js` | XHR / Fetch 拦截与时间上下文注入，受开关和精度设置控制，默认 fail-closed |
| `popup.html` / `popup.js` / `popup.css` | 设置界面：时间上下文开关、精度与用途说明 |
| `sidebar.css` | 毛玻璃效果、动画、闲置态布局、时钟状态控件与首次提示样式 |
| `icons/` | 扩展图标（16 / 32 / 48 / 128） |
| `_locales/` | UI 与商店文案国际化（`en` / `zh_CN`，基于 `chrome.i18n`） |

修改源码后，在 Chrome 扩展管理页面点击「重新加载」，并刷新 Gemini 页面即可生效。

欢迎提交 [Issue](https://github.com/ThisIsSophieZ/ChronoNav/issues) 或 Pull Request。

贡献指南见 [CONTRIBUTING.md](./CONTRIBUTING.md)。

如需私下报告安全或隐私问题，请发送邮件至 `hi@thebrownielab.com`，或查看 [SECURITY.md](./SECURITY.md)。

---

## 📈 Project Milestones

* **2026-07** — ChronoNav v1.0 发布
* **2026-09** — 突破 **100+ installs**
* **2026-10** — 提交 v1.0.1 至 Chrome Web Store 审核
* 在停止主动推广后仍持续获得自然安装 🐌

ChronoNav 是一个小型、独立、持续维护的项目。

如果它恰好解决了你的问题，欢迎留下反馈、提交 Issue，或给项目一个 ⭐。

---

## 📄 许可

[MIT](./LICENSE) © ThisIsSophieZ
