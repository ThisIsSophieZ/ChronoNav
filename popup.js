/**
 * 设置页：读写 chrome.storage.local 中的注入开关与精度。
 * 与 content.js / inject.js 共享同一组键，storage.onChanged 会把变更实时同步到 Gemini 标签页。
 */
(function () {
  const SK_ENABLED = "timeInjectionEnabled";
  const SK_PRECISION = "timePrecision";

  function t(key) {
    try {
      return chrome.i18n.getMessage(key) || key;
    } catch (_) {
      return key;
    }
  }

  function localize() {
    document.querySelectorAll("[data-i18n]").forEach((el) => {
      const msg = t(el.getAttribute("data-i18n"));
      if (msg) el.textContent = msg;
    });
    try {
      document.documentElement.lang = (chrome.i18n.getUILanguage() || "en").split("-")[0];
    } catch (_) {}
  }

  const enabledEl = document.getElementById("enabled");
  const precisionEl = document.getElementById("precision");

  function load() {
    try {
      chrome.storage.local.get([SK_ENABLED, SK_PRECISION], (res) => {
        enabledEl.checked = res && res[SK_ENABLED] === true;
        precisionEl.value = res && res[SK_PRECISION] === "second" ? "second" : "minute";
      });
    } catch (_) {}
  }

  enabledEl.addEventListener("change", () => {
    try {
      chrome.storage.local.set({ [SK_ENABLED]: enabledEl.checked });
    } catch (_) {}
  });

  precisionEl.addEventListener("change", () => {
    try {
      chrome.storage.local.set({
        [SK_PRECISION]: precisionEl.value === "second" ? "second" : "minute",
      });
    } catch (_) {}
  });

  localize();
  load();
})();
