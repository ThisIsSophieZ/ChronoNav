/**
 * 页面主世界（MAIN world）：保守拦截 fetch / XHR，
 * 仅对明确的 JSON / 文本请求体做一次性时间锚点注入，避免破坏附件上传或二进制请求。
 */
(function () {
  const EVT = "chrono-nav-prompt-sync";
  const SETTINGS_EVT = "chrono-nav-settings";
  const READY_EVT = "chrono-nav-inject-ready";
  const TIME_CONTEXT_START = "[System Time: ";

  let lastPrompt = "";
  let pendingPrompt = null;
  const PENDING_PROMPT_TTL_MS = 30000;
  let activeMatchDiagnostic = null;
  const recentRequestDiagnostics = [];

  /**
   * 注入设置由隔离世界的 content.js 经 chrome.storage 读出后通过事件下发。
   * 这里默认 fail-closed（enabled=false）：在收到设置前绝不注入，与「默认关」一致，
   * 也避免设置尚未抵达就偷改了请求。
   */
  const settings = { enabled: false, precision: "minute" };

  window.addEventListener(
    SETTINGS_EVT,
    (e) => {
      if (!e || !e.detail) return;
      if (typeof e.detail.enabled === "boolean") settings.enabled = e.detail.enabled;
      if (!settings.enabled) {
        lastPrompt = "";
        pendingPrompt = null;
      }
      if (e.detail.precision === "minute" || e.detail.precision === "second") {
        settings.precision = e.detail.precision;
      }
    },
    true
  );

  // 通知 content.js：主世界已就绪，请把当前设置发过来（解决脚本加载先后竞态）。
  try {
    window.dispatchEvent(new CustomEvent(READY_EVT));
  } catch (_) {}

  /** 仅数字 UTC 偏移（如 +08:00 / -05:00），不含 IANA 城市名，避免暴露具体地区。 */
  function formatTzOffset(d) {
    // getTimezoneOffset() 返回 UTC - 本地（分钟），东区为负，故取反
    const offsetMin = -d.getTimezoneOffset();
    const sign = offsetMin >= 0 ? "+" : "-";
    const abs = Math.abs(offsetMin);
    const pad = (n) => String(n).padStart(2, "0");
    return sign + pad(Math.floor(abs / 60)) + ":" + pad(abs % 60);
  }

  function formatTimeContext() {
    const d = new Date();
    const pad = (n) => String(n).padStart(2, "0");
    let ts =
      d.getFullYear() +
      "-" +
      pad(d.getMonth() + 1) +
      "-" +
      pad(d.getDate()) +
      " " +
      pad(d.getHours()) +
      ":" +
      pad(d.getMinutes());
    // 仅在用户选择秒级精度时附加秒；默认分钟级以降低暴露发送习惯的颗粒度。
    if (settings.precision === "second") {
      ts += ":" + pad(d.getSeconds());
    }
    return TIME_CONTEXT_START + ts + " " + formatTzOffset(d) + "]";
  }

  function normalizeText(text) {
    return String(text || "").replace(/\u200b/g, "").replace(/\s+/g, " ").trim();
  }

  window.addEventListener(
    EVT,
    (e) => {
      if (e && e.detail && typeof e.detail.text === "string") {
        if (!settings.enabled) return;
        if (e.detail.sending === true) {
          const text = normalizeText(e.detail.text);
          // Empty follow-up send events must not erase an in-flight snapshot.
          if (text) pendingPrompt = { text, expiresAt: Date.now() + PENDING_PROMPT_TTL_MS };
          lastPrompt = "";
          return;
        }
        lastPrompt = e.detail.text;
      }
    },
    true
  );

  function shouldAugment(url) {
    if (!url || typeof url !== "string") return false;
    // Gemini 可能用相对 URL（如 /_/BardChatUi/data/batchexecute）发请求，
    // 先按当前页面解析成绝对 URL，避免相对路径漏判导致不注入。
    let abs = url;
    try {
      abs = new URL(url, location.href).href;
    } catch (_) {}
    if (abs.includes("gemini.google.com")) return true;
    return (
      abs.includes("google.com") &&
      (abs.includes("Bard") ||
        abs.includes("Generative") ||
        abs.includes("generativelanguage"))
    );
  }

  function getHeaderValue(headers, name) {
    if (!headers) return "";
    const lowerName = name.toLowerCase();
    if (typeof headers.get === "function") {
      return headers.get(name) || headers.get(lowerName) || "";
    }
    if (Array.isArray(headers)) {
      const pair = headers.find((entry) => {
        return Array.isArray(entry) && String(entry[0]).toLowerCase() === lowerName;
      });
      return pair ? pair[1] : "";
    }
    if (typeof headers === "object") {
      for (const key of Object.keys(headers)) {
        if (key.toLowerCase() === lowerName) {
          return headers[key];
        }
      }
    }
    return "";
  }

  function isSupportedContentType(contentType) {
    const value = String(contentType || "").toLowerCase();
    if (!value) return true;
    if (value.includes("multipart/form-data")) return false;
    if (value.includes("application/octet-stream")) return false;
    return (
      value.includes("application/json") ||
      value.includes("text/plain") ||
      value.includes("application/x-www-form-urlencoded")
    );
  }

  function requestDiagnostic(body, transport) {
    const pathname = location.pathname || new URL(location.href).pathname;
    return {
      transport,
      route: pathname === "/app" ? "new-chat" : /^\/app\/[^/]+$/.test(pathname) ? "conversation" : "other",
      enabled: settings.enabled,
      snapshot: !pendingPrompt ? "none" : Date.now() >= pendingPrompt.expiresAt ? "expired" : "live",
      draftAvailable: !!normalizeText(lastPrompt),
      bodyType: body instanceof URLSearchParams ? "url-search-params" : typeof body,
      candidateStrings: 0, matched: false, changed: false,
    };
  }

  function publishRequestDiagnostic(report) {
    // Keep only structural outcomes in this page. Never expose prompt text,
    // URLs, chat IDs, tokens, timestamps, or request/response payloads.
    recentRequestDiagnostics.push(report);
    if (recentRequestDiagnostics.length > 20) recentRequestDiagnostics.shift();
    try {
      document.documentElement.setAttribute("data-chrono-requests", JSON.stringify(recentRequestDiagnostics));
    } catch (_) {}
  }

  function traceBodyRewrite(body, transport, rewrite) {
    const report = requestDiagnostic(body, transport);
    const previous = activeMatchDiagnostic;
    activeMatchDiagnostic = report;
    try {
      const result = rewrite(body);
      report.changed = body instanceof URLSearchParams ? result.toString() !== body.toString() : result !== body;
      return result;
    } finally {
      activeMatchDiagnostic = previous;
      publishRequestDiagnostic(report);
    }
  }

  function traceSkippedRequest(body, transport, method, url, contentType) {
    if (method === "GET" || method === "HEAD" || !shouldAugment(url)) return;
    const report = requestDiagnostic(body, transport);
    report.skipped = !settings.enabled ? "disabled" :
      !isSupportedContentType(contentType) ? "content-type" : "unsupported-or-missing-body";
    publishRequestDiagnostic(report);
  }

  function appendToPrompt(text, state) {
    if (state.done || typeof text !== "string" || !text.length) return text;
    if (activeMatchDiagnostic) activeMatchDiagnostic.candidateStrings++;
    if (pendingPrompt && Date.now() >= pendingPrompt.expiresAt) {
      if (normalizeText(lastPrompt) === pendingPrompt.text) lastPrompt = "";
      pendingPrompt = null;
    }
    // Editor updates (including clearing the composer) cannot overwrite a send.
    const normalizedPrompt = pendingPrompt ? pendingPrompt.text : normalizeText(lastPrompt);
    const normalizedText = normalizeText(text);
    if (!normalizedPrompt || normalizedText !== normalizedPrompt) return text;
    if (activeMatchDiagnostic) activeMatchDiagnostic.matched = true;
    state.done = true;
    pendingPrompt = null;
    if (normalizeText(lastPrompt) === normalizedPrompt) lastPrompt = "";
    // Keep the user's words first so Gemini's generated chat title is more
    // likely to summarize the prompt instead of the time context.
    return text + "\n\n" + formatTimeContext();
  }

  /**
   * 仅当字符串看起来像被 JSON.stringify 过的容器/字符串时才尝试解析，
   * 避免对普通文本做无谓的 JSON.parse。返回解析结果或 undefined。
   */
  function tryParseJson(str) {
    if (typeof str !== "string") return undefined;
    const trimmed = str.trim();
    if (trimmed.length < 2) return undefined;
    const first = trimmed[0];
    if (first !== "[" && first !== "{" && first !== '"') return undefined;
    try {
      return JSON.parse(str);
    } catch {
      return undefined;
    }
  }

  /**
   * 深度遍历：Gemini 的 prompt 被 JSON.stringify 包裹多层（f.req 内层、batchexecute 信封等），
   * 普通遍历到第一层字符串就停了。这里在「叶子未命中」时再尝试把字符串当作内嵌 JSON 解析并递归，
   * 命中后逐层重新 stringify 回去，从而钻到真正的 prompt 叶子。
   */
  function walkJson(value, state, seen) {
    if (value === null || value === undefined || state.done) return value;
    if (typeof value === "string") {
      const matched = appendToPrompt(value, state);
      if (state.done) return matched;
      const nested = tryParseJson(value);
      if (nested !== null && (typeof nested === "object" || typeof nested === "string")) {
        const augmented = walkJson(nested, state, seen);
        if (state.done) return JSON.stringify(augmented);
      }
      return value;
    }
    if (typeof value !== "object") return value;
    if (seen.has(value)) return value;
    seen.add(value);

    if (Array.isArray(value)) {
      for (let i = 0; i < value.length; i++) {
        value[i] = walkJson(value[i], state, seen);
        if (state.done) break;
      }
      return value;
    }

    for (const key of Object.keys(value)) {
      value[key] = walkJson(value[key], state, seen);
      if (state.done) break;
    }
    return value;
  }

  /** 把一段「JSON 或被编码为 JSON 的字符串」做时间注入；命中返回新串，否则原样返回。 */
  function augmentJsonLike(str) {
    if (typeof str !== "string" || !str.length) return str;
    const state = { done: false };
    const parsed = tryParseJson(str);
    if (parsed !== null && (typeof parsed === "object" || typeof parsed === "string")) {
      const augmented = walkJson(parsed, state, new WeakSet());
      return state.done ? JSON.stringify(augmented) : str;
    }
    const next = appendToPrompt(str, state);
    return state.done ? next : str;
  }

  /**
   * Gemini 走 batchexecute / StreamGenerate，body 为 `f.req=<urlencoded JSON>&at=<token>`。
   * 仅解析并改写 f.req 字段，其余字段（尤其 at CSRF token）保持字节不变，最大限度降低风险。
   */
  function augmentFormUrlEncoded(bodyStr) {
    const parts = bodyStr.split("&");
    for (let i = 0; i < parts.length; i++) {
      const eq = parts[i].indexOf("=");
      if (eq < 0) continue;
      if (parts[i].slice(0, eq) !== "f.req") continue;
      const rawVal = parts[i].slice(eq + 1);
      let decoded;
      try {
        decoded = decodeURIComponent(rawVal.replace(/\+/g, " "));
      } catch {
        return bodyStr;
      }
      const augmented = augmentJsonLike(decoded);
      if (augmented === decoded) return bodyStr;
      parts[i] = "f.req=" + encodeURIComponent(augmented);
      return parts.join("&");
    }
    return bodyStr;
  }

  function rewriteBodyString(bodyStr) {
    if (bodyStr == null || bodyStr === "") return bodyStr;
    if (/(^|&)f\.req=/.test(bodyStr)) {
      return augmentFormUrlEncoded(bodyStr);
    }
    return augmentJsonLike(bodyStr);
  }

  function augmentBodyString(bodyStr, transport = "fetch-request") {
    return traceBodyRewrite(bodyStr, transport, rewriteBodyString);
  }

  function augmentBody(body, transport = "fetch") {
    return traceBodyRewrite(body, transport, rewriteBody);
  }

  function rewriteBody(body) {
    if (body == null) return body;
    if (typeof body === "string") return rewriteBodyString(body);
    if (body instanceof URLSearchParams) {
      const next = new URLSearchParams(body.toString());
      if (next.has("f.req")) {
        const value = next.get("f.req");
        const augmented = augmentJsonLike(value);
        if (augmented !== value) next.set("f.req", augmented);
        return next;
      }
      for (const [key, value] of next.entries()) {
        const augmented = augmentJsonLike(value);
        if (augmented !== value) {
          next.set(key, augmented);
          break;
        }
      }
      return next;
    }
    return body;
  }

  const origFetch = window.fetch;
  window.fetch = function (input, init) {
    let url = "";
    if (typeof input === "string") url = input;
    else if (input && typeof input === "object" && "url" in input) url = input.url;

    if (typeof input === "object" && input instanceof Request) {
      const req = input;
      const method = (req.method || "GET").toUpperCase();
      const contentType = getHeaderValue(init && init.headers, "content-type") || req.headers.get("content-type");

      if (
        !settings.enabled ||
        method === "GET" ||
        method === "HEAD" ||
        !shouldAugment(req.url) ||
        !isSupportedContentType(contentType)
      ) {
        traceSkippedRequest(init && init.body, "fetch-request", method, req.url, contentType);
        return origFetch.call(this, input, init);
      }

      if (init && Object.prototype.hasOwnProperty.call(init, "body")) {
        if (typeof init.body === "string" || init.body instanceof URLSearchParams) {
          return origFetch.call(this, input, {
            ...init,
            body: augmentBody(init.body, "fetch-request"),
          });
        }
        traceSkippedRequest(init.body, "fetch-request", method, req.url, contentType);
        return origFetch.call(this, input, init);
      }

      return req.clone().text().then((text) => {
        const nextBody = augmentBodyString(text);
        if (nextBody === text) {
          return origFetch.call(this, input, init);
        }
        return origFetch.call(this, new Request(req, { body: nextBody }), init);
      });
    }

    const mergedInit = init || {};
    const method = (mergedInit.method || "GET").toUpperCase();
    const contentType = getHeaderValue(mergedInit.headers, "content-type");

    if (
      !settings.enabled ||
      method === "GET" ||
      method === "HEAD" ||
      !shouldAugment(url) ||
      !isSupportedContentType(contentType) ||
      mergedInit.body == null
    ) {
      traceSkippedRequest(mergedInit.body, "fetch", method, url, contentType);
      return origFetch.call(this, input, mergedInit);
    }

    if (typeof mergedInit.body === "string" || mergedInit.body instanceof URLSearchParams) {
      const nextBody = augmentBody(mergedInit.body);
      return origFetch.call(this, input, { ...mergedInit, body: nextBody });
    }

    traceSkippedRequest(mergedInit.body, "fetch", method, url, contentType);
    return origFetch.call(this, input, mergedInit);
  };

  const origOpen = XMLHttpRequest.prototype.open;
  XMLHttpRequest.prototype.open = function (method, url) {
    this.__chronoNavMethod = String(method || "GET").toUpperCase();
    this.__chronoNavUrl = typeof url === "string" ? url : "";
    this.__chronoNavContentType = "";
    return origOpen.apply(this, arguments);
  };

  const origSetRequestHeader = XMLHttpRequest.prototype.setRequestHeader;
  XMLHttpRequest.prototype.setRequestHeader = function (name, value) {
    if (String(name || "").toLowerCase() === "content-type") {
      this.__chronoNavContentType = String(value || "");
    }
    return origSetRequestHeader.apply(this, arguments);
  };

  const origSend = XMLHttpRequest.prototype.send;
  XMLHttpRequest.prototype.send = function (body) {
    const method = this.__chronoNavMethod || "GET";
    const url = this.__chronoNavUrl || "";
    const contentType = this.__chronoNavContentType || "";

    if (
      !settings.enabled ||
      method === "GET" ||
      method === "HEAD" ||
      !shouldAugment(url) ||
      !isSupportedContentType(contentType) ||
      typeof body !== "string"
    ) {
      traceSkippedRequest(body, "xhr", method, url, contentType);
      return origSend.apply(this, arguments);
    }

    const nextBody = augmentBodyString(body, "xhr");
    return origSend.call(this, nextBody);
  };
})();
