// Run with: node scripts/test-prompt-snapshot.cjs
// Execute the real event handlers and request wrappers with a small browser mock.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { test } = require('node:test');

const root = path.resolve(__dirname, '..');
const inject = fs.readFileSync(path.join(root, 'inject.js'), 'utf8');
const source = fs.readFileSync(path.join(root, 'content.js'), 'utf8');
const bootStart = source.lastIndexOf('  if (document.readyState === "loading")');
assert(bootStart > 0);
// Skip sidebar boot only; input and settings handlers remain the actual source.
const content = source.slice(0, bootStart) +
  'globalThis.api={bindInputSync,loadSettings,sendSettingsToInject};})();';
const prompt = '请只回复收到。测试编号 CN101-TIME-01。';

function setup(mainFirst = true) {
  const events = {}, documentEvents = {}, sent = [];
  const attributes = {};
  let now = 100000;
  let storageListener;
  const stored = { timeInjectionEnabled: true, timePrecision: 'minute' };
  const editor = {
    innerText: prompt,
    getAttribute: key => key === 'contenteditable' ? 'true' : null,
    matches: () => true, contains: () => false, getClientRects: () => [{}],
  };
  const document = {
    body: { querySelectorAll: () => [] }, querySelector: () => null,
    documentElement: {
      appendChild: () => { if (mainFirst) vm.runInContext(inject, context); },
      setAttribute: (key, value) => { attributes[key] = value; },
    },
    createElement: () => ({ remove() {} }),
    addEventListener: (key, fn) => (documentEvents[key] ??= []).push(fn),
    querySelectorAll: () => [editor], getElementById: () => null, activeElement: editor,
  };
  class XHR {
    open() {}
    setRequestHeader() {}
    send(body) { sent.push(body); }
  }
  const window = {
    addEventListener: (key, fn) => (events[key] ??= []).push(fn),
    dispatchEvent: event => (events[event.type] || []).forEach(fn => fn(event)),
    fetch: async (input, init) => { sent.push(init?.body ?? await input.text()); },
  };
  const context = vm.createContext({
    window, document, XMLHttpRequest: XHR, URL, URLSearchParams, Request, console,
    Date: class extends Date { static now() { return now; } },
    location: { href: 'https://gemini.google.com/app/test' },
    CustomEvent: class { constructor(type, options = {}) { this.type = type; this.detail = options.detail; } },
    chrome: {
      runtime: { getURL: () => 'inject.js' },
      storage: {
        local: { get: (keys, cb) => cb(stored) },
        onChanged: { addListener: fn => { storageListener = fn; } },
      },
    },
  });
  vm.runInContext(content, context);
  if (!mainFirst) vm.runInContext(inject, context);
  context.api.bindInputSync();
  context.api.loadSettings(context.api.sendSettingsToInject);
  const event = (key, value) => (documentEvents[key] || []).forEach(fn => fn(value));
  return {
    sent,
    diagnostics() { return JSON.parse(attributes['data-chrono-requests'] || '[]'); },
    input(text) { editor.innerText = text; event('input', { target: editor }); },
    send(mode) {
      if (mode === 'enter') event('keydown', { key: 'Enter', shiftKey: false });
      else event('click', { target: { closest: () => ({
        getAttribute: key => key === 'aria-label' ? 'Send message' : null, textContent: '',
      }) } });
    },
    advance(ms) { now += ms; },
    enabled(value) {
      stored.timeInjectionEnabled = value;
      storageListener({ timeInjectionEnabled: { newValue: value } }, 'local');
    },
    async request(text = prompt, mode = 'fetch', type = 'application/x-www-form-urlencoded') {
      const url = 'https://gemini.google.com/_/BardChatUi/data/assistant.lamda.BardFrontendService/StreamGenerate';
      const body = 'f.req=' + encodeURIComponent(JSON.stringify([null, JSON.stringify([[text, text]])])) + '&at=SAFE%2Btoken';
      if (mode === 'xhr') {
        const xhr = new XHR(); xhr.open('POST', url); xhr.setRequestHeader('Content-Type', type); xhr.send(body);
      } else if (mode === 'request') {
        await window.fetch(new Request(url, { method: 'POST', headers: { 'Content-Type': type }, body }));
      } else {
        await window.fetch(url, { method: 'POST', headers: { 'Content-Type': type }, body });
      }
      const output = sent.at(-1);
      assert(output.endsWith('&at=SAFE%2Btoken'));
      return decodeURIComponent(output);
    },
  };
}

