const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { test } = require('node:test');

const source = fs.readFileSync(path.join(__dirname, '..', 'content.js'), 'utf8');
const start = source.indexOf('  function getRawMessageText(el) {');
const end = source.indexOf('  const SYSTEM_TIME_ONLY_RE', start);
assert(start >= 0 && end > start);
const getRawMessageText = vm.runInNewContext(
  source.slice(start, end) + '\ngetRawMessageText',
);

function message(lines, screenReaderText) {
  const inner = {
    innerText: screenReaderText + '\n' + lines.map(line => line.visibleText).join('\n'),
    querySelectorAll: selector => selector === 'p.query-text-line' ? lines : [],
  };
  return {
    querySelector: selector => selector === 'div.query-content' ? inner : null,
    innerText: inner.innerText,
  };
}

test('Gemini screen-reader heading does not duplicate the visible prompt', () => {
  const raw = getRawMessageText(message(
    [{ textContent: 'You said hello', visibleText: 'You said hello' }],
    'You said hello',
  ));
  assert.equal(raw, 'You said hello');
});

test('hidden System Time line remains readable after page reload', () => {
  const raw = getRawMessageText(message(
    [
      { textContent: '[System Time: 2026-10-28 12:34 +08:00]', visibleText: '' },
      { textContent: 'A new prompt', visibleText: 'A new prompt' },
    ],
    'A new prompt',
  ));
  assert.equal(raw, '[System Time: 2026-10-28 12:34 +08:00]\nA new prompt');
});
