const assert = require('assert');
const { getInjectedScripts, getPageScripts, runsBefore } = require('../helpers/runtime-scripts');
const { SURFACES, openSearchSurface } = require('../helpers/search-surfaces');

const LumnoSuggestionsHeightLayout = require('../../src/shared/search/suggestions-height-layout.ts');

const runtime = LumnoSuggestionsHeightLayout;

assert.ok(
  runtime && typeof runtime.applyNaturalSuggestionsHeightLayout === 'function',
  'the shared suggestions height runtime should be available'
);

const attributes = new Map([
  ['data-height-clipped', 'true'],
  ['data-input-height-locked', 'true'],
  ['data-resizing', 'true']
]);
const styles = new Map([
  ['flex', { value: '0 0 auto', priority: 'important' }],
  ['height', { value: '580px', priority: 'important' }],
  ['overflow-y', { value: 'hidden', priority: 'important' }],
  ['padding-top', { value: '12px', priority: 'important' }],
  ['transition', { value: 'height 180ms ease-in-out', priority: 'important' }],
  ['will-change', { value: 'height', priority: 'important' }],
  ['max-height', { value: '420px', priority: '' }]
]);
const container = {
  removeAttribute(name) {
    attributes.delete(name);
  },
  style: {
    removeProperty(name) {
      styles.delete(name);
    },
    setProperty(name, value, priority) {
      styles.set(name, { value, priority: priority || '' });
    }
  }
};

assert.strictEqual(runtime.applyNaturalSuggestionsHeightLayout(container), true);
assert.strictEqual(attributes.size, 0, 'legacy height-state attributes should be cleared');
['flex', 'height', 'overflow-y', 'padding-top', 'will-change'].forEach((property) => {
  assert.strictEqual(styles.has(property), false, `${property} should not constrain natural height`);
});
assert.deepStrictEqual(
  styles.get('transition'),
  { value: 'none', priority: 'important' },
  'surface result height transitions should be explicitly disabled'
);
assert.deepStrictEqual(
  styles.get('max-height'),
  { value: '420px', priority: '' },
  'viewport and scope-menu safety caps should remain intact'
);
assert.strictEqual(runtime.applyNaturalSuggestionsHeightLayout(null), false);

assert.ok(
  runsBefore(getPageScripts('newtab.html'), 'src/shared/search/suggestions-height-layout.ts', 'src/newtab/layout.ts') &&
    runsBefore(getPageScripts('newtab.html'), 'src/shared/search/suggestions-height-layout.ts', 'src/newtab/app/main.ts'),
  'New Tab should load the shared height policy before its layout and page runtimes'
);
assert.ok(
  runsBefore(getInjectedScripts('overlay'), 'src/shared/search/suggestions-height-layout.ts', 'src/overlay/search-panel.ts'),
  'Overlay injection should load the shared height policy before the panel runtime'
);
// Both surfaces leave their result list at its natural height.
const CONTAINERS = {
  overlay: '#_x_extension_suggestions_container_2024_unique_',
  newtab: '#_x_extension_newtab_suggestions_container_2024_unique_'
};
const RESULTS = Array.from({ length: 6 }, (_, index) => ({ type: 'history', title: `Result ${index}`, url: `https://r${index}.test/` }));

(async () => {
  for (const name of SURFACES) {
    const surface = await openSearchSurface(name, {
      respond: (message) => (message.action === 'getSearchSuggestions' ? { suggestions: RESULTS } : undefined)
    });
    await surface.type('result');
    await surface.settle(150);
    const style = surface.root.querySelector(CONTAINERS[name]).style;
    assert.deepStrictEqual(['height', 'flex', 'overflow-y', 'will-change'].map((property) => style.getPropertyValue(property)), ['', '', '', ''],
      `${name}: the result list should not be held at a fixed height`);
    assert.strictEqual(style.getPropertyValue('transition'), 'none',
      `${name}: result height changes should not animate`);
    surface.close();
  }
  console.log('shared suggestions natural-height layout tests passed');
  process.exit(0);
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
