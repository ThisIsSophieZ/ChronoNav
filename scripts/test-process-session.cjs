const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { test } = require('node:test');

const source = fs.readFileSync(path.join(__dirname, '..', 'inject.js'), 'utf8');
const endpoint = 'https://geminiweb-pa.clients6.google.com/v1/processSession';

function varint(value) {
  const bytes = [];
  do {
    let byte = value % 128;
    value = Math.floor(value / 128);
    if (value) byte |= 128;
    bytes.push(byte);
  } while (value);
  return Buffer.from(bytes);
}

function envelope(prompt) {
  const text = Buffer.from(prompt, 'utf8');
  const inner = Buffer.concat([Buffer.from([10]), varint(text.length), text]);
  const outer = Buffer.concat([Buffer.from([8, 1, 74]), varint(inner.length), inner]);
  return Buffer.concat([Buffer.from([18]), varint(outer.length), outer]);
}

function body(prompt) {
  return 'count=1&ofs=7&req0___data__=' + encodeURIComponent(envelope(prompt).toString('base64'));
}

function harness() {
  const handlers = new Map();
  const window = {
    addEventListener(name, fn) { handlers.set(name, fn); },
    dispatchEvent(event) { handlers.get(event.type)?.(event); },
    fetch() {},
  };
  class CustomEvent {
    constructor(type, options = {}) { this.type = type; this.detail = options.detail; }
  }
  class XHR {
    open(method, url) { this.method = method; this.url = url; }
    setRequestHeader(name, value) { this.header = [name, value]; }
    send(value) { this.body = value; }
  }
  vm.runInNewContext(source, {
    window, XMLHttpRequest: XHR, CustomEvent, URL, URLSearchParams,
    TextEncoder, TextDecoder, Uint8Array,
    atob: value => Buffer.from(value, 'base64').toString('binary'),
    btoa: value => Buffer.from(value, 'binary').toString('base64'),
    location: { href: 'https://gemini.google.com/app' },
  });
  return {
    send(prompt, payload = body(prompt), url = endpoint) {
      const xhr = new XHR();
      xhr.open('POST', url);
      xhr.setRequestHeader('content-type', 'application/x-www-form-urlencoded');
      xhr.send(payload);
      return xhr.body;
    },
    enable() { window.dispatchEvent(new CustomEvent('chrono-nav-settings', { detail: { enabled: true } })); },
    sync(prompt, sending = false) {
      window.dispatchEvent(new CustomEvent('chrono-nav-prompt-sync', { detail: { text: prompt, sending } }));
    },
  };
}

test('current plain-text processSession request gains a persistent prefix', () => {
  const h = harness();
  const prompt = 'CN-NET-TRACE-20261028-02 Reply OK.';
  // Header observed in the live Chrome request for this exact 34-byte prompt.
  assert.equal(envelope(prompt).subarray(0, 8).toString('hex'), '122808014a240a22');
  h.enable();
  h.sync(prompt);
  const result = h.send(prompt);
  const encoded = new URLSearchParams(result).get('req0___data__');
  const decoded = Buffer.from(encoded, 'base64').toString('utf8');
  assert.match(decoded, /\[System Time: \d{4}-\d{2}-\d{2} \d{2}:\d{2} [+-]\d{2}:\d{2}\]\nCN-NET-TRACE-20261028-02 Reply OK\./);
  assert.equal(new URLSearchParams(result).get('count'), '1');
  assert.equal(new URLSearchParams(result).get('ofs'), '7');
  assert.equal(Buffer.from(encoded, 'base64')[0], 18);
});

test('UTF-8 prompts crossing protobuf varint length boundaries remain intact', () => {
  const h = harness();
  const prompt = '你好 Gemini '.repeat(30);
  h.enable();
  h.sync(prompt);
  const result = h.send(prompt);
  const decoded = Buffer.from(new URLSearchParams(result).get('req0___data__'), 'base64').toString('utf8');
  assert.match(decoded, /\[System Time:/);
  assert.ok(decoded.endsWith(prompt));
});

test('Enter send survives the editor clearing before the XHR starts', () => {
  const h = harness();
  const prompt = 'CN-SMOKE-MANUAL-04';
  h.enable();
  h.sync(prompt, true);
  h.sync(''); // Gemini clears the editor and a keyup/input event follows.
  const result = h.send(prompt);
  const decoded = Buffer.from(new URLSearchParams(result).get('req0___data__'), 'base64').toString('utf8');
  assert.match(decoded, /\[System Time:/);
  assert.ok(decoded.endsWith(prompt));
});

test('disabled, mismatched, malformed, or unrelated requests stay byte-identical', () => {
  const prompt = '你好 Gemini';
  const original = body(prompt);
  const h = harness();
  h.sync(prompt);
  assert.equal(h.send(prompt), original);
  h.enable();
  assert.equal(h.send(prompt, original, 'https://other.google.com/v1/processSession'), original);
  h.sync('a different prompt');
  assert.equal(h.send(prompt), original);
  h.sync(prompt);
  assert.equal(h.send(prompt, 'count=1&req0___data__=invalid%'), 'count=1&req0___data__=invalid%');
});
