// The New Tab's visible order: the wallpaper first, then the content entering.
const assert = require('assert');
const vm = require('vm');
const { readStylesheet } = require('../helpers/css-tokens');
const { parseCss, parsePageCss } = require('../helpers/css-rules');
const { moduleScript } = require('../helpers/module-script');

const newtabCss = parsePageCss('newtab.html');
const glassCss = parseCss(readStylesheet('src/newtab/glass-style.css'));

// A clock the test moves by hand. The lead is a 60ms window, and on a busy
// machine building the module or a 20ms wait on real timers can take longer
// than that, so real time would decide the outcome instead of the code.
function createClock() {
  let now = 1000;
  let nextId = 1;
  const timers = new Map();
  const flush = () => new Promise((resolve) => setImmediate(resolve));
  return {
    performance: { now: () => now },
    setTimeout(callback, ms) {
      const id = nextId++;
      timers.set(id, { at: now + Math.max(0, Number(ms) || 0), callback });
      return id;
    },
    clearTimeout(id) {
      timers.delete(id);
    },
    async advance(ms) {
      const end = now + ms;
      await flush();
      for (;;) {
        let next = null;
        timers.forEach((timer, id) => {
          if (timer.at <= end && (!next || timer.at < next.timer.at)) {
            next = { id, timer };
          }
        });
        if (!next) {
          break;
        }
        timers.delete(next.id);
        now = next.timer.at;
        next.timer.callback();
        await flush();
      }
      now = end;
    }
  };
}

function createElement() {
  const attributes = new Map();
  return {
    attributes,
    getAttribute: (name) => (attributes.has(name) ? attributes.get(name) : null),
    setAttribute: (name, value) => attributes.set(name, String(value)),
    removeAttribute: (name) => attributes.delete(name)
  };
}

function createEntryMotion({ wallpaperActive, wallpaperShownAgoMs, focusResume }) {
  const body = createElement();
  const root = createElement();
  const documentElement = createElement();
  if (focusResume) {
    documentElement.setAttribute('data-nt-focus-resume', 'true');
  }
  if (wallpaperActive) {
    body.setAttribute('data-wallpaper-active', 'true');
  }
  const clock = createClock();
  const pageState = {
    wallpaperShownAt: wallpaperShownAgoMs === null ? 0 : clock.performance.now() - wallpaperShownAgoMs
  };
  const sandbox = {
    document: { body, documentElement },
    window: { setTimeout: clock.setTimeout, clearTimeout: clock.clearTimeout },
    requestAnimationFrame: (callback) => clock.setTimeout(callback, 0),
    performance: clock.performance,
    globalThis: null
  };
  sandbox.globalThis = sandbox;
  vm.runInNewContext(moduleScript('src/newtab/entry-motion.ts', 'LumnoNewtabEntryMotion'), sandbox, { filename: 'src/newtab/entry-motion.ts' });
  const viewport = { width: 1280, height: 800 };
  const motion = sandbox.LumnoNewtabEntryMotion.createEntryMotion({
    root,
    pageState,
    shouldSkipNewtabEntryMotion: () => false,
    updateBookmarkSectionPosition() {},
    finishWordmarkEntryAnimation() {},
    rememberSearchEntryViewport() {},
    getSearchEntryViewportSnapshot: () => viewport,
    hasSearchEntryViewportChanged: () => false,
    viewport: { revision: 0, locked: false, store: { getSnapshot: () => ({ revision: 0, locked: false }), subscribe: () => () => {} } },
    onEntryDone() {}
  });
  return { body, clock, motion, pageState };
}

async function testContentWaitsForTheWallpaperLead() {
  const fresh = createEntryMotion({ wallpaperActive: true, wallpaperShownAgoMs: 0 });
  fresh.motion.markNewtabReady();
  await fresh.clock.advance(20);
  assert.strictEqual(fresh.body.getAttribute('data-nt-ready'), null,
    'content shown right after the wallpaper waits, so the two never land in one moment');
  assert.strictEqual(fresh.body.getAttribute('data-nt-ready'), null, 'the second request waits for the same lead');
  fresh.motion.markNewtabReady();
  await fresh.clock.advance(80);
  assert.strictEqual(fresh.body.getAttribute('data-nt-ready'), '1', 'the content enters once the wallpaper has led');
  assert.strictEqual(fresh.body.getAttribute('data-nt-enter'), 'run');

  const settled = createEntryMotion({ wallpaperActive: true, wallpaperShownAgoMs: 400 });
  settled.motion.markNewtabReady();
  await settled.clock.advance(5);
  assert.strictEqual(settled.body.getAttribute('data-nt-ready'), '1',
    'a wallpaper that showed long ago adds no wait');

  const plain = createEntryMotion({ wallpaperActive: false, wallpaperShownAgoMs: 0 });
  plain.motion.markNewtabReady();
  await plain.clock.advance(5);
  assert.strictEqual(plain.body.getAttribute('data-nt-ready'), '1', 'without a wallpaper nothing has to lead');

  const resumed = createEntryMotion({ wallpaperActive: true, wallpaperShownAgoMs: 0, focusResume: true });
  resumed.motion.markNewtabReady();
  await resumed.clock.advance(5);
  assert.strictEqual(resumed.body.getAttribute('data-nt-ready'), '1',
    'the search shortcut reload holds the old page until this one is ready, so it skips the lead');

  const unknown = createEntryMotion({ wallpaperActive: true, wallpaperShownAgoMs: null });
  unknown.motion.markNewtabReady();
  await unknown.clock.advance(5);
  assert.strictEqual(unknown.body.getAttribute('data-nt-ready'), '1');
}

