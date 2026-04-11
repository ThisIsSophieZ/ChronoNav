/**
 * Gemini ChronoNav — Content Script（隔离世界）
 * 1. 注入 inject.js 到主世界以拦截网络载荷并追加系统时间（界面不显示）。
 * 2. 同步输入框文本供 inject 匹配；拦截发送相关事件以保持 lastPrompt 准确。
 * 3. MutationObserver + 右侧 TOC，点击平滑滚动至对应用户消息节点。
 */

(function () {
  const EVT = "chrono-nav-prompt-sync";
  const ROOT_ID = "chrono-nav-toc-root";

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

  function getPromptEditors() {
    const selectors = [
      'div[contenteditable="true"][aria-label*="Enter a prompt"]',
      'div[contenteditable="true"][aria-label*="prompt"]',
      'div[contenteditable="true"][data-placeholder]',
      "rich-textarea div[contenteditable=\"true\"]",
      'div.ql-editor[contenteditable="true"]',
    ];
    const set = new Set();
    for (const sel of selectors) {
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

  function bindInputSync() {
    const onInput = (e) => {
      const t = e.target;
      if (t && t.getAttribute && t.getAttribute("contenteditable") === "true") {
        syncPromptText(readEditorText(t));
      }
    };
    document.addEventListener("input", onInput, true);
    document.addEventListener("keyup", onInput, true);
    document.addEventListener("compositionend", onInput, true);

    const onSendHint = () => {
      const eds = getPromptEditors();
      if (eds.length) syncPromptText(readEditorText(eds[0]));
    };

    document.addEventListener(
      "keydown",
      (e) => {
        if (e.key === "Enter" && !e.shiftKey) onSendHint();
      },
      true
    );
    document.addEventListener("click", onSendHint, true);
  }

  /** ---------- TOC ---------- */

  function findUserMessageNodes() {
    /** Gemini 网页端用户轮次多为 <user-query>，正文在 div.query-content */
    const nodes = Array.from(document.querySelectorAll("user-query"));
    const list = nodes.filter((el) => el.getClientRects().length > 0);
    list.sort((a, b) => {
      const ra = a.getBoundingClientRect().top;
      const rb = b.getBoundingClientRect().top;
      return ra - rb;
    });
    return list;
  }

  function snippetFromNode(el) {
    const inner = el.querySelector("div.query-content");
    const raw = (inner ? inner.innerText : el.innerText) || el.textContent || "";
    const cleaned = raw.replace(/^you said\s+/i, "").replace(/\s+/g, " ").trim();
    if (!cleaned) return "(空)";
    const head = cleaned.slice(0, 20);
    return cleaned.length > 20 ? head + "…" : head;
  }

  function ensureTocRoot() {
    let root = document.getElementById(ROOT_ID);
    if (root) return root;
    root = document.createElement("div");
    root.id = ROOT_ID;
    root.setAttribute("data-chrono-nav", "toc");
    root.innerHTML =
      '<div class="chrono-nav-toc-panel">' +
      '<p class="chrono-nav-toc-title">对话大纲</p>' +
      '<ul class="chrono-nav-toc-list" id="chrono-nav-toc-list"></ul>' +
      "</div>";
    document.documentElement.appendChild(root);
    return root;
  }

  function renderToc() {
    const root = ensureTocRoot();
    const ul = root.querySelector("#chrono-nav-toc-list");
    if (!ul) return;
    const nodes = findUserMessageNodes();
    ul.innerHTML = "";
    if (!nodes.length) {
      const li = document.createElement("li");
      li.className = "chrono-nav-toc-item chrono-nav-toc-empty";
      li.textContent = "暂无用户消息";
      ul.appendChild(li);
      return;
    }
    nodes.forEach((node, index) => {
      const li = document.createElement("li");
      li.className = "chrono-nav-toc-item";
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "chrono-nav-toc-btn";
      btn.textContent = snippetFromNode(node);
      btn.title = "跳转到第 " + (index + 1) + " 条用户消息";
      btn.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        node.scrollIntoView({ behavior: "smooth", block: "center", inline: "nearest" });
      });
      li.appendChild(btn);
      ul.appendChild(li);
    });
  }

  let tocScheduled = false;
  function scheduleToc() {
    if (tocScheduled) return;
    tocScheduled = true;
    requestAnimationFrame(() => {
      tocScheduled = false;
      try {
        renderToc();
      } catch (_) {}
    });
  }

  function startTocObserver() {
    ensureTocRoot();
    const target =
      document.querySelector("main") ||
      document.querySelector('[role="main"]') ||
      document.body;
    const obs = new MutationObserver(() => scheduleToc());
    obs.observe(target, { childList: true, subtree: true, characterData: true });
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
