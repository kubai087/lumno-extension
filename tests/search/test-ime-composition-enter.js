const assert = require('assert');
const path = require('path');

const repoRoot = path.resolve(__dirname, '..', '..');
const guardPath = path.join(repoRoot, 'src/domain/search/ime-key-guard.ts');
const guard = require(guardPath);
const { parseCss } = require('../helpers/css-rules');
const { SURFACES, openSearchSurface } = require('../helpers/search-surfaces');
const { readStylesheet } = require('../helpers/css-tokens');
const { getInjectedScripts, getPageScripts, runsBefore } = require('../helpers/runtime-scripts');

function createClock(start) {
  let current = start;
  return {
    now() {
      return current;
    },
    tick(ms) {
      current += ms;
    }
  };
}

const clock = createClock(1000);
const input = { nodeName: 'INPUT' };
const otherInput = { nodeName: 'INPUT' };
const imeGuard = guard.createImeKeyGuard({ now: clock.now, commitEnterIgnoreMs: 120 });

imeGuard.markCompositionStart({ target: input });
assert.strictEqual(
  imeGuard.shouldIgnoreKeydown({ key: 'a', target: input }),
  true,
  'guard should ignore keydown while an IME composition is active'
);

imeGuard.markCompositionEnd({ target: input });
assert.strictEqual(
  imeGuard.shouldIgnoreKeydown({
    key: 'Enter',
    keyCode: 13,
    which: 13,
    isComposing: false,
    target: input
  }),
  true,
  'guard should ignore the Enter keydown that commits raw IME text after compositionend'
);

assert.strictEqual(
  imeGuard.shouldIgnoreKeydown({
    key: 'Enter',
    keyCode: 13,
    which: 13,
    isComposing: false,
    target: otherInput
  }),
  false,
  'guard should not suppress Enter on an unrelated target'
);

clock.tick(121);
assert.strictEqual(
  imeGuard.shouldIgnoreKeydown({
    key: 'Enter',
    keyCode: 13,
    which: 13,
    isComposing: false,
    target: input
  }),
  false,
  'guard should allow deliberate Enter after the composition commit window'
);

imeGuard.markCompositionStart({ target: input });
imeGuard.markCompositionEnd({ target: input });
imeGuard.markKeyUp();
assert.strictEqual(
  imeGuard.shouldIgnoreKeydown({
    key: 'Enter',
    keyCode: 13,
    which: 13,
    isComposing: false,
    target: input
  }),
  false,
  'guard should allow Enter right after the key that committed the IME text is released'
);

imeGuard.markCompositionStart({ target: input });
imeGuard.markKeyUp();
assert.strictEqual(
  imeGuard.isComposing(),
  true,
  'keyup during a composition should not end it'
);
imeGuard.markCompositionEnd({ target: input });

assert.ok(
  runsBefore(getPageScripts('newtab.html'), 'src/domain/search/ime-key-guard.ts', 'src/newtab/app/main.ts'),
  'New Tab should load the IME key guard before newtab.js'
);
assert.ok(
  runsBefore(getInjectedScripts('overlay'), 'src/domain/search/ime-key-guard.ts', 'src/overlay/app/main.ts'),
  'overlay injection should load the IME key guard before the overlay entry'
);

const newtabRoot = parseCss(readStylesheet('src/newtab/styles/page.css')).rule('#_x_extension_newtab_root_2024_unique_');
assert.notStrictEqual(newtabRoot.get('visibility'), 'hidden',
  'the New Tab search box should stay focusable before the page is ready so early keys reach the IME');

// On both surfaces, the Enter that commits an IME candidate does not search.
async function testSurfaceIgnoresTheCommitEnter(name) {
  const surface = await openSearchSurface(name);
  const input = surface.input();
  const composition = (type) => surface.page.trusted(input, type, { bubbles: true, composed: true, data: '你' });
  composition('compositionstart');
  input.value = 'ni';
  input.dispatchEvent(new surface.window.Event('input', { bubbles: true }));
  await surface.settle(60);
  surface.press('Enter', { isComposing: true, keyCode: 229 });
  await surface.settle(60);
  assert.strictEqual(surface.navigation(), null, `${name}: Enter while composing should pick the candidate, not search`);
  input.value = '你';
  composition('compositionend');
  surface.press('Enter', { keyCode: 13 });
  await surface.settle(60);
  assert.strictEqual(surface.navigation(), null, `${name}: the Enter that ends the composition should not search either`);
  surface.keyup('Enter', { keyCode: 13 });
  surface.press('Enter', { keyCode: 13 });
  await surface.settle(120);
  assert.deepStrictEqual(surface.navigation(), { search: '你' }, `${name}: the next Enter should search`);
  surface.close();
}

(async () => {
  for (const name of SURFACES) {
    await testSurfaceIgnoresTheCommitEnter(name);
  }
  console.log('IME composition Enter tests passed');
  process.exit(0);
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
