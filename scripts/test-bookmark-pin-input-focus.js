const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
let focusCount = 0;
const pin = { tagName: 'BUTTON', closest: selector => selector.includes('.x-nt-bookmark-pin-action') ? pin : null };
const input = { tagName: 'INPUT', value: '', focus() { focusCount++; documentObj.activeElement = input; }, setSelectionRange() {}, dispatchEvent() {} };
const documentObj = { activeElement: pin, body: {}, documentElement: {} };
const sandbox = { document: documentObj, window: {}, chrome: { runtime: { sendMessage(_message, callback) { callback({ shortcut: '' }); } } }, Date, console, Event: function() {} };
vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../src/newtab/input-focus.js'), 'utf8'), sandbox);
const runtime = sandbox.LumnoNewtabInputFocus.createInputFocus({
  SHORTCUT_KEY_MATCHER: { parseShortcut: () => null }, refreshTabsIfIdle() {},
  initialNewtabInputAutoFocusReadyTask: new Promise(() => {}), isImeCompositionEvent: () => false,
  pageState: { inputParts: { input } }
});
for (const key of ['Enter', ' ']) {
  runtime.handleGlobalTypingFocus({ key, preventDefault() { throw new Error('Pin activation was intercepted'); } });
  assert.equal(documentObj.activeElement, pin);
}
assert.equal(focusCount, 0, 'Keyboard activation stays on the pin');
runtime.handleGlobalTypingFocus({ key: 'a', preventDefault() {} });
assert.equal(documentObj.activeElement, input, 'Normal typing still enters global search');
assert.equal(input.value, 'a');
console.log('Bookmark pin Enter/Space focus isolation and normal global typing passed.');
