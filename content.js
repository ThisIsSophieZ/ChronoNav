/**
 * ChronoNav — Content Script（隔离世界）
 * 1. 注入 inject.js 到主世界以拦截网络载荷并追加系统时间（界面不显示）。
 * 2. 同步输入框文本供 inject 匹配；拦截发送相关事件以保持 lastPrompt 准确。
 * 3. MutationObserver + 右侧 TOC，点击平滑滚动至对应用户消息节点。
 */

(function () {
  const EVT = "chrono-nav-prompt-sync";
  const SETTINGS_EVT = "chrono-nav-settings";
  const INJECT_READY_EVT = "chrono-nav-inject-ready";
  /** chrome.storage.local 键名（跨 popup / content / 主世界共享设置）。 */
  const SK_ENABLED = "timeInjectionEnabled";
  const SK_PRECISION = "timePrecision";
  const SK_FIRST_RUN_DONE = "firstRunNoticeDismissed";
  const INJECT_TOGGLE_ID = "chrono-nav-inject-toggle";
  const FIRST_RUN_ID = "chrono-nav-first-run";
  /** 设置默认值：默认关闭注入（知情同意），精度默认分钟级（隐私更温和）。 */
  const currentSettings = { enabled: false, precision: "minute" };
  const ROOT_ID = "mate-sidebar";
  const LEGACY_ROOT_ID = "chrono-nav-toc-root";
  const TOC_LIST_ID = "chrono-nav-toc-list";
  const TOGGLE_ID = "chrono-nav-toc-toggle";
  const COLLAPSED_CLASS = "is-collapsed";
  const IDLE_CLASS = "is-idle";
  /** 鼠标离开侧栏后延迟收起为极简点阵 */
  const IDLE_LEAVE_MS = 1500;
  /** 首屏渲染后，若用户一直未与侧栏交互，延迟自动收起为点阵（兼顾可发现性与不打扰） */
  const INITIAL_IDLE_MS = 2500;
  const STORAGE_KEY = "chrono-nav-toc-collapsed";
  const FAB_UP_ID = "chrono-nav-fab-up";
  const FAB_DOWN_ID = "chrono-nav-fab-down";
  const GOOGLE_NODE_COLORS = ["#4285F4", "#EA4335", "#FBBC05", "#34A853"];

  /** 视口追踪：User 节点 → 侧栏 li.toc-item（高亮仅在主聊天区滚动时刷新） */
  const messageToTocLi = new WeakMap();
  let trackedMessageNodes = [];
  let chatScrollEl = null;
  let chatScrollRaf = 0;
  /** 上一次的高亮项，仅当 active 真正变化时才把它滚入侧栏可视区，避免逐帧平滑滚动相互打架 */
  let lastActiveLi = null;
  /** 导航软锁：点击 TOC / 上下箭头后短时间内强制以目标项为 active，避免平滑滚动途中被可见比例算法抢回邻项 */
  let navTargetLi = null;
  let navTargetUntil = 0;
  const NAV_LOCK_MS = 700;

  const EDITOR_SELECTORS = [
    'div[contenteditable="true"][aria-label*="Enter a prompt"]',
    'div[contenteditable="true"][aria-label*="prompt"]',
    'div[contenteditable="true"][data-placeholder]',
    "rich-textarea div[contenteditable=\"true\"]",
    'div.ql-editor[contenteditable="true"]',
  ];

  const CHAT_ROOT_SELECTORS = [
    "chat-window infinite-scroller",
    "chat-window",
    "main",
    '[role="main"]',
  ];

  const USER_MESSAGE_SELECTORS = [
    "user-query",
    ".conversation-container user-query",
    '[data-message-author-role="user"]',
    '[data-author-role="user"]',
  ];

  let lastTocSignature = "";
  let lastCapturedPrompt = "";
  let lastCapturedAt = 0;

  /** 仅当 DOM 中未回显时间戳时，用发送瞬间记录的 HH:mm 与「最新一条」对齐 */
  const pendingPromptTimes = [];
  const nodeMetaMap = new WeakMap();
  /**
   * 持久化的时间/颜色缓存，key = `${index}\u0000${归一化正文}`。
   * nodeMetaMap 以 DOM 节点为键，Gemini 重渲染替换旧节点后即丢失；此 Map 不随节点对象失效，
   * 用于在节点被替换后恢复已记录的时间，修复「旧消息时间显示丢失」问题。
   */
  const tocMetaCache = new Map();
  const TOC_META_CACHE_MAX = 200;
  let tocBootstrapped = false;
  let prevUserNodeCount = 0;

  /**
   * 容忍方括号内任意内容（日期时间、时区后缀等都可变）。刻意「不」行首锚定：
   * 刷新后的历史气泡聚合文本开头可能带换行 / UI 文本，锚定会匹配失败导致既不隐藏也不解析时间。
   * 这里用「任意位置匹配」+ 全局版本，配合 SYSTEM_TIME_ONLY_RE 判定「整段仅为前缀」的块级元素。
   */
  const SYSTEM_TIME_FIND_RE = /\[System Time:[^\]]*\]/i;
  const SYSTEM_TIME_FIND_GLOBAL_RE = /\[System Time:[^\]]*\]\s*\n?/gi;

  /** chrome.i18n 包装：取本地化文案；缺失键或异常（如非扩展环境）时回退到 key 本身。 */
  function t(key, subs) {
    try {
      return chrome.i18n.getMessage(key, subs) || key;
    } catch (_) {
      return key;
    }
  }

  function injectMainWorld() {
    const src = chrome.runtime.getURL("inject.js");
    const s = document.createElement("script");
    s.src = src;
    s.onload = () => s.remove();
    (document.documentElement || document.head).appendChild(s);
  }

  /** ---------- 注入设置桥接（chrome.storage ⇄ 主世界 inject.js） ---------- */

  /** 把当前设置下发给主世界（inject.js 监听 SETTINGS_EVT）。 */
  function sendSettingsToInject() {
    try {
      window.dispatchEvent(
        new CustomEvent(SETTINGS_EVT, {
          detail: { enabled: currentSettings.enabled, precision: currentSettings.precision },
        })
      );
    } catch (_) {}
  }

  /** 从 chrome.storage.local 读取设置；不可用时退回默认（关闭/分钟）。 */
  function loadSettings(cb) {
    try {
      chrome.storage.local.get([SK_ENABLED, SK_PRECISION], (res) => {
        currentSettings.enabled = res && res[SK_ENABLED] === true;
        currentSettings.precision = res && res[SK_PRECISION] === "second" ? "second" : "minute";
        if (cb) cb();
      });
    } catch (_) {
      if (cb) cb();
    }
  }

  function setInjectionEnabled(next) {
    try {
      chrome.storage.local.set({ [SK_ENABLED]: !!next });
    } catch (_) {}
  }

  // 主世界就绪即把当前设置发过去（避免脚本加载先后竞态导致首发请求漏设置）。
  window.addEventListener(
    INJECT_READY_EVT,
    () => {
      loadSettings(sendSettingsToInject);
    },
    true
  );

  // 关键顺序：必须先注册 INJECT_READY_EVT 监听，再注入主世界脚本，
  // 否则 inject.js 抢先 dispatch ready 时本侧会错过事件（极早期请求会保持 fail-closed）。
  if (document.documentElement) {
    injectMainWorld();
  } else {
    document.addEventListener(
      "readystatechange",
      () => {
        if (document.documentElement) injectMainWorld();
      },
      { once: true }
    );
  }

  // 设置在别处（popup / 另一标签页 / 侧栏开关）变更时，实时同步到本页与主世界。
  try {
    chrome.storage.onChanged.addListener((changes, area) => {
      if (area !== "local") return;
      let touched = false;
      if (Object.prototype.hasOwnProperty.call(changes, SK_ENABLED)) {
        currentSettings.enabled = changes[SK_ENABLED].newValue === true;
        touched = true;
      }
      if (Object.prototype.hasOwnProperty.call(changes, SK_PRECISION)) {
        currentSettings.precision =
          changes[SK_PRECISION].newValue === "second" ? "second" : "minute";
        touched = true;
      }
      if (touched) {
        sendSettingsToInject();
        updateInjectStatusUI();
      }
    });
  } catch (_) {}

  function syncPromptText(text, sending = false) {
    window.dispatchEvent(
      new CustomEvent(EVT, {
        detail: { text: text == null ? "" : String(text), sending },
      })
    );
  }

  function matchesSelectorList(el, selectors) {
    return !!(
      el &&
      typeof el.matches === "function" &&
      selectors.some((selector) => {
        try {
          return el.matches(selector);
        } catch (_) {
          return false;
        }
      })
    );
  }

  function getPromptEditors() {
    const set = new Set();
    for (const sel of EDITOR_SELECTORS) {
      try {
        document.querySelectorAll(sel).forEach((el) => set.add(el));
      } catch (_) {}
    }
    return Array.from(set);
  }

  function readEditorText(el) {
    if (!el) return "";
    const t = el.innerText != null ? el.innerText : el.textContent || "";
    return t.replace(/\u200b/g, "").trimEnd();
  }

  function normalizePromptText(text) {
    return String(text || "").replace(/\u200b/g, "").replace(/\s+/g, " ").trim();
  }

  function formatClockTime(date) {
    const d = date || new Date();
    const pad = (n) => String(n).padStart(2, "0");
    return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }

  function captureSendTime(text) {
    // 时间上下文关闭时不注入，也不应在本地缓存发送时刻；否则关闭期间发送的消息
    // 会留下一个从未发给 Gemini 的时间，重新开启后被 CSS 取消隐藏即“凭空出现”。
    if (!currentSettings.enabled) return;
    const normalized = normalizePromptText(text);
    if (!normalized) return;
    const now = Date.now();
    if (normalized === lastCapturedPrompt && now - lastCapturedAt < 1200) {
      return;
    }
    pendingPromptTimes.push(formatClockTime());
    if (pendingPromptTimes.length > 50) {
      pendingPromptTimes.splice(0, pendingPromptTimes.length - 50);
    }
    lastCapturedPrompt = normalized;
    lastCapturedAt = now;
  }

  /**
   * 从原始文本解析注入的时间戳；有则返回日期(YYYY-MM-DD)、HH:mm 与剥离后的正文。
   * 无匹配则视为历史或其它数据，不使用 new Date() 伪造时间。
   */
  function parseLeadingSystemTime(raw) {
    const s = String(raw || "");
    const m = s.match(SYSTEM_TIME_FIND_RE);
    if (!m) {
      return {
        hadStamp: false,
        ymd: null,
        hhmm: null,
        stripped: s.replace(/\s+/g, " ").trim(),
      };
    }
    // 从匹配到的前缀段里提取日期与时刻。日期段 YYYY-MM-DD 无冒号，时区 +08:00 在时刻之后，
    // 故首个「时:分」即为发送时刻、首个「年-月-日」即为发送日期。
    const dateMatch = m[0].match(/(\d{4})-(\d{2})-(\d{2})/);
    const ymd = dateMatch ? dateMatch[0] : null;
    const timeMatch = m[0].match(/(\d{1,2}):(\d{2})/);
    const hhmm = timeMatch ? `${timeMatch[1].padStart(2, "0")}:${timeMatch[2]}` : null;
    // 去掉文本中所有 [System Time: ...] 段（不限位置），其余即为正文。
    const rest = s.replace(SYSTEM_TIME_FIND_GLOBAL_RE, " ");
    return {
      hadStamp: true,
      ymd,
      hhmm,
      stripped: rest.replace(/\s+/g, " ").trim(),
    };
  }

  /**
   * 2 层时间显示（导航器而非社交流）：
   *  - 今天 → HH:mm（保留钟点定位当天）
   *  - 今年更早 → MM-DD（看日期足够）
   *  - 跨年 → YYYY-MM-DD（兜底不歧义）
   * 无日期（pending：刚发送）天然属于今天，直接返回 HH:mm。
   */
  function formatTierTime(ymd, hhmm) {
    if (!hhmm) return null;
    if (!ymd) return hhmm;
    const now = new Date();
    const pad = (n) => String(n).padStart(2, "0");
    const todayYear = now.getFullYear();
    const todayYmd = `${todayYear}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
    if (ymd === todayYmd) return hhmm;
    const parts = ymd.split("-");
    if (Number(parts[0]) === todayYear) return `${parts[1]}-${parts[2]}`;
    return ymd;
  }

  function getRawMessageText(el) {
    const inner =
      el.querySelector("div.query-content") ||
      el.querySelector('[data-content="user-message"]') ||
      el.querySelector("message-content") ||
      el;
    // Gemini now includes a screen-reader heading containing the full prompt
    // alongside the visible message lines. Read the lines directly so the
    // heading does not duplicate the timeline label. textContent also keeps a
    // System Time line readable after it has been hidden with display:none.
    const lines = inner.querySelectorAll("p.query-text-line");
    if (lines.length) {
      return Array.from(lines, (line) => line.textContent || "").join("\n");
    }
    // Older/different message markup: exclude accessibility-only duplicates.
    const copy = inner.cloneNode(true);
    copy
      .querySelectorAll(".screen-reader-user-query-label, .cdk-visually-hidden, [class*='screen-reader']")
      .forEach((node) => node.remove());
    copy.querySelectorAll("br").forEach((node) => node.replaceWith("\n"));
    copy.querySelectorAll("p, div, li, pre, blockquote").forEach((node) => node.prepend("\n"));
    return copy.textContent || "";
  }

  /** 元素的整段文本是否「只有」[System Time: ...]（即前缀独占一个块级元素 / 一行，如 Gemini 的 <p class="query-text-line">）。 */
  const SYSTEM_TIME_ONLY_RE = /^\s*\[System Time:[^\]]*\]\s*$/i;

  /**
   * 把主聊天区回显的 [System Time: ...] 从可见 UI 中隐藏，避免用户看到明文。
   *
   * 关键修正：刻意「不」做行首锚定守卫。刷新后的历史气泡聚合 innerText 开头常带换行 / 前置内容，
   * 旧的 `^\s*\[System Time:` 守卫会匹配失败而整体提前返回 —— 这正是「<p> 没被隐藏、TOC 时间也丢」的真因。
   *
   * 现在直接「全子树扫描」：命中「整段仅为前缀」的块级元素就用内联 display:none 隐藏
   * （改样式而非文本，Angular 重渲染文本时不接管我们的 inline style，能扛住反复水合）。
   * 只有当前缀与正文同处一个元素（<br> 软换行）时，才退回删除前缀文本节点。
   */
  function stripSystemTimePrefixFromDom(userEl) {
    if (!userEl || !userEl.querySelectorAll) return;

    // 策略 A：隐藏「整段仅为前缀」的块级元素（不依赖聚合文本是否以前缀开头）。
    let hidByElement = false;
    const candidates = userEl.querySelectorAll("p, div, span, li, pre, code, blockquote");
    for (const el of candidates) {
      if (!SYSTEM_TIME_ONLY_RE.test(el.textContent || "")) continue;
      // 若它内部还套着更深的「纯前缀」元素，跳过外层、只隐藏最内层那个，减少误伤。
      if (
        Array.prototype.some.call(el.children, (c) => SYSTEM_TIME_ONLY_RE.test(c.textContent || ""))
      ) {
        continue;
      }
      el.style.setProperty("display", "none", "important");
      el.setAttribute("data-chrono-sys-hidden", "1");
      hidByElement = true;
    }
    if (hidByElement) return;

    // 策略 B（兜底）：前缀与正文在同一元素（<br> 软换行）——删掉文本节点里的前缀段（不限位置）。
    const inner =
      userEl.querySelector("div.query-content") ||
      userEl.querySelector('[data-content="user-message"]') ||
      userEl.querySelector("message-content") ||
      userEl;
    const raw = getRawMessageText(userEl);
    if (!SYSTEM_TIME_FIND_RE.test(raw)) return;

    function stripFromTextNode(textNode) {
      const t = textNode.textContent || "";
      const local = new RegExp(SYSTEM_TIME_FIND_RE.source + "\\s*\\n?", "i");
      const m = t.match(local);
      if (!m) return false;
      textNode.textContent = t.slice(0, m.index) + t.slice(m.index + m[0].length);
      return true;
    }

    function walk(el) {
      let changed = false;
      for (const child of el.childNodes) {
        if (child.nodeType === Node.TEXT_NODE) {
          if (stripFromTextNode(child)) changed = true;
        } else if (child.nodeType === Node.ELEMENT_NODE) {
          if (walk(child)) changed = true;
        }
      }
      return changed;
    }

    walk(inner);
  }

  function getPrimaryEditor() {
    const editors = getPromptEditors();
    const active = editors.find((el) => el === document.activeElement || el.contains(document.activeElement));
    return active || editors.find((el) => el.getClientRects().length > 0) || editors[0] || null;
  }

  function looksLikeSendTrigger(target) {
    const trigger = target && target.closest ? target.closest("button, div[role=\"button\"]") : null;
    if (!trigger) return false;
    const text = [
      trigger.getAttribute("aria-label"),
      trigger.getAttribute("title"),
      trigger.textContent,
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
    return /send|submit|run|发送|提交/.test(text);
  }

  /** 通知侧栏立即收起为点阵（输入框聚焦/输入时调用）。 */
  function collapseSidebarForInput() {
    const root = document.getElementById(ROOT_ID);
    if (root) root.dispatchEvent(new CustomEvent("chrono-nav-idle-now"));
  }

  function isPromptEditorTarget(t) {
    return !!(
      t &&
      t.getAttribute &&
      t.getAttribute("contenteditable") === "true" &&
      matchesSelectorList(t, EDITOR_SELECTORS)
    );
  }

  function bindInputSync() {
    const onInput = (e) => {
      if (isPromptEditorTarget(e.target)) {
        syncPromptText(readEditorText(e.target));
        collapseSidebarForInput();
      }
    };
    document.addEventListener("input", onInput, true);
    document.addEventListener("keyup", onInput, true);
    document.addEventListener("compositionend", onInput, true);
    document.addEventListener("paste", onInput, true);
    // 聚焦输入框即收起侧栏，无需等到第一次按键，避免「偶尔没收起」。
    document.addEventListener(
      "focusin",
      (e) => {
        if (isPromptEditorTarget(e.target)) collapseSidebarForInput();
      },
      true
    );

    const onSendHint = () => {
      const editor = getPrimaryEditor();
      if (!editor) return;
      const text = readEditorText(editor);
      syncPromptText(text, true);
      captureSendTime(text);
    };

    document.addEventListener(
      "keydown",
      (e) => {
        if (e.key === "Enter" && !e.shiftKey) onSendHint();
      },
      true
    );
    document.addEventListener(
      "click",
      (e) => {
        if (looksLikeSendTrigger(e.target)) {
          onSendHint();
        }
      },
      true
    );
  }

  /** ---------- TOC ---------- */

  function getChatRoot() {
    for (const selector of CHAT_ROOT_SELECTORS) {
      const el = document.querySelector(selector);
      if (el) return el;
    }
    return document.body;
  }

  /**
   * 在聊天根内 BFS 找到第一个纵向可滚动的元素（如 infinite-scroller），用于仅在滚动时刷新 TOC 高亮。
   */
  function getChatScrollTarget() {
    const base = getChatRoot();
    if (!(base instanceof HTMLElement)) return null;
    const queue = [base];
    while (queue.length) {
      const el = queue.shift();
      if (!(el instanceof HTMLElement)) continue;
      let st;
      try {
        st = getComputedStyle(el);
      } catch (_) {
        continue;
      }
      const y = st.overflowY;
      if (
        (y === "auto" || y === "scroll" || y === "overlay") &&
        el.scrollHeight > el.clientHeight + 12
      ) {
        return el;
      }
      for (let i = 0; i < el.children.length; i++) {
        queue.push(el.children[i]);
      }
    }
    return null;
  }

  function findUserMessageNodes() {
    const root = getChatRoot();
    const set = new Set();

    for (const selector of USER_MESSAGE_SELECTORS) {
      try {
        root.querySelectorAll(selector).forEach((el) => {
          if (el && el.textContent && el.textContent.trim()) {
            set.add(el);
          }
        });
      } catch (_) {}
    }

    const merged = Array.from(set).sort((a, b) => {
      if (a === b) return 0;
      const pos = a.compareDocumentPosition(b);
      if (pos & Node.DOCUMENT_POSITION_FOLLOWING) return -1;
      if (pos & Node.DOCUMENT_POSITION_PRECEDING) return 1;
      return 0;
    });

    /** 同一气泡被多个选择器命中时，去掉被其它节点包含的子节点，避免 TOC 重复 */
    return merged.filter((n) => !merged.some((m) => m !== n && m.contains(n)));
  }

  function getMessageText(el) {
    const raw = getRawMessageText(el);
    const parsed = parseLeadingSystemTime(raw);
    return parsed.stripped;
  }

  function truncatePreviewText(text, maxChars) {
    const clean = normalizePromptText(text);
    if (!clean) return t("emptyPreview");
    return clean.length > maxChars ? `${clean.slice(0, maxChars)}…` : clean;
  }

  function computeTocSignature(nodes) {
    return (
      `${nodes.length}:` +
      nodes.map((node, index) => `${index}:${getMessageText(node)}`).join("|")
    );
  }

  /**
   * 每个对话节点只绑定一次 meta（颜色 + 时间展示），避免 MutationObserver 重复渲染时重复分配。
   * 无 [System Time: ...] 的历史消息：timeDisplay 为 null，时间气泡隐藏，绝不使用 new Date() 伪造。
   */
  function ensureNodeMeta(node, index, timeDisplay, cacheKey) {
    const cached = cacheKey ? tocMetaCache.get(cacheKey) : null;
    let meta = nodeMetaMap.get(node);
    const color = GOOGLE_NODE_COLORS[index % GOOGLE_NODE_COLORS.length];
    // 时间优先级：本轮解析/pending > 节点既有 meta > 持久缓存（节点被替换时的兜底）。
    const resolvedTime =
      timeDisplay ||
      (meta && meta.timeDisplay) ||
      (cached && cached.timeDisplay) ||
      null;
    if (!meta) {
      meta = { timeDisplay: resolvedTime, color };
      nodeMetaMap.set(node, meta);
    } else {
      if (resolvedTime && !meta.timeDisplay) meta.timeDisplay = resolvedTime;
      meta.color = color;
    }
    if (cacheKey) {
      if (!cached) {
        tocMetaCache.set(cacheKey, { timeDisplay: meta.timeDisplay, color });
        if (tocMetaCache.size > TOC_META_CACHE_MAX) {
          const oldestKey = tocMetaCache.keys().next().value;
          tocMetaCache.delete(oldestKey);
        }
      } else if (meta.timeDisplay && !cached.timeDisplay) {
        cached.timeDisplay = meta.timeDisplay;
      }
    }
    return meta;
  }

  /**
   * 仅在「用户消息条数增加」且非首次 bootstrap 时，把 pending 从后往前对齐到无 [System Time:...] 的节点，
   * 避免初次加载历史记录时误把 pending 安在最后一条历史上。
   */
  function assignPendingTimesToRows(rows) {
    const stack = pendingPromptTimes.slice();
    pendingPromptTimes.length = 0;
    if (!stack.length) return;

    if (!tocBootstrapped) {
      while (stack.length) pendingPromptTimes.unshift(stack.pop());
      return;
    }

    const added = Math.max(0, rows.length - prevUserNodeCount);
    let slots = Math.min(added, stack.length);
    for (let i = rows.length - 1; i >= 0 && slots > 0; i--) {
      if (!rows[i].parsed.hadStamp) {
        rows[i].pendingHhmm = stack.pop();
        slots--;
      }
    }
    while (stack.length) {
      pendingPromptTimes.unshift(stack.pop());
    }
  }

  function isTocCollapsed() {
    try {
      return window.localStorage.getItem(STORAGE_KEY) === "1";
    } catch (_) {
      return false;
    }
  }

  function setTocCollapsed(nextValue) {
    try {
      window.localStorage.setItem(STORAGE_KEY, nextValue ? "1" : "0");
    } catch (_) {}
  }

  function applyCollapsedState(root, collapsed) {
    const wasCollapsed = root.classList.contains(COLLAPSED_CLASS);
    root.classList.toggle(COLLAPSED_CLASS, collapsed);
    if (collapsed) {
      root.classList.remove(IDLE_CLASS);
    } else if (wasCollapsed) {
      root.dispatchEvent(new CustomEvent("chrono-nav-idle-reset"));
    }
    const toggle = root.querySelector(`#${TOGGLE_ID}`);
    if (!toggle) return;
    toggle.setAttribute("aria-expanded", collapsed ? "false" : "true");
    toggle.setAttribute("title", collapsed ? t("expandOutline") : t("collapseOutline"));
    toggle.textContent = collapsed ? "‹" : "›";
    updateFabState();
  }

  function bindToggle(root) {
    const toggle = root.querySelector(`#${TOGGLE_ID}`);
    if (!toggle || toggle.dataset.bound === "1") return;
    toggle.dataset.bound = "1";
    toggle.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      const collapsed = !root.classList.contains(COLLAPSED_CLASS);
      applyCollapsedState(root, collapsed);
      setTocCollapsed(collapsed);
    });
  }

  /**
   * 仅根据侧栏鼠标进出：进入立刻展开并取消收起计时；离开 1.5s 后收起，期间再次进入则取消。
   */
  function bindIdleAutoCollapse(root) {
    if (!root || root.dataset.chronoIdleBound === "1") return;
    root.dataset.chronoIdleBound = "1";

    let leaveTimer = null;

    function clearLeaveTimer() {
      if (leaveTimer) {
        clearTimeout(leaveTimer);
        leaveTimer = null;
      }
    }

    function expandFromIdle() {
      root.classList.remove(IDLE_CLASS);
      clearLeaveTimer();
    }

    function scheduleIdleCollapse() {
      clearLeaveTimer();
      if (root.classList.contains(COLLAPSED_CLASS)) return;
      leaveTimer = setTimeout(() => {
        leaveTimer = null;
        if (!root.classList.contains(COLLAPSED_CLASS)) {
          root.classList.add(IDLE_CLASS);
        }
      }, IDLE_LEAVE_MS);
    }

    root.addEventListener("mouseenter", expandFromIdle);
    root.addEventListener("mouseleave", () => {
      if (root.classList.contains(COLLAPSED_CLASS)) return;
      scheduleIdleCollapse();
    });
    // 键盘可达：聚焦侧栏内任意按钮即展开；焦点移出后再按规则收起。
    root.addEventListener("focusin", expandFromIdle);
    root.addEventListener("focusout", (e) => {
      if (root.classList.contains(COLLAPSED_CLASS)) return;
      if (e.relatedTarget && root.contains(e.relatedTarget)) return;
      // 鼠标仍悬停侧栏时保持展开（与旧版鼠标行为一致），收起交给 mouseleave。
      try {
        if (root.matches(":hover")) return;
      } catch (_) {}
      scheduleIdleCollapse();
    });
    root.addEventListener("chrono-nav-idle-reset", expandFromIdle);
    // 在 Gemini 输入框聚焦/输入时立即收起为点阵：除非已手动折叠，或鼠标正悬停侧栏（交给 hover 逻辑）。
    root.addEventListener("chrono-nav-idle-now", () => {
      clearLeaveTimer();
      if (root.classList.contains(COLLAPSED_CLASS)) return;
      if (root.classList.contains(IDLE_CLASS)) return;
      try {
        if (root.matches(":hover")) return;
      } catch (_) {}
      root.classList.add(IDLE_CLASS);
    });

    // 首屏：mouseenter/mouseleave 是“跨边界”事件，纯阅读（鼠标从未进出侧栏）时永远不会触发收起，
    // 导致完整侧栏一直挡住内容。这里在加载后延时收起一次；期间任意交互（hover/聚焦/输入）都会取消。
    leaveTimer = setTimeout(() => {
      leaveTimer = null;
      if (root.classList.contains(COLLAPSED_CLASS)) return;
      if (root.classList.contains(IDLE_CLASS)) return;
      try {
        if (root.matches(":hover")) return;
      } catch (_) {}
      if (root.contains(document.activeElement)) return;
      root.classList.add(IDLE_CLASS);
    }, INITIAL_IDLE_MS);
  }

  function getSidebarInnerHtml() {
    const chevronUp =
      '<svg class="mate-nav-chevron" viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><polyline points="7 15 12 10 17 15" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
    const chevronDown =
      '<svg class="mate-nav-chevron" viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><polyline points="7 9 12 14 17 9" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
    return (
      '<div class="mate-nav-top">' +
      `<button type="button" class="chrono-nav-inject-status" id="${INJECT_TOGGLE_ID}" aria-pressed="false">` +
      '<svg class="chrono-nav-inject-icon" viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">' +
      '<circle cx="12" cy="12" r="8.5" fill="none" stroke="currentColor" stroke-width="1.8"/>' +
      '<path d="M12 7.4V12l3.1 1.9" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>' +
      "</svg>" +
      "</button>" +
      "</div>" +
      '<div class="mate-nav-up">' +
      `<button type="button" class="mate-nav-step" id="${FAB_UP_ID}" aria-label="${t("prevMessage")}">${chevronUp}</button>` +
      "</div>" +
      '<div class="mate-list-container">' +
      `<button type="button" class="mate-sidebar-toggle" id="${TOGGLE_ID}" aria-label="${t("toggleOutline")}"></button>` +
      `<ul class="chrono-nav-toc-list" id="${TOC_LIST_ID}"></ul>` +
      "</div>" +
      '<div class="mate-nav-down">' +
      `<button type="button" class="mate-nav-step" id="${FAB_DOWN_ID}" aria-label="${t("nextMessage")}">${chevronDown}</button>` +
      "</div>"
    );
  }

  /** 旧版单 panel 结构 → 三段式 Flex 侧栏 */
  function ensureMateSidebarStructure(root) {
    if (!root || root.querySelector(".mate-list-container")) return;
    root.innerHTML = getSidebarInnerHtml();
    lastTocSignature = "";
  }

  function getTocListEl() {
    return document.getElementById(ROOT_ID)?.querySelector(`#${TOC_LIST_ID}`) || null;
  }

  function getNavTocSibling(li, direction) {
    let s = direction > 0 ? li.nextElementSibling : li.previousElementSibling;
    while (s && !s.classList.contains("toc-item")) {
      s = direction > 0 ? s.nextElementSibling : s.previousElementSibling;
    }
    return s;
  }

  function scrollToMessageIndex(index) {
    const nodes = findUserMessageNodes();
    const el = nodes[index];
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "center", inline: "nearest" });
    }
  }

  function updateFabState() {
    const root = document.getElementById(ROOT_ID);
    const up = document.getElementById(FAB_UP_ID);
    const down = document.getElementById(FAB_DOWN_ID);
    if (!root || !up || !down) return;
    if (root.classList.contains(COLLAPSED_CLASS)) {
      up.hidden = true;
      down.hidden = true;
      return;
    }
    up.hidden = false;
    down.hidden = false;
    const ul = getTocListEl();
    const active = ul?.querySelector("li.toc-item.is-active");
    if (!active) {
      up.disabled = true;
      down.disabled = true;
      return;
    }
    const prev = getNavTocSibling(active, -1);
    const next = getNavTocSibling(active, 1);
    up.disabled = !prev;
    down.disabled = !next;
  }

  function stepNav(direction) {
    const ul = getTocListEl();
    const active = ul?.querySelector("li.toc-item.is-active");
    if (!active) return;
    const target = getNavTocSibling(active, direction);
    if (!target) return;
    const idx = parseInt(target.dataset.chronoNodeKey || "", 10);
    if (!Number.isFinite(idx)) return;
    lockNavTarget(target);
    scrollToMessageIndex(idx);
  }

  function bindStepNav(root) {
    if (!root || root.dataset.chronoStepBound === "1") return;
    root.dataset.chronoStepBound = "1";
    root.addEventListener("click", (e) => {
      const t = e.target;
      if (!(t instanceof Element)) return;
      const upHit = t.closest(`#${FAB_UP_ID}`);
      const downHit = t.closest(`#${FAB_DOWN_ID}`);
      if (upHit) {
        e.preventDefault();
        stepNav(-1);
      } else if (downHit) {
        e.preventDefault();
        stepNav(1);
      }
    });
  }

  function onChatScroll() {
    if (chatScrollRaf) return;
    chatScrollRaf = requestAnimationFrame(() => {
      chatScrollRaf = 0;
      refreshActiveFromScroll();
    });
  }

  function ensureChatScrollListener() {
    const el = getChatScrollTarget();
    if (el === chatScrollEl) return;
    if (chatScrollEl) {
      chatScrollEl.removeEventListener("scroll", onChatScroll, { capture: true });
      chatScrollEl = null;
    }
    chatScrollEl = el;
    if (chatScrollEl) {
      chatScrollEl.addEventListener("scroll", onChatScroll, { passive: true, capture: true });
      requestAnimationFrame(() => refreshActiveFromScroll());
    }
  }

  /**
   * 按视口上下留白（与原 IntersectionObserver rootMargin 相近）计算当前最「在屏」的用户消息。
   */
  /**
   * 统一应用高亮：清掉旧 is-active、给目标加 is-active，并仅在「变化时」把它滚入侧栏内部可视区。
   * 点击 TOC / 上下箭头 / 主区滚动三种来源都经由此函数,保证高亮与底部箭头状态一致。
   */
  function setActiveLi(activeLi) {
    const ul = getTocListEl();
    if (!ul) return;
    ul.querySelectorAll("li.toc-item.is-active").forEach((li) => {
      if (li !== activeLi) li.classList.remove("is-active");
    });
    if (activeLi) activeLi.classList.add("is-active");
    if (activeLi && activeLi !== lastActiveLi) {
      try {
        activeLi.scrollIntoView({ behavior: "smooth", block: "nearest" });
      } catch (_) {
        try {
          activeLi.scrollIntoView();
        } catch (_) {}
      }
    }
    lastActiveLi = activeLi;
    updateFabState();
  }

  /** 点击/箭头跳转时立即认领目标项为 active,并加一段软锁,期间滚动回调不再抢回邻项。 */
  function lockNavTarget(li) {
    if (!li) return;
    navTargetLi = li;
    navTargetUntil = Date.now() + NAV_LOCK_MS;
    setActiveLi(li);
  }

  function refreshActiveFromScroll() {
    const ul = getTocListEl();
    if (!ul) return;
    // 软锁期内强制以导航目标为 active（目标已重渲染失联则解锁）。
    if (navTargetLi) {
      if (navTargetLi.isConnected && Date.now() < navTargetUntil) {
        setActiveLi(navTargetLi);
        return;
      }
      navTargetLi = null;
    }
    const nodes =
      trackedMessageNodes.length > 0 ? trackedMessageNodes : findUserMessageNodes();
    if (!nodes.length) {
      setActiveLi(null);
      return;
    }
    const viewH = window.innerHeight;
    const bandTop = viewH * 0.08;
    const bandBottom = viewH - viewH * 0.12;
    const viewCenter = viewH / 2;
    // 第一遍取最大可见比例；第二遍在「与最大比例接近(<=0.05)」的候选里挑离视口中心最近者，
    // 修复多条同时全可见时高亮停在先出现一条（问题二）的 tie-break。
    let maxRatio = 0;
    const metrics = [];
    for (let i = 0; i < nodes.length; i++) {
      const n = nodes[i];
      const r = n.getBoundingClientRect();
      const visibleTop = Math.max(r.top, bandTop);
      const visibleBottom = Math.min(r.bottom, bandBottom);
      const visible = Math.max(0, visibleBottom - visibleTop);
      const height = Math.max(1, r.height);
      const ratio = visible / height;
      const centerDist = Math.abs((r.top + r.bottom) / 2 - viewCenter);
      metrics.push({ n, ratio, centerDist });
      if (ratio > maxRatio) maxRatio = ratio;
    }
    let best = null;
    let bestCenterDist = Infinity;
    if (maxRatio > 0.001) {
      for (const m of metrics) {
        if (m.ratio >= maxRatio - 0.05 && m.centerDist < bestCenterDist) {
          bestCenterDist = m.centerDist;
          best = m.n;
        }
      }
    }
    setActiveLi(best ? messageToTocLi.get(best) || null : null);
  }

  function syncMessageTracking(nodes) {
    trackedMessageNodes = nodes.slice();
    ensureChatScrollListener();
  }

  /**
   * 解析 CSS 颜色字符串为 { r, g, b, a }；无法解析或全透明时返回 null。
   * 仅处理 rgb()/rgba()（getComputedStyle 的背景色一般已归一化为该形式）。
   */
  function parseRgbColor(value) {
    if (!value) return null;
    const m = String(value).match(
      /rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(?:,\s*([\d.]+)\s*)?\)/i
    );
    if (!m) return null;
    const a = m[4] == null ? 1 : parseFloat(m[4]);
    return { r: +m[1], g: +m[2], b: +m[3], a: Number.isFinite(a) ? a : 1 };
  }

  /**
   * 以 Gemini 页面「实际」背景明暗为准（而非系统 prefers-color-scheme），
   * 这样用户在 Gemini 内手动切主题、与系统不一致时，侧栏毛玻璃也能正确搭配。
   * 自底向上找到第一个不透明背景计算亮度；全部失败时回退到系统设置。
   */
  function isDarkEnvironment() {
    try {
      const candidates = [document.body, document.documentElement];
      for (const el of candidates) {
        if (!el) continue;
        const rgb = parseRgbColor(getComputedStyle(el).backgroundColor);
        if (rgb && rgb.a > 0) {
          const luminance = 0.2126 * rgb.r + 0.7152 * rgb.g + 0.0722 * rgb.b;
          return luminance < 128;
        }
      }
    } catch (_) {}
    try {
      return !!(
        window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches
      );
    } catch (_) {
      return false;
    }
  }

  /** 给侧栏根节点打 is-dark / is-light，驱动 sidebar.css 中的毛玻璃配色（不影响节点圆点配色）。 */
  function applySidebarTheme(root) {
    const el = root || document.getElementById(ROOT_ID);
    if (!el) return;
    const dark = isDarkEnvironment();
    el.classList.toggle("is-dark", dark);
    el.classList.toggle("is-light", !dark);
  }

  /** 地标语义：让侧栏成为可被读屏/快捷键识别的导航区域，并给列表加可读名称。 */
  function ensureSidebarA11y(root) {
    if (!root) return;
    if (root.getAttribute("role") !== "navigation") {
      root.setAttribute("role", "navigation");
    }
    if (!root.getAttribute("aria-label")) {
      root.setAttribute("aria-label", t("sidebarLabel"));
    }
    const ul = root.querySelector(`#${TOC_LIST_ID}`);
    if (ul && !ul.getAttribute("aria-label")) {
      ul.setAttribute("aria-label", t("listLabel"));
    }
  }

  function startThemeWatcher() {
    const reapply = () => applySidebarTheme();
    try {
      const mo = new MutationObserver(reapply);
      const opts = {
        attributes: true,
        attributeFilter: ["class", "style", "data-theme", "dark", "data-dark-theme"],
      };
      if (document.documentElement) mo.observe(document.documentElement, opts);
      if (document.body) mo.observe(document.body, opts);
    } catch (_) {}
    try {
      const mq = window.matchMedia("(prefers-color-scheme: dark)");
      if (mq.addEventListener) mq.addEventListener("change", reapply);
      else if (mq.addListener) mq.addListener(reapply);
    } catch (_) {}
  }

  /** 同步侧栏时钟图标的点亮/灰显状态、悬停提示、无障碍状态，以及 TOC 时间显隐。 */
  function updateInjectStatusUI() {
    const on = currentSettings.enabled;
    // 关闭时给侧栏根节点挂 time-context-off：CSS 据此隐藏所有 TOC 时间（含历史已解析的）。
    // 时间数据仍保留在 meta/缓存里，开回来即恢复显示。
    const root = document.getElementById(ROOT_ID);
    if (root) root.classList.toggle("time-context-off", !on);
    const btn = document.getElementById(INJECT_TOGGLE_ID);
    if (!btn) return;
    btn.classList.toggle("is-on", on);
    btn.classList.toggle("is-off", !on);
    btn.setAttribute("aria-pressed", on ? "true" : "false");
    const label = on ? t("injectionOn") : t("injectionOff");
    btn.setAttribute("aria-label", label);
    // 悬停原生提示：显示 "Time context: On/Off"。
    btn.setAttribute("title", label);
  }

  function bindInjectToggle(root) {
    const btn = root.querySelector(`#${INJECT_TOGGLE_ID}`);
    if (!btn || btn.dataset.bound === "1") return;
    btn.dataset.bound = "1";
    btn.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      setInjectionEnabled(!currentSettings.enabled);
    });
    updateInjectStatusUI();
  }

  /**
   * 首次运行引导：时钟做几下柔光脉冲吸引注意，并在其旁弹出指向它的小气泡，
   * 明确告知「会把本地时间随请求发给 Google」以及在哪里开关。仅在未关闭过时显示。
   */
  function maybeShowFirstRunNotice() {
    try {
      chrome.storage.local.get([SK_FIRST_RUN_DONE], (res) => {
        if (res && res[SK_FIRST_RUN_DONE]) return;
        if (document.getElementById(FIRST_RUN_ID)) return;
        const top = document.querySelector("#" + ROOT_ID + " .mate-nav-top");
        if (!top) return;
        const clock = document.getElementById(INJECT_TOGGLE_ID);
        if (clock) clock.classList.add("chrono-attn");

        const box = document.createElement("div");
        box.id = FIRST_RUN_ID;
        box.setAttribute("role", "dialog");
        box.setAttribute("aria-label", t("firstRunTitle"));
        box.innerHTML =
          `<div class="chrono-fr-title">${t("firstRunTitle")}</div>` +
          `<div class="chrono-fr-body">${t("firstRunBody")}</div>` +
          '<div class="chrono-fr-actions">' +
          `<button type="button" class="chrono-fr-enable">${t("firstRunEnable")}</button>` +
          `<button type="button" class="chrono-fr-dismiss">${t("firstRunDismiss")}</button>` +
          "</div>";
        const close = () => {
          try {
            chrome.storage.local.set({ [SK_FIRST_RUN_DONE]: true });
          } catch (_) {}
          if (clock) clock.classList.remove("chrono-attn");
          box.remove();
        };
        box.querySelector(".chrono-fr-enable").addEventListener("click", () => {
          setInjectionEnabled(true);
          close();
        });
        box.querySelector(".chrono-fr-dismiss").addEventListener("click", close);
        top.appendChild(box);
      });
    } catch (_) {}
  }

  function ensureTocRoot() {
    let root = document.getElementById(ROOT_ID);
    if (root) {
      ensureMateSidebarStructure(root);
      bindToggle(root);
      applyCollapsedState(root, isTocCollapsed());
      bindIdleAutoCollapse(root);
      bindStepNav(root);
      bindInjectToggle(root);
      ensureSidebarA11y(root);
      applySidebarTheme(root);
      return root;
    }
    const legacy = document.getElementById(LEGACY_ROOT_ID);
    if (legacy) legacy.remove();
    root = document.createElement("div");
    root.id = ROOT_ID;
    root.setAttribute("data-chrono-nav", "toc");
    root.innerHTML = getSidebarInnerHtml();
    document.documentElement.appendChild(root);
    bindToggle(root);
    applyCollapsedState(root, isTocCollapsed());
    bindIdleAutoCollapse(root);
    bindStepNav(root);
    bindInjectToggle(root);
    ensureSidebarA11y(root);
    applySidebarTheme(root);
    return root;
  }

  function renderToc() {
    const root = ensureTocRoot();
    const ul = root.querySelector(`#${TOC_LIST_ID}`);
    if (!ul) return false;
    const nodes = findUserMessageNodes();
    // 关键顺序：必须「先读含前缀的原文解析时间，再剥离 DOM」。
    // 否则剥离后 DOM 里的 [System Time: ...] 已消失，刷新历史时（无 pending / 无缓存）时间就会丢成空。
    const rows = nodes.map((node) => {
      const raw = getRawMessageText(node);
      return { node, raw, parsed: parseLeadingSystemTime(raw), pendingHhmm: null };
    });
    for (let i = 0; i < nodes.length; i++) {
      stripSystemTimePrefixFromDom(nodes[i]);
    }
    const signature = computeTocSignature(nodes);
    if (signature === lastTocSignature) return false;
    lastTocSignature = signature;
    ul.innerHTML = "";
    if (!nodes.length) {
      // 主页 / 新对话等无用户消息：仅保留顶部时钟（CSS .is-empty），大纲与箭头隐藏。
      root.classList.add("is-empty");
      const li = document.createElement("li");
      li.className = "chrono-nav-toc-item chrono-nav-toc-empty";
      li.textContent = t("noMessages");
      tocBootstrapped = true;
      prevUserNodeCount = 0;
      // 新对话 / 清空：丢弃持久缓存，避免相同 index+文本在不同会话间串味。
      tocMetaCache.clear();
      ul.appendChild(li);
      syncMessageTracking([]);
      updateFabState();
      return true;
    }
    root.classList.remove("is-empty");
    assignPendingTimesToRows(rows);
    prevUserNodeCount = nodes.length;
    tocBootstrapped = true;

    rows.forEach((row, index) => {
      const { node, parsed, pendingHhmm } = row;
      const fullText = getMessageText(node);
      const timeDisplay = parsed.hadStamp
        ? formatTierTime(parsed.ymd, parsed.hhmm)
        : pendingHhmm || null;
      const cacheKey = `${index}\u0000${fullText}`;
      const meta = ensureNodeMeta(node, index, timeDisplay, cacheKey);
      const li = document.createElement("li");
      li.className = "chrono-nav-toc-item toc-item";
      li.dataset.chronoNodeKey = String(index);
      li.style.setProperty("--chrono-node-color", meta.color);
      messageToTocLi.set(node, li);

      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "chrono-nav-toc-btn";

      const nodeDot = document.createElement("span");
      nodeDot.className = "chrono-nav-toc-node";
      nodeDot.setAttribute("aria-hidden", "true");

      const content = document.createElement("span");
      content.className = "chrono-nav-toc-content";

      const time = document.createElement("span");
      time.className = "chrono-nav-toc-time";
      if (meta.timeDisplay) {
        time.textContent = meta.timeDisplay;
      } else {
        time.classList.add("chrono-nav-toc-time--hidden");
        time.setAttribute("aria-hidden", "true");
      }

      const label = document.createElement("span");
      label.className = "chrono-nav-toc-label";
      // 仅做一个宽松的安全上限，真正的视觉截断交给 CSS 的单行 ellipsis（按侧栏像素宽度自适应，
      // 中英文都按“能放多少像素”截断，不再被固定字符数卡死）。
      label.textContent = truncatePreviewText(fullText, 80);

      content.appendChild(time);
      content.appendChild(label);
      btn.appendChild(nodeDot);
      btn.appendChild(content);
      // 不设原生 title：侧栏是导航器，点击跳转后在主聊天区读全文（与 ChatGPT / Grok 一致）。
      // 仅保留 aria-label 供屏幕阅读器读出完整内容，不退化无障碍。
      const accessibleName = fullText || t("jumpToMessage", [String(index + 1)]);
      btn.setAttribute("aria-label", accessibleName);
      btn.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        lockNavTarget(li);
        node.scrollIntoView({ behavior: "smooth", block: "center", inline: "nearest" });
      });
      li.appendChild(btn);
      ul.appendChild(li);
    });
    syncMessageTracking(nodes);
    return true;
  }

  let tocScheduled = false;
  function scheduleToc() {
    if (tocScheduled) return;
    tocScheduled = true;
    requestAnimationFrame(() => {
      tocScheduled = false;
      let tocChanged = false;
      try {
        tocChanged = renderToc() === true;
      } catch (_) {}
      try {
        ensureChatScrollListener();
        if (tocChanged) {
          requestAnimationFrame(() => refreshActiveFromScroll());
        }
      } catch (_) {}
    });
  }

  function startTocObserver() {
    ensureTocRoot();
    const target = getChatRoot();
    const obs = new MutationObserver(() => scheduleToc());
    // characterData 必不可少：刷新时 Gemini 常先插入气泡、再用文本节点更新（characterData）把
    // 带 [System Time:] 的历史正文水合回来。只监听 childList 会漏掉这一步，导致前缀重新泄漏到明文。
    obs.observe(target, { childList: true, subtree: true, characterData: true });
    scheduleToc();
  }

  function boot() {
    // 构建标记：刷新 Gemini 后控制台若能看到该行，说明已加载到最新 content script（用于排查"扩展没真正重载"）。
    try {
      console.info("[ChronoNav] content build 2026-06-26j loaded");
    } catch (_) {}
    bindInputSync();
    startTocObserver();
    startThemeWatcher();
    loadSettings(() => {
      sendSettingsToInject();
      updateInjectStatusUI();
      maybeShowFirstRunNotice();
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot, { once: true });
  } else {
    boot();
  }
})();
