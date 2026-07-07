# ⏱️ ChronoNav — Timeline for Gemini

[English](./README.md) · **简体中文**

> 为 Gemini 补全真实的时间上下文，并把冗长对话梳理成可一键跳转的时间线。

ChronoNav 是一款专为 [Gemini 网页版](https://gemini.google.com/) 设计的轻量级 Chrome 扩展，做两件事：

1. **时间上下文（可选，默认关闭）** —— 开启后，在你发往 Gemini 的请求中、于提示词前插入本地时间与 UTC 偏移量，让模型能理解“多久之前”“现在几点”这类时序信息。
2. **对话时间线（Timeline TOC）** —— 在页面右侧生成一条彩色节点的“地铁图”，点击即可平滑跳转到任意一条历史消息。

ChronoNav 是独立扩展，与 Google 或 Gemini 没有关联，未获得其认可、背书或赞助。

---

## 💡 为什么做它

大模型很聪明，但通常没有真实的“时间感”。在长线任务里这会造成微妙的脱节：它分不清“半小时前的报错”“昨晚的计划”和“现在的状态”之间的先后。而几十轮的深水区对话，靠滚动找上下文早已力不从心。

ChronoNav 同时解决这两点：**底层补全时间上下文，表层重塑长对话导航。**

---

## ✨ 核心特性

### ⏳ 时间上下文（Time Context）

- **默认关闭、需手动开启**：知情同意优先，绝不偷偷修改你的 prompt。
- **一处开关，两个入口**：扩展弹窗、或右侧侧栏顶部的时钟图标（点亮=开，灰色=关）。
- **精度可选**：分钟级（默认，`[System Time: 2026-06-18 21:34 +08:00]`，隐私更温和）或秒级（`…21:34:12…`，更利于日志排查）。
- **信息最小化**：只附加时间戳 + 数字 UTC 偏移量，**不含 IANA 城市名、定位、账号或设备信息**。
- **关闭即清场**：关闭后不再注入，且侧栏的所有时间（含历史已解析的）一并隐藏，只保留节点与文本；开回来时间立即恢复。
- **透明，不装隐形**：UI 中隐藏前缀只是表层处理——时间已随请求发出，并可能被 Google 保存。首次运行会有明确提示。

### 🗺️ 动态全局大纲（Interactive Timeline TOC）

- 右侧自动生成带彩色节点的时间线，点击任意节点平滑滚动到对应消息。
- 活动项追踪：主页面滚动时，侧栏自动高亮并居中当前视口内的对话节点。

### 🖱️ 单步极速导航

- 侧栏上下两端的极简箭头，可在相邻消息间逐条跳转，免去滚轮疲劳。

### 🎨 克制与呼吸感 UI

- 跟随 Gemini 深浅色原生主题。
- 闲置态：鼠标离开后收拢为最右侧的极简彩色点阵，不挡视野；悬停丝滑展开。

### ⌨️ 无障碍语义

- 侧栏标注为导航地标（`role="navigation"`），条目与箭头均带可读名称（`aria-label`）。
- 键盘可达：焦点进入侧栏即展开闲置态。

---

## 🛡️ 数据安全（Zero Tracking）

- **开发者不收集数据**：无分析、无追踪、无广告，不向开发者发送任何数据。
- **默认关闭 + 透明可控**：时间上下文默认关闭，需你主动开启；不会把功能包装成“完全隐形 / 无风险”。
- **请求极简**：开启后，仅时间戳与数字 UTC 偏移量会在提示词发送至 `gemini.google.com` 前于本地加入；除 Gemini 本身外不向任何服务器发送数据。但请知悉：该时间会发给 Google 并可能被其保存。
- **权限克制**：仅在 `gemini.google.com` 注入内容脚本读取页面 DOM；仅申请非敏感的 `storage` 权限保存本地偏好（开关 / 精度）；不申请 `tabs`、`cookies` 或同步 `storage` 等敏感权限。

完整说明见 [隐私政策](./PRIVACY.md)。

---

## 🚀 安装与使用

### 开发者模式加载

1. 克隆或下载本仓库源码。
2. 在 Chrome 打开 `chrome://extensions/`。
3. 开启右上角「开发者模式」。
4. 点击「加载已解压的扩展程序」，选择包含 `manifest.json` 的项目根目录。
5. 刷新 [Gemini 网页端](https://gemini.google.com/)，右侧即出现时间线大纲。

> 时间上下文**默认关闭**。需要时点扩展弹窗或侧栏顶部的时钟开启。

### 打包为商店 ZIP

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\package.ps1
```

脚本只会打包运行时所需文件（`manifest.json`、`content.js`、`inject.js`、`sidebar.css`、`popup.*`、`icons/`、`_locales/`），产物在 `dist/`，`manifest.json` 位于 ZIP 根目录，符合 Chrome 网上应用店要求。

---

## 📁 架构与开发

本项目保持极简架构，无构建依赖（Zero Build Step）：

| 文件 | 职责 |
| --- | --- |
| `manifest.json` | MV3 基础配置（含 `action` 弹窗、`storage` 权限）。 |
| `content.js` | DOM 解析、大纲生成、滚动监听、UI 状态机，以及设置桥接（`chrome.storage` ⇄ 主世界）。 |
| `inject.js` | XHR/Fetch 拦截，时间上下文注入（受开关 / 精度控制，默认 fail-closed 关闭）。 |
| `popup.html` / `popup.js` / `popup.css` | 设置页：时间上下文开关、精度、用途说明。 |
| `sidebar.css` | 毛玻璃特效、动画、闲置态布局，时钟状态控件与首次提示样式。 |
| `icons/` | 扩展图标（16 / 32 / 48 / 128）。 |
| `_locales/` | 界面与商店文案多语言（en / zh_CN，基于 `chrome.i18n`）。 |

欢迎提交 PR 或 [Issue](https://github.com/ThisIsSophieZ/ChronoNav/issues)。修改源码后，在扩展页点击「重新加载」并刷新 Gemini 即可生效。

贡献指南见 [CONTRIBUTING.md](./CONTRIBUTING.md)。如需私下报告安全或隐私问题，请发送邮件至 [hi@thebrownielab.com](mailto:hi@thebrownielab.com)，或查看 [SECURITY.md](./SECURITY.md)。

---

## 📄 许可

[MIT](./LICENSE) © ThisIsSophieZ
