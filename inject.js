/**
 * 页面主世界（MAIN world）：保守拦截 fetch / XHR，
 * 仅对明确的 JSON / 文本请求体做一次性时间锚点注入，避免破坏附件上传或二进制请求。
 */
(function () {
  const EVT = "chrono-nav-prompt-sync";
  const SETTINGS_EVT = "chrono-nav-settings";
  const READY_EVT = "chrono-nav-inject-ready";
  const PREFIX_FMT = "[System Time: ";

  let lastPrompt = "";
  let sendingPrompt = "";
  let sendingPromptAt = 0;

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

  function formatPrefix() {
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
    return PREFIX_FMT + ts + " " + formatTzOffset(d) + "]";
  }

  function normalizeText(text) {
    return String(text || "").replace(/\u200b/g, "").replace(/\s+/g, " ").trim();
  }

  window.addEventListener(
    EVT,
    (e) => {
      if (e && e.detail && typeof e.detail.text === "string") {
        lastPrompt = e.detail.text;
        if (e.detail.sending && normalizeText(lastPrompt)) {
          sendingPrompt = lastPrompt;
          sendingPromptAt = Date.now();
        }
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

  function isProcessSessionUrl(url) {
    try {
      const parsed = new URL(url, location.href);
      return (
        parsed.origin === "https://geminiweb-pa.clients6.google.com" &&
        parsed.pathname === "/v1/processSession"
      );
    } catch (_) {
      return false;
    }
  }

  function readVarint(bytes, start) {
    let value = 0;
    for (let i = 0; i < 5 && start + i < bytes.length; i++) {
      const byte = bytes[start + i];
      value += (byte & 0x7f) * 2 ** (7 * i);
      if (!(byte & 0x80)) return { value, next: start + i + 1 };
    }
    return null;
  }

  function writeVarint(value) {
    const result = [];
    do {
      let byte = value % 128;
      value = Math.floor(value / 128);
      if (value) byte |= 0x80;
      result.push(byte);
    } while (value);
    return result;
  }

  function readFields(bytes) {
    const fields = [];
    let cursor = 0;
    while (cursor < bytes.length && fields.length < 128) {
      const tag = readVarint(bytes, cursor);
      if (!tag || !tag.value) return null;
      const wire = tag.value & 7;
      const field = { tag: tag.value, lengthStart: tag.next, valueStart: tag.next };
      if (wire === 0) {
        const value = readVarint(bytes, tag.next);
        if (!value) return null;
        field.varintValue = value.value;
        field.end = value.next;
      } else if (wire === 2) {
        const length = readVarint(bytes, tag.next);
        if (!length || length.value > bytes.length - length.next) return null;
        field.valueStart = length.next;
        field.end = length.next + length.value;
      } else if (wire === 1 || wire === 5) {
        field.end = tag.next + (wire === 1 ? 8 : 4);
        if (field.end > bytes.length) return null;
      } else {
        return null;
      }
      fields.push(field);
      cursor = field.end;
    }
    return cursor === bytes.length ? fields : null;
  }

  function replaceFieldValue(bytes, field, value) {
    const length = Uint8Array.from(writeVarint(value.length));
    const next = new Uint8Array(field.lengthStart + length.length + value.length + bytes.length - field.end);
    next.set(bytes.subarray(0, field.lengthStart));
    next.set(length, field.lengthStart);
    next.set(value, field.lengthStart + length.length);
    next.set(bytes.subarray(field.end), field.lengthStart + length.length + value.length);
    return next;
  }

  function onlyField(fields, tag) {
    const matches = fields.filter((field) => field.tag === tag);
    return matches.length === 1 ? matches[0] : null;
  }

  /**
   * Gemini's plain-text send uses field 2 { field 1 = 1,
   * field 9 { field 1 = prompt } }. Preserve any sibling fields byte-for-byte.
   * Still require the unique prompt leaf to match the editor or send snapshot.
   */
  function augmentProcessSession(bodyStr) {
    const recentSend = Date.now() - sendingPromptAt < 60000 ? sendingPrompt : "";
    if (typeof bodyStr !== "string" || (!lastPrompt && !recentSend)) return bodyStr;
    const parts = bodyStr.split("&");
    const matches = [];
    for (let index = 0; index < parts.length; index++) {
      const key = parts[index].slice(0, parts[index].indexOf("="));
      if (!/^req\d+___data__$/.test(key)) continue;
      try {
        const encoded = decodeURIComponent(parts[index].slice(key.length + 1).replace(/\+/g, " "));
        const bytes = Uint8Array.from(atob(encoded), (char) => char.charCodeAt(0));
        if (bytes.length > 1024 * 1024) continue;
        const rootField = onlyField(readFields(bytes) || [], 18);
        if (!rootField) continue;
        const outer = bytes.subarray(rootField.valueStart, rootField.end);
        const outerFields = readFields(outer);
        if (!outerFields || onlyField(outerFields, 8)?.varintValue !== 1) continue;
        const innerField = onlyField(outerFields, 74);
        if (!innerField) continue;
        const inner = outer.subarray(innerField.valueStart, innerField.end);
        const promptField = onlyField(readFields(inner) || [], 10);
        if (!promptField) continue;
        const prompt = new TextDecoder("utf-8", { fatal: true }).decode(inner.subarray(promptField.valueStart, promptField.end));
        const normalized = normalizeText(prompt);
        if (
          (normalized !== normalizeText(lastPrompt) && normalized !== normalizeText(recentSend)) ||
          /^\s*\[System Time:/i.test(prompt)
        ) continue;
        matches.push({ index, key, bytes, rootField, outer, innerField, inner, promptField, prompt });
      } catch (_) {}
    }
    if (matches.length !== 1) return bodyStr;
    const { index, key, bytes, rootField, outer, innerField, inner, promptField, prompt } = matches[0];
    const promptBytes = new TextEncoder().encode(formatPrefix() + "\n" + prompt);
    const nextInner = replaceFieldValue(inner, promptField, promptBytes);
    const nextOuter = replaceFieldValue(outer, innerField, nextInner);
    const next = replaceFieldValue(bytes, rootField, nextOuter);
    let nextBinary = "";
    for (let i = 0; i < next.length; i += 8192) {
      nextBinary += String.fromCharCode(...next.subarray(i, i + 8192));
    }
    parts[index] = key + "=" + encodeURIComponent(btoa(nextBinary));
    sendingPrompt = "";
    return parts.join("&");
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
        !settings.enabled ||
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
      !settings.enabled ||
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
    const processSession = isProcessSessionUrl(url);

    if (
      !settings.enabled ||
      method === "GET" ||
      method === "HEAD" ||
      !(processSession || shouldAugment(url)) ||
      !isSupportedContentType(contentType) ||
      typeof body !== "string"
    ) {
      return origSend.apply(this, arguments);
    }

    const nextBody = processSession ? augmentProcessSession(body) : augmentBodyString(body);
    return origSend.call(this, nextBody);
  };
})();
