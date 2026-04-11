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

仅匹配 `https://gemini.google.com/*`，无需额外权限配置。

## 项目结构

| 文件 | 说明 |
|------|------|
| `manifest.json` | MV3 配置、`content_scripts` 与 `inject.js` 资源声明 |
| `content.js` | 隔离世界：注入主世界脚本、输入同步、TOC 渲染与交互 |
| `inject.js` | 主世界：网络拦截与时间戳写入（通过 `chrome.runtime.getURL` 加载） |
| `sidebar.css` | 侧栏样式（悬浮布局、闲置态、地铁图节点等） |

## 隐私与数据

扩展仅在匹配的 Gemini 域名上运行；不单独收集或上传用户数据到第三方服务器。时间戳与聊天内容处理均在浏览器与目标站点请求链路内完成，请结合你的使用场景自行评估合规性。

## 开源协议

若未另行约定，以仓库内 `LICENSE` 为准（如无 LICENSE 文件，使用前请自行补充）。

---

维护：[ThisIsSophieZ](https://github.com/ThisIsSophieZ) · 仓库：<https://github.com/ThisIsSophieZ/Gemini-ChronoNav>