for (const mainFirst of [true, false]) {
  for (const trigger of ['enter', 'click']) {
    for (const transport of ['fetch', 'xhr', 'request']) {
      test(`${mainFirst ? 'early' : 'late'} main script / ${trigger} / ${transport}: clear before request`, async () => {
        const e = setup(mainFirst);
        e.input(prompt); e.send(trigger); e.input('');
        const body = await e.request(prompt, transport);
        assert.equal((body.match(/\[System Time:/g) || []).length, 1);
        assert(body.indexOf('[System Time:') > body.indexOf(prompt));
        assert(!(await e.request()).includes('[System Time:'));
      });
    }
  }
}
test('normal send consumes snapshot even if editor still contains text', async () => {
  const e = setup(); e.input(prompt); e.send('click');
  e.input(prompt); // Keyup/input can repeat the same text before clearing.
  assert((await e.request()).includes('[System Time:'));
  assert(!(await e.request()).includes('[System Time:'));
});
test('unmatched request does not consume snapshot; new draft does not replace it', async () => {
  const e = setup(); e.input(prompt); e.send('enter'); e.input('next draft');
  assert(!(await e.request('unrelated')).includes('[System Time:'));
  assert((await e.request()).includes('[System Time:'));
});
test('expired snapshot cannot reuse repeated editor text', async () => {
  const e = setup(); e.input(prompt); e.send('enter'); e.input(prompt); e.advance(30000);
  assert(!(await e.request()).includes('[System Time:'));
});
test('empty follow-up send event preserves the original snapshot', async () => {
  const e = setup(); e.input(prompt); e.send('enter'); e.input(''); e.send('click');
  assert((await e.request()).includes('[System Time:'));
});
test('snapshot expires after the editor has cleared', async () => {
  const e = setup(); e.input(prompt); e.send('click'); e.input(''); e.advance(30000);
  assert(!(await e.request()).includes('[System Time:'));
});
test('switching off clears snapshot; switching back on does not resurrect it', async () => {
  const e = setup(); e.input(prompt); e.send('click'); e.enabled(false);
  assert(!(await e.request()).includes('[System Time:'));
  e.enabled(true);
  assert(!(await e.request()).includes('[System Time:'));
  e.input(prompt); e.send('click');
  assert((await e.request()).includes('[System Time:'));
});
test('sending while off creates no snapshot', async () => {
  const e = setup(); e.enabled(false); e.input(prompt); e.send('click'); e.enabled(true);
  assert(!(await e.request()).includes('[System Time:'));
});
test('multipart is unchanged and does not consume snapshot', async () => {
  const e = setup(); e.input(prompt); e.send('click'); e.input('');
  assert(!(await e.request(prompt, 'fetch', 'multipart/form-data')).includes('[System Time:'));
  assert.equal(e.diagnostics().at(-1).skipped, 'content-type');
  assert((await e.request()).includes('[System Time:'));
});
test('an explicit resend of identical text gets its own snapshot', async () => {
  const e = setup();
  for (let i = 0; i < 2; i++) {
    e.input(prompt); e.send('click'); e.input('');
    assert((await e.request()).includes('[System Time:'));
  }
});

test('a request before any input or send snapshot remains unchanged', async () => {
  const e = setup();
  assert(!(await e.request()).includes('[System Time:'));
  assert.equal(e.diagnostics().at(-1).snapshot, 'none');
  assert.equal(e.diagnostics().at(-1).draftAvailable, false);
  assert.equal(e.diagnostics().at(-1).changed, false);
});

test('a genuinely different prompt leaf remains unchanged without consuming the snapshot', async () => {
  const e = setup(); e.input(prompt); e.send('click');
  assert(!(await e.request('extra context: ' + prompt)).includes('[System Time:'));
  assert.equal(e.diagnostics().at(-1).snapshot, 'live');
  assert.equal(e.diagnostics().at(-1).matched, false);
  assert((await e.request()).includes('[System Time:'));
});

test('an extra JSON-string encoding around the prompt leaf still receives a time marker', async () => {
  const e = setup(); e.input(prompt); e.send('click'); e.input('');
  assert((await e.request(JSON.stringify(prompt))).includes('[System Time:'));
  assert.equal(e.diagnostics().at(-1).matched, true);
  assert.equal(e.diagnostics().at(-1).changed, true);
});

test('input draft can match a request even before an explicit send snapshot', async () => {
  const e = setup(); e.input(prompt);
  assert((await e.request()).includes('[System Time:'));
  assert.equal(e.diagnostics().at(-1).snapshot, 'none');
  assert.equal(e.diagnostics().at(-1).draftAvailable, true);
});

test('request diagnostics are bounded and exclude prompt, token, URL, and payload content', async () => {
  const e = setup(); e.input(prompt); e.send('click');
  await e.request();
  for (let i = 0; i < 25; i++) await e.request('unrelated private text');
  const reports = e.diagnostics();
  assert.equal(reports.length, 20);
  const json = JSON.stringify(reports);
  for (const secret of [prompt, 'unrelated private text', 'SAFE', 'gemini.google.com', 'f.req']) {
    assert(!json.includes(secret));
  }
});
