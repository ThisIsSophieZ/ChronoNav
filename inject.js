/**
 * 页面主世界（MAIN world）：保守拦截 fetch / XHR，
 * 仅对明确的 JSON / 文本请求体做一次性时间锚点注入，避免破坏附件上传或二进制请求。
 */
(function () {
  const EVT = "chrono-nav-prompt-sync";
  const PREFIX_FMT = "[System Time: ";

  let lastPrompt = "";

  function formatPrefix() {
    const d = new Date();
    const pad = (n) => String(n).padStart(2, "0");
    const ts =
      d.getFullYear() +
      "-" +
      pad(d.getMonth() + 1) +
      "-" +
      pad(d.getDate()) +
      " " +
      pad(d.getHours()) +
      ":" +
      pad(d.getMinutes()) +
      ":" +
      pad(d.getSeconds());
    return PREFIX_FMT + ts + "]";
  }

  function normalizeText(text) {
    return String(text || "").replace(/\u200b/g, "").replace(/\s+/g, " ").trim();
  }

  window.addEventListener(
    EVT,
    (e) => {
      if (e && e.detail && typeof e.detail.text === "string") {
        lastPrompt = e.detail.text;
      }
    },
    true
  );

  function shouldAugment(url) {
    if (!url || typeof url !== "string") return false;
    if (url.includes("gemini.google.com")) return true;
    return (
      url.includes("google.com") &&
      (url.includes("Bard") ||
        url.includes("Generative") ||
        url.includes("generativelanguage"))
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

  function prependToPrompt(text, state) {
    if (state.done || typeof text !== "string" || !text.length) return text;
    const normalizedPrompt = normalizeText(lastPrompt);
    const normalizedText = normalizeText(text);
    if (!normalizedPrompt || normalizedText !== normalizedPrompt) return text;
    const prefix = formatPrefix();
    if (text.startsWith(prefix)) {
      state.done = true;
      return text;
    }
    state.done = true;
    return prefix + "\n" + text;
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
      const matched = prependToPrompt(value, state);
      if (state.done) return matched;
      const nested = tryParseJson(value);
      if (nested !== null && typeof nested === "object") {
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
    if (parsed !== null && typeof parsed === "object") {
      const augmented = walkJson(parsed, state, new WeakSet());
      return state.done ? JSON.stringify(augmented) : str;
    }
    const next = prependToPrompt(str, state);
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

  function augmentBodyString(bodyStr) {
    if (bodyStr == null || bodyStr === "") return bodyStr;
    if (/(^|&)f\.req=/.test(bodyStr)) {
      return augmentFormUrlEncoded(bodyStr);
    }
    return augmentJsonLike(bodyStr);
  }

  function augmentBody(body) {
    if (body == null) return body;
    if (typeof body === "string") return augmentBodyString(body);
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
        method === "GET" ||
        method === "HEAD" ||
        !shouldAugment(req.url) ||
        !isSupportedContentType(contentType)
      ) {
        return origFetch.call(this, input, init);
      }

      if (init && Object.prototype.hasOwnProperty.call(init, "body")) {
        if (typeof init.body === "string" || init.body instanceof URLSearchParams) {
          return origFetch.call(this, input, {
            ...init,
            body: augmentBody(init.body),
          });
        }
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
      method === "GET" ||
      method === "HEAD" ||
      !shouldAugment(url) ||
      !isSupportedContentType(contentType) ||
      mergedInit.body == null
    ) {
      return origFetch.call(this, input, mergedInit);
    }

    if (typeof mergedInit.body === "string" || mergedInit.body instanceof URLSearchParams) {
      const nextBody = augmentBody(mergedInit.body);
      return origFetch.call(this, input, { ...mergedInit, body: nextBody });
    }

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
      method === "GET" ||
      method === "HEAD" ||
      !shouldAugment(url) ||
      !isSupportedContentType(contentType) ||
      typeof body !== "string"
    ) {
      return origSend.apply(this, arguments);
    }

    const nextBody = augmentBodyString(body);
    return origSend.call(this, nextBody);
  };
})();
