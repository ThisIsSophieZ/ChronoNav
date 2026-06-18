# Gemini ChronoNav

Chrome 扩展（Manifest V3），面向 [Gemini](https://gemini.google.com) 网页版聊天：在请求中注入**系统时间锚点**，并在页面右侧提供**对话大纲（TOC）**导航，方便在长对话中定位用户消息。

## 功能概览

- **时间锚点**：通过主世界脚本拦截 `fetch` / `XMLHttpRequest`，在合适的 JSON/文本载荷中追加 `[System Time: YYYY-MM-DD HH:mm:ss]`，供服务端或下游逻辑使用；内容脚本与输入框同步，尽量不在界面上暴露该前缀（可按 DOM 情况剥离）。
- **右侧大纲**：自动收集用户消息节点，按时间/颜色区分条目，点击可平滑滚动到对应气泡。
- **视口高亮**：根据主聊天区域的**滚动位置**更新当前条目高亮（彩色圆点），避免无关操作带来的频繁计算。
- **侧栏交互**：侧栏为右侧垂直居中的毛玻璃气泡；鼠标离开侧栏约 1.5 秒后进入极简「点阵」模式，移回侧栏即展开（不监听全局 `mousemove` / `keydown`）。

## 安装（开发者模式）

1. 克隆本仓库。
2. 打开 Chrome → **扩展程序** → **开发者模式** → **加载已解压的扩展程序**。
3. 选择仓库根目录（包含 `manifest.json` 的文件夹）。

仅匹配 `https://gemini.google.com/`*，无需额外权限配置。

## 项目结构


| 文件              | 说明                                            |
| --------------- | --------------------------------------------- |
| `manifest.json` | MV3 配置、`content_scripts` 与 `inject.js` 资源声明   |
| `content.js`    | 隔离世界：注入主世界脚本、输入同步、TOC 渲染与交互                   |
| `inject.js`     | 主世界：网络拦截与时间戳写入（通过 `chrome.runtime.getURL` 加载） |
| `sidebar.css`   | 侧栏样式（悬浮布局、闲置态、地铁图节点等）                         |
| `icons/`        | 扩展图标（16 / 32 / 48 / 128）                       |
| `LICENSE`       | MIT 开源协议                                       |


## 隐私政策

**最后更新：2026-06-18**

Gemini ChronoNav 尊重并保护用户隐私。本节说明扩展如何处理数据，可一并用于 Chrome Web Store 的隐私政策声明。

### 收集的数据

**本扩展不收集、不存储、不上传任何个人数据到开发者或任何第三方服务器。** 开发者无法访问你的对话内容、账户信息或使用记录。

### 数据的本地处理

为实现功能，扩展会在你的浏览器本地进行以下处理，全部不离开你的设备与 Google 的既有请求链路：

- **时间锚点**：当你向 Gemini 发送消息时，扩展在**发往 `gemini.google.com` 的请求体**中，于你的提示词前追加一段本地系统时间文本（格式 `[System Time: YYYY-MM-DD HH:mm:ss]`）。该数据仅随你**本就要发送给 Google 的请求**一同发出，不会被发送到任何其他目的地。
- **大纲导航**：扩展读取页面中的用户消息 DOM 文本，仅用于在浏览器内本地渲染右侧大纲列表，不做持久化存储、不外传。
- **本地偏好**：仅使用浏览器 `localStorage` 保存「大纲折叠状态」等界面偏好，存于本地，不外传。

### 权限说明

- `host_permissions` / `matches` 仅限 `https://gemini.google.com/*`：扩展只在 Gemini 网页生效，不会在其他网站运行。
- 不申请 `tabs`、`storage`（同步）、`cookies` 等任何敏感或广泛权限。

### 数据共享

本扩展**不与任何第三方共享数据**，也不包含分析、追踪或广告组件。

### 联系方式

如有疑问，请通过项目仓库提交 issue：
[https://github.com/ThisIsSophieZ/Gemini-ChronoNav](https://github.com/ThisIsSophieZ/Gemini-ChronoNav)

## 开源协议

本项目以 [MIT License](./LICENSE) 开源。

---

维护：[ThisIsSophieZ](https://github.com/ThisIsSophieZ) · 仓库：[https://github.com/ThisIsSophieZ/Gemini-ChronoNav](https://github.com/ThisIsSophieZ/Gemini-ChronoNav)