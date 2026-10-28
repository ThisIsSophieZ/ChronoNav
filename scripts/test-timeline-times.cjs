// Run with: node --test scripts/test-timeline-times.cjs
// Exercise the real capture, assignment, metadata, and render functions.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { test } = require('node:test');

const source = fs.readFileSync(path.join(__dirname, '..', 'content.js'), 'utf8');
const bootStart = source.lastIndexOf('  if (document.readyState === "loading")');
assert(bootStart > 0);

function element() {
  const classes = new Set();
  return {
    children: [], dataset: {}, style: { setProperty() {} },
    classList: { add: x => classes.add(x), remove: x => classes.delete(x) },
    setAttribute() {}, addEventListener() {},
    appendChild(child) { this.children.push(child); },
    set innerHTML(value) { this.children = []; },
  };
}

function setup() {
  let now = new Date(2026, 9, 28, 10, 1).getTime();
  let nodes = [];
  const ul = element();
  const root = element();
  root.querySelector = () => ul;
  let onSettings;
  const location = { pathname: '/app', search: '' };
  const context = vm.createContext({
    location, console,
    Date: class extends Date {
      constructor(...args) { super(...(args.length ? args : [now])); }
      static now() { return now; }
    },
    document: {
      documentElement: { appendChild() {} }, createElement: element,
    },
    window: { addEventListener() {}, dispatchEvent() {} },
    chrome: {
      runtime: { getURL: () => 'inject.js' },
      storage: { onChanged: { addListener(fn) { onSettings = fn; } } },
    },
    CustomEvent: class {},
    testNodes: () => nodes, testRoot: () => root,
  });
  // Replace browser-only boundaries, not the time or rendering logic under test.
  vm.runInContext(source.slice(0, bootStart) + `
    findUserMessageNodes = testNodes;
    getRawMessageText = node => node.raw;
    ensureTocRoot = testRoot;
    hideSystemTimeInDom = () => {};
    syncMessageTracking = () => {};
    updateFabState = () => {};
    updateInjectStatusUI = () => {};
    currentSettings.enabled = true;
    globalThis.api = {captureSendTime, renderToc};
  })();`, context);
  return {
    send(text) { context.api.captureSendTime(text); },
    add(raw) { nodes.push({ raw }); },
    messages(...raw) { nodes = raw.map(raw => ({ raw })); },
    route(value) { location.pathname = value; },
    advance(ms) { now += ms; },
    enabled(value) { onSettings({ timeInjectionEnabled: { newValue: value } }, 'local'); },
    render() {
      context.api.renderToc();
      return ul.children.map(li => li.children[0]?.children[1]?.children[0]?.textContent ?? null);
    },
  };
}

test('first send before initial render gets a time; later sends also get times', () => {
  const e = setup();
  e.send('first'); e.add('first');
  assert.deepEqual(e.render(), ['10:01']);
  e.advance(60000); e.send('second'); e.add('second');
  assert.deepEqual(e.render(), ['10:01', '10:02']);
  e.advance(60000); e.send('third'); e.add('third');
  assert.deepEqual(e.render(), ['10:01', '10:02', '10:03']);
});

test('first send after an empty render survives the new-chat URL transition', () => {
  const e = setup(); e.render(); e.send('first');
  e.route('/app/new-chat'); e.add('first');
  assert.deepEqual(e.render(), ['10:01']);
});

test('existing identical history is not assigned the new send time at bootstrap', () => {
  const e = setup(); e.messages('repeat'); e.send('repeat');
  assert.deepEqual(e.render(), [null]);
  e.add('repeat');
  assert.deepEqual(e.render(), [null, '10:01']);
});

test('history without a captured send stays untimed', () => {
  const e = setup(); e.messages('old first', 'old second');
  assert.deepEqual(e.render(), [null, null]);
});

test('a captured send does not attach to unrelated new content', () => {
  const e = setup(); e.send('expected'); e.add('unrelated');
  assert.deepEqual(e.render(), [null]);
  e.add('expected');
  assert.deepEqual(e.render(), [null, '10:01']);
});

test('a stamped match consumes its fallback instead of timing older history', () => {
  const e = setup(); e.messages('old'); e.send('new');
  e.add('new\n[System Time: 2026-10-28 09:55 +08:00]');
  assert.deepEqual(e.render(), [null, '09:55']);
  e.add('new');
  assert.deepEqual(e.render(), [null, '09:55', null]);
});

test('expired and cross-conversation sends cannot time later messages', () => {
  const e = setup(); e.render(); e.send('expired'); e.advance(30000); e.add('expired');
  assert.deepEqual(e.render(), [null]);
  e.route('/app/one'); e.messages(); e.send('other');
  e.route('/app/two'); e.add('other');
  assert.deepEqual(e.render(), [null]);
});

test('turning off clears pending sends and permits a fresh identical send after re-enabling', () => {
  const e = setup(); e.send('repeat'); e.enabled(false); e.enabled(true);
  e.add('repeat'); assert.deepEqual(e.render(), [null]);
  e.send('repeat'); e.add('repeat');
  assert.deepEqual(e.render(), [null, '10:01']);
});

test('sending while disabled does not create a fallback', () => {
  const e = setup(); e.enabled(false); e.send('off'); e.enabled(true); e.add('off');
  assert.deepEqual(e.render(), [null]);
});

test('multiple pending sends bind in order, including repeated text', () => {
  const e = setup(); e.send('repeat'); e.advance(2000); e.send('repeat');
  e.add('repeat'); e.add('repeat');
  assert.deepEqual(e.render(), ['10:01', '10:01']);
  e.add('repeat');
  assert.deepEqual(e.render(), ['10:01', '10:01', null]);
});

test('normalization matches line breaks and extra whitespace', () => {
  const e = setup(); e.send('hello\n world'); e.add('hello world');
  assert.deepEqual(e.render(), ['10:01']);
});

test('identical pending sends arriving in separate renders do not reuse the first node', () => {
  const e = setup(); e.send('repeat'); e.advance(2000); e.send('repeat');
  e.route('/app/new-chat');
  e.add('repeat'); assert.deepEqual(e.render(), ['10:01']);
  assert.deepEqual(e.render(), ['10:01']);
  e.advance(5000); e.add('repeat');
  assert.deepEqual(e.render(), ['10:01', '10:01']);
  e.add('repeat');
  assert.deepEqual(e.render(), ['10:01', '10:01', null]);
});

test('captured sends wait for delayed DOM content and survive repeat rendering', () => {
  const e = setup(); e.send('delayed'); e.render(); e.advance(5000); e.add('delayed');
  assert.deepEqual(e.render(), ['10:01']);
  assert.deepEqual(e.render(), ['10:01']);
});