async function testEffectPreloadRecordsWhenTheWallpaperShowed() {
  const body = createElement();
  const sandbox = {
    document: { documentElement: createElement(), body },
    window: {},
    performance,
    LumnoNewtabWallpaperEffects: {
      createWallpaperEffects: () => ({ apply() {}, refresh: () => Promise.resolve() }),
      resolvePrefsForMode: () => ({ type: 'none' })
    },
    __lumnoBoot: { wallpaperPreload: {
      effectPrefsReady: Promise.resolve({ type: 'none' }),
      imageUrl: 'chrome-extension://abc/assets/wallpapers/test.webp',
      wallpaper: { id: 'test' }
    } },
    globalThis: null
  };
  sandbox.globalThis = sandbox;
  const before = performance.now();
  vm.runInNewContext(moduleScript('src/newtab/wallpaper/wallpaper-effect-preload.ts', undefined, null, {
    'src/newtab/wallpaper/wallpaper-effects.ts': 'LumnoNewtabWallpaperEffects'
  }), sandbox, { filename: 'src/newtab/wallpaper/wallpaper-effect-preload.ts' });
  await Promise.resolve();
  await Promise.resolve();
  assert.strictEqual(body.getAttribute('data-nt-wallpaper-ready'), '1');
  const shownAt = sandbox.__lumnoBoot?.wallpaperEffectPreload.wallpaperShownAt;
  assert.ok(shownAt >= before && shownAt <= performance.now(), 'the reveal time is what the entry measures its lead from');
}

// That the reveal also waits for the first wallpaper tone sample needs a
// decoded wallpaper image, which only a browser provides.

function testSampledColorsSnapUntilTheEntryIsDone() {
  assert.strictEqual(newtabCss.rule('body:not([data-nt-enter="done"]) .x-nt-shortcut-icon').get('transition'), 'none',
    'the add tile takes its sampled color at once instead of fading through the wallpaper\'s gray');
  assert.strictEqual(glassCss.rule('body[data-glass-style]:not([data-nt-enter="done"]) :is(.x-nt-shortcut-icon, .x-nt-shortcut-group-header)').get('transition'), 'none',
    'glass shortcut plates take their sampled tint at once during the entry too');
}

function testNoBlurredStandInForTheWallpaper() {
  const declared = newtabCss.entries.flatMap((entry) => Array.from(entry.style)).concat(newtabCss.selectors());
  ['--x-nt-wallpaper-placeholder', '--x-nt-wallpaper-backdrop', 'data-wallpaper-placeholder'].forEach((name) => {
    assert.ok(!declared.some((item) => item.includes(name)), `the New Tab never shows a blurred copy of its wallpaper (${name})`);
  });
}

function testNothingBlursTheWallpaperBeforeTheReveal() {
  ['', '::before', '::after'].forEach((pseudo) => {
    const rule = newtabCss.rule(`body:not([data-nt-ready="1"]) :is(*, #_x_extension_newtab_root_2024_unique_)${pseudo}`);
    assert.ok(rule && rule.get('backdrop-filter') === 'none' && rule.priority('backdrop-filter') === 'important',
      `hidden cards must not show their blur over the wallpaper before the page is revealed (${pseudo || 'element'})`);
  });
}

(async () => {
  testNoBlurredStandInForTheWallpaper();
  testNothingBlursTheWallpaperBeforeTheReveal();
  await testContentWaitsForTheWallpaperLead();
  await testEffectPreloadRecordsWhenTheWallpaperShowed();
  testSampledColorsSnapUntilTheEntryIsDone();
  console.log('newtab entry wallpaper lead tests passed');
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
