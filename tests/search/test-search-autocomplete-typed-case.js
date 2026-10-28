const assert = require('assert');
const path = require('path');
const { createOverlayPage } = require('../helpers/overlay-runtime-harness');

path.resolve(__dirname, '..', '..');
const { SearchAutocomplete } = require('../../src/shared/search-panel/autocomplete.ts');

// Inline autocomplete appends to what was typed; it must not rewrite the
// typed characters in the candidate's own case ("4A" stays "4A").
function createInput(value) {
  return {
    value,
    selectionStart: value.length,
    selectionEnd: value.length,
    setSelectionRange(start, end) {
      this.selectionStart = start;
      this.selectionEnd = end;
    }
  };
}

const input = createInput('4A');
const { SearchQuery } = require('../../src/shared/search-panel/search-query.ts');
const searchQuery = new SearchQuery();
searchQuery.set('4A');
const autocomplete = new SearchAutocomplete({
  settings: { get: () => 'autocomplete' },
  query: searchQuery,
  getInput: () => input,
  preview: { isActive: () => false },
  isModeActive: () => false,
  getUrlDisplay: (url) => String(url || '').replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, '')
});
autocomplete.apply([{
  type: 'bookmark',
  title: '4A广告网',
  url: 'https://www.4anet.com/'
}], null, 'default');

assert.strictEqual(input.value, '4Anet.com', 'the typed characters should keep their case in the completion');
assert.deepStrictEqual([input.selectionStart, input.selectionEnd], [2, 9], 'only the added text should be selected');
assert.strictEqual(
  autocomplete.state && autocomplete.state.completion,
  '4Anet.com',
  'accepting the completion should keep the typed case too'
);

// The overlay completes the same way.
(async () => {
  const page = await createOverlayPage({
    respond: (message) => (message.action === 'getSearchSuggestions'
      ? { suggestions: [{ type: 'history', title: '4A广告网', url: 'https://www.4anet.com/' }] }
      : undefined)
  });
  await page.open();
  const overlayInput = page.input();
  overlayInput.value = '4A';
  overlayInput.setSelectionRange(2, 2);
  overlayInput.dispatchEvent(new page.window.InputEvent('input', { bubbles: true, inputType: 'insertText', data: 'A' }));
  await page.settle(250);
  assert.deepStrictEqual([overlayInput.value, overlayInput.selectionStart, overlayInput.selectionEnd], ['4Anet.com', 2, 9],
    'the overlay completion should keep the typed case too');
  page.close();
  console.log('Search autocomplete typed case tests passed');
  process.exit(0);
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
