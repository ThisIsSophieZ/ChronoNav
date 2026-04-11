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

  function walkJson(value, state, seen) {
    if (value === null || value === undefined || state.done) return value;
    if (typeof value === "string") return prependToPrompt(value, state);
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

  function augmentBodyString(bodyStr) {
    if (bodyStr == null || bodyStr === "") return bodyStr;

    const state = { done: false };
    try {
      const parsed = JSON.parse(bodyStr);
      walkJson(parsed, state, new WeakSet());
      return state.done ? JSON.stringify(parsed) : bodyStr;
    } catch {
      const nextText = prependToPrompt(bodyStr, state);
      return state.done ? nextText : bodyStr;
    }
  }

  function augmentBody(body) {
    if (body == null) return body;
    if (typeof body === "string") return augmentBodyString(body);
    if (body instanceof URLSearchParams) {
      const next = new URLSearchParams(body.toString());
      let replaced = false;
      for (const [key, value] of next.entries()) {
        if (replaced) break;
        const augmented = augmentBodyString(value);
        if (augmented !== value) {
          next.set(key, augmented);
          replaced = true;
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
