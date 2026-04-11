/**
 * 页面主世界（MAIN world）：拦截 fetch / XHR，在匹配到「当前输入框文本」的字符串载荷上
 * 静默前置 [System Time: YYYY-MM-DD HH:mm:ss]。
 * 与 content script 通过 CustomEvent「chrono-nav-prompt-sync」同步 lastPrompt。
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
    if (
      url.includes("google.com") &&
      (url.includes("Bard") ||
        url.includes("Generative") ||
        url.includes("generativelanguage"))
    ) {
      return true;
    }
    return false;
  }

  function prependToText(text) {
    if (typeof text !== "string" || !text.length) return text;
    const trimmed = text.trim();
    const lp = (lastPrompt || "").trim();
    if (!lp || trimmed !== lp) return text;
    const p = formatPrefix();
    if (text.startsWith(p)) return text;
    return p + "\n" + text;
  }

  function walkJson(value, seen) {
    if (value === null || value === undefined) return value;
    if (typeof value === "string") return prependToText(value);
    if (typeof value !== "object") return value;
    if (seen.has(value)) return value;
    seen.add(value);
    if (Array.isArray(value)) {
      for (let i = 0; i < value.length; i++) {
        value[i] = walkJson(value[i], seen);
      }
      return value;
    }
    for (const k of Object.keys(value)) {
      value[k] = walkJson(value[k], seen);
    }
    return value;
  }

  function augmentBodyString(bodyStr) {
    if (bodyStr == null || bodyStr === "") return bodyStr;
    try {
      const parsed = JSON.parse(bodyStr);
      const seen = new WeakSet();
      walkJson(parsed, seen);
      return JSON.stringify(parsed);
    } catch {
      return prependToText(bodyStr);
    }
  }

  function augmentBody(body) {
    if (body == null) return body;
    if (typeof body === "string") return augmentBodyString(body);
    if (body instanceof URLSearchParams) {
      const next = new URLSearchParams(body.toString());
      for (const [k, v] of next.entries()) {
        next.set(k, augmentBodyString(v));
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
      if (method === "GET" || method === "HEAD" || !shouldAugment(req.url)) {
        return origFetch.call(this, input, init);
      }
      return req.clone().text().then((t) => {
        if (init && Object.prototype.hasOwnProperty.call(init, "body")) {
          if (typeof init.body === "string") {
            return origFetch.call(this, input, {
              ...init,
              body: augmentBodyString(init.body),
            });
          }
          return origFetch.call(this, input, init);
        }
        const nb = augmentBodyString(t);
        return origFetch.call(this, new Request(req, { body: nb }), init);
      });
    }

    const mergedInit = init || {};
    if (!shouldAugment(url)) {
      return origFetch.call(this, input, mergedInit);
    }
    const method = (mergedInit.method || "GET").toUpperCase();
    if (method === "GET" || method === "HEAD") {
      return origFetch.call(this, input, mergedInit);
    }
    let body = mergedInit.body;
    if (body == null) {
      return origFetch.call(this, input, mergedInit);
    }
    if (typeof body === "string" || body instanceof URLSearchParams) {
      const next = { ...mergedInit, body: augmentBody(body) };
      return origFetch.call(this, input, next);
    }
    if (typeof Blob !== "undefined" && body instanceof Blob) {
      return body.text().then((t) => {
        const next = { ...mergedInit, body: augmentBodyString(t) };
        return origFetch.call(this, input, next);
      });
    }
    return origFetch.call(this, input, mergedInit);
  };

  const origOpen = XMLHttpRequest.prototype.open;
  XMLHttpRequest.prototype.open = function (method, url) {
    try {
      this.__chronoNavUrl = typeof url === "string" ? url : "";
    } catch (_) {
      this.__chronoNavUrl = "";
    }
    return origOpen.apply(this, arguments);
  };

  const origSend = XMLHttpRequest.prototype.send;
  XMLHttpRequest.prototype.send = function (body) {
    const u = this.__chronoNavUrl || "";
    if (shouldAugment(u) && body != null && typeof body === "string") {
      return origSend.call(this, augmentBodyString(body));
    }
    return origSend.apply(this, arguments);
  };
})();
