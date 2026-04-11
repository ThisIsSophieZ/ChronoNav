/**
 * Gemini ChronoNav — Content Script（隔离世界）
 * 1. 注入 inject.js 到主世界以拦截网络载荷并追加系统时间（界面不显示）。
 * 2. 同步输入框文本供 inject 匹配；拦截发送相关事件以保持 lastPrompt 准确。
 * 3. MutationObserver + 右侧 TOC，点击平滑滚动至对应用户消息节点。
 */

(function () {
  const EVT = "chrono-nav-prompt-sync";
  const ROOT_ID = "chrono-nav-toc-root";
  const TOC_LIST_ID = "chrono-nav-toc-list";
  const TOGGLE_ID = "chrono-nav-toc-toggle";
  const COLLAPSED_CLASS = "is-collapsed";
  const IDLE_CLASS = "is-idle";
  /** 鼠标离开侧栏后延迟收起为极简点阵 */
  const IDLE_LEAVE_MS = 1500;
  const STORAGE_KEY = "chrono-nav-toc-collapsed";
  const FAB_UP_ID = "chrono-nav-fab-up";
  const FAB_DOWN_ID = "chrono-nav-fab-down";
  const GOOGLE_NODE_COLORS = ["#4285F4", "#EA4335", "#FBBC05", "#34A853"];

  /** 视口追踪：User 节点 → 侧栏 li.toc-item（高亮仅在主聊天区滚动时刷新） */
  const messageToTocLi = new WeakMap();
  let trackedMessageNodes = [];
  let chatScrollEl = null;
  let chatScrollRaf = 0;

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
  let tocBootstrapped = false;
  let prevUserNodeCount = 0;

  /** 与 inject.js 一致：[System Time: YYYY-MM-DD HH:mm:ss]，允许前缀前空白与 ] 后换行 */
  const SYSTEM_TIME_PREFIX_RE =
    /^\s*\[System Time:\s*(\d{4})-(\d{2})-(\d{2})\s+(\d{2}):(\d{2}):(\d{2})\]\s*\n?/i;

  function injectMainWorld() {
    const src = chrome.runtime.getURL("inject.js");
    const s = document.createElement("script");
    s.src = src;
    s.onload = () => s.remove();
    (document.documentElement || document.head).appendChild(s);
  }

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

  function syncPromptText(text) {
    window.dispatchEvent(
      new CustomEvent(EVT, {
        detail: { text: text == null ? "" : String(text) },
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
   * 从原始文本解析注入的时间戳；有则返回 HH:mm 与剥离后的正文。
   * 无匹配则视为历史或其它数据，不使用 new Date() 伪造时间。
   */
  function parseLeadingSystemTime(raw) {
    const s = String(raw || "");
    const m = s.match(SYSTEM_TIME_PREFIX_RE);
    if (!m) {
      return {
        hadStamp: false,
        hhmm: null,
        stripped: s.replace(/\s+/g, " ").trim(),
      };
    }
    const hhmm = `${m[4]}:${m[5]}`;
    const rest = s.slice(m[0].length);
    return {
      hadStamp: true,
      hhmm,
      stripped: rest.replace(/\s+/g, " ").trim(),
    };
  }

  function getRawMessageText(el) {
    const inner =
      el.querySelector("div.query-content") ||
      el.querySelector('[data-content="user-message"]') ||
      el.querySelector("message-content");
    return (inner ? inner.innerText : el.innerText) || el.textContent || "";
  }

  /**
   * 若主聊天区回显了 [System Time: ...]，从 DOM 中剥离，避免用户看到。
   */
  function stripSystemTimePrefixFromDom(userEl) {
    if (!userEl || userEl.dataset.chronoUiPrefixStripped === "1") return;
    const inner =
      userEl.querySelector("div.query-content") ||
      userEl.querySelector('[data-content="user-message"]') ||
      userEl.querySelector("message-content") ||
      userEl;
    const raw = inner.innerText != null ? inner.innerText : inner.textContent || "";
    if (!SYSTEM_TIME_PREFIX_RE.test(raw)) return;

    function stripFromTextNode(textNode) {
      const t = textNode.textContent || "";
      const m = t.match(SYSTEM_TIME_PREFIX_RE);
      if (!m) return false;
      textNode.textContent = t.slice(m[0].length);
      return true;
    }

    function walk(el) {
      for (const child of el.childNodes) {
        if (child.nodeType === Node.TEXT_NODE) {
          if (stripFromTextNode(child)) return true;
        } else if (child.nodeType === Node.ELEMENT_NODE) {
          if (walk(child)) return true;
        }
      }
      return false;
    }

    if (walk(inner)) {
      userEl.dataset.chronoUiPrefixStripped = "1";
      return;
    }

    const normalized = raw.replace(/\s+/g, " ").trim();
    const parsed = parseLeadingSystemTime(normalized);
    if (parsed.hadStamp) {
      if (inner.innerText != null) {
        inner.innerText = parsed.stripped;
      } else {
        inner.textContent = parsed.stripped;
      }
      userEl.dataset.chronoUiPrefixStripped = "1";
    }
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

  function bindInputSync() {
    const onInput = (e) => {
      const t = e.target;
      if (
        t &&
        t.getAttribute &&
        t.getAttribute("contenteditable") === "true" &&
        matchesSelectorList(t, EDITOR_SELECTORS)
      ) {
        syncPromptText(readEditorText(t));
      }
    };
    document.addEventListener("input", onInput, true);
    document.addEventListener("keyup", onInput, true);
    document.addEventListener("compositionend", onInput, true);
    document.addEventListener("paste", onInput, true);

    const onSendHint = () => {
      const editor = getPrimaryEditor();
      if (!editor) return;
      const text = readEditorText(editor);
      syncPromptText(text);
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
    let body = parsed.stripped;
    body = body
      .replace(/^you said\s+/i, "")
      .replace(/^你说[:：]?\s*/i, "")
      .replace(/\s+/g, " ")
      .trim();
    return body;
  }

  function truncatePreviewText(text, maxChars) {
    const clean = normalizePromptText(text);
    if (!clean) return "(空)";
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
  function ensureNodeMeta(node, index, timeDisplay) {
    let meta = nodeMetaMap.get(node);
    if (!meta) {
      meta = {
        timeDisplay,
        color: GOOGLE_NODE_COLORS[index % GOOGLE_NODE_COLORS.length],
      };
      nodeMetaMap.set(node, meta);
    } else if (!meta.timeDisplay && timeDisplay) {
      meta.timeDisplay = timeDisplay;
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
    toggle.setAttribute("title", collapsed ? "展开大纲" : "收起大纲");
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
    root.addEventListener("chrono-nav-idle-reset", expandFromIdle);
  }

  function ensureFabMarkup(root) {
    const panel = root.querySelector(".chrono-nav-toc-panel");
    if (!panel || panel.querySelector(".chrono-nav-toc-fab-wrap")) return;
    const wrap = document.createElement("div");
    wrap.className = "chrono-nav-toc-fab-wrap";
    wrap.innerHTML =
      `<button type="button" class="chrono-nav-toc-fab" id="${FAB_UP_ID}" aria-label="上一条用户消息">⬆️</button>` +
      `<button type="button" class="chrono-nav-toc-fab" id="${FAB_DOWN_ID}" aria-label="下一条用户消息">⬇️</button>`;
    panel.appendChild(wrap);
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
    scrollToMessageIndex(idx);
  }

  function bindStepNav(root) {
    if (!root || root.dataset.chronoStepBound === "1") return;
    root.dataset.chronoStepBound = "1";
    root.addEventListener("click", (e) => {
      const t = e.target;
      if (!(t instanceof HTMLElement)) return;
      if (t.id === FAB_UP_ID) {
        e.preventDefault();
        stepNav(-1);
      } else if (t.id === FAB_DOWN_ID) {
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
  function refreshActiveFromScroll() {
    const ul = getTocListEl();
    if (!ul) return;
    const nodes =
      trackedMessageNodes.length > 0 ? trackedMessageNodes : findUserMessageNodes();
    if (!nodes.length) {
      ul.querySelectorAll("li.toc-item").forEach((li) => li.classList.remove("is-active"));
      updateFabState();
      return;
    }
    const viewH = window.innerHeight;
    const bandTop = viewH * 0.08;
    const bandBottom = viewH - viewH * 0.12;
    let best = null;
    let bestRatio = -1;
    for (let i = 0; i < nodes.length; i++) {
      const n = nodes[i];
      const r = n.getBoundingClientRect();
      const visibleTop = Math.max(r.top, bandTop);
      const visibleBottom = Math.min(r.bottom, bandBottom);
      const visible = Math.max(0, visibleBottom - visibleTop);
      const height = Math.max(1, r.height);
      const ratio = visible / height;
      if (ratio > bestRatio) {
        bestRatio = ratio;
        best = n;
      }
    }
    ul.querySelectorAll("li.toc-item").forEach((li) => li.classList.remove("is-active"));
    if (best && bestRatio > 0.001) {
      const li = messageToTocLi.get(best);
      if (li) li.classList.add("is-active");
    }
    updateFabState();
  }

  function syncMessageTracking(nodes) {
    trackedMessageNodes = nodes.slice();
    ensureChatScrollListener();
  }

  function ensureTocRoot() {
    let root = document.getElementById(ROOT_ID);
    if (root) {
      ensureFabMarkup(root);
      bindToggle(root);
      applyCollapsedState(root, isTocCollapsed());
      bindIdleAutoCollapse(root);
      bindStepNav(root);
      return root;
    }
    root = document.createElement("div");
    root.id = ROOT_ID;
    root.setAttribute("data-chrono-nav", "toc");
    root.innerHTML =
      '<div class="chrono-nav-toc-panel">' +
      `<button type="button" class="chrono-nav-toc-toggle" id="${TOGGLE_ID}" aria-label="切换大纲"></button>` +
      '<ul class="chrono-nav-toc-list" id="chrono-nav-toc-list"></ul>' +
      '<div class="chrono-nav-toc-fab-wrap">' +
      `<button type="button" class="chrono-nav-toc-fab" id="${FAB_UP_ID}" aria-label="上一条用户消息">⬆️</button>` +
      `<button type="button" class="chrono-nav-toc-fab" id="${FAB_DOWN_ID}" aria-label="下一条用户消息">⬇️</button>` +
      "</div>" +
      "</div>";
    document.documentElement.appendChild(root);
    bindToggle(root);
    applyCollapsedState(root, isTocCollapsed());
    bindIdleAutoCollapse(root);
    bindStepNav(root);
    return root;
  }

  function renderToc() {
    const root = ensureTocRoot();
    const ul = root.querySelector(`#${TOC_LIST_ID}`);
    if (!ul) return false;
    const nodes = findUserMessageNodes();
    for (let i = 0; i < nodes.length; i++) {
      stripSystemTimePrefixFromDom(nodes[i]);
    }
    const signature = computeTocSignature(nodes);
    if (signature === lastTocSignature) return false;
    lastTocSignature = signature;
    ul.innerHTML = "";
    if (!nodes.length) {
      const li = document.createElement("li");
      li.className = "chrono-nav-toc-item chrono-nav-toc-empty";
      li.textContent = "暂无用户消息";
      tocBootstrapped = true;
      prevUserNodeCount = 0;
      ul.appendChild(li);
      syncMessageTracking([]);
      updateFabState();
      return true;
    }
    const rows = nodes.map((node) => {
      const raw = getRawMessageText(node);
      return { node, raw, parsed: parseLeadingSystemTime(raw), pendingHhmm: null };
    });
    assignPendingTimesToRows(rows);
    prevUserNodeCount = nodes.length;
    tocBootstrapped = true;

    rows.forEach((row, index) => {
      const { node, parsed, pendingHhmm } = row;
      const fullText = getMessageText(node);
      const timeDisplay = parsed.hadStamp && parsed.hhmm ? parsed.hhmm : pendingHhmm || null;
      const meta = ensureNodeMeta(node, index, timeDisplay);
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
      label.textContent = truncatePreviewText(fullText, 20);

      content.appendChild(time);
      content.appendChild(label);
      btn.appendChild(nodeDot);
      btn.appendChild(content);
      btn.title = fullText || "跳转到第 " + (index + 1) + " 条用户消息";
      btn.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
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
    obs.observe(target, { childList: true, subtree: true });
    scheduleToc();
  }

  function boot() {
    bindInputSync();
    startTocObserver();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot, { once: true });
  } else {
    boot();
  }
})();
