const assert = require('node:assert/strict');
const { JSDOM } = require('jsdom');
const { moduleScript } = require('../helpers/module-script');
const { BookmarksShown } = require('../../src/newtab/bookmarks/bookmarks-shown.ts');

function setup() {
  const dom = new JSDOM('<div id="grid"></div>', { runScripts: 'outside-only' });
  const { window } = dom;
  const grid = window.document.getElementById('grid');
  grid.style.columnGap = '12px';
  grid.style.gridTemplateColumns = '200px 200px';
  grid.getBoundingClientRect = () => ({ width: 412 });
  const env = { window, grid, clock: 0, reducedMotion: false, animations: [], timers: [] };
  window.Element.prototype.animate = function(keyframes, options) {
    let resolve;
    const animation = { element: this, keyframes, options, startTime: 0,
      finished: new Promise(done => { resolve = done; }), cancel() { this.cancelled = true; }, resolve: () => resolve() };
    env.animations.push(animation);
    return animation;
  };
  window.setTimeout = (fn, ms) => env.timers.push({ fn, ms, cancelled: false });
  window.clearTimeout = (id) => { if (env.timers[id - 1]) env.timers[id - 1].cancelled = true; };
  env.runTimers = () => env.timers.splice(0).filter(timer => !timer.cancelled).forEach(timer => timer.fn());
  env.pendingTimers = () => env.timers.filter(timer => !timer.cancelled);
  window.LumnoNewtabCrossSurfaceDrag = { prefersReducedMotion: () => env.reducedMotion };
  window.eval(moduleScript('src/newtab/bookmarks/bookmark-pager.ts', 'LumnoNewtabBookmarkPager', null, {
    'src/newtab/cross-surface-drag.ts': 'LumnoNewtabCrossSurfaceDrag'
  }));
  env.state = new BookmarksShown();
  env.state.setItems(Array.from({ length: 8 }, (_, id) => ({ id })));
  env.pager = window.LumnoNewtabBookmarkPager.createBookmarkPager({ bookmarksShown: env.state, bookmarkGrid: grid, now: () => env.clock,
    settings: { get: () => 'grid' }, getBookmarkLimit: () => 2,
    NEWTAB_BOOKMARKS_STORE: { getBookmarkPageItems: (items, page, limit) => items.slice(page * limit, (page + 1) * limit) },
    updateBookmarkHeader() {}, getBookmarkGridColumnCount: () => 2, updateBookmarkSectionPosition() {},
    renderBookmarks(items) {
      // Like React, remove only owned cards, leaving foreign nodes alone.
      [...grid.children].filter(child => child.tagName === 'BUTTON').forEach(card => card.remove());
      grid.append(...items.map(item => {
        const card = window.document.createElement('button');
        card.id = `card-${item.id}`;
        card.textContent = String(item.id);
        card.style.setProperty('--x-nt-glass-refraction', `url(#lens-${item.id})`);
        return card;
      }));
    }
  });
  env.pager.renderCurrentBookmarkPage();
  return env;
}

async function run() {
  const env = setup();
  const { pager, state, grid, animations } = env;

  pager.switchBookmarkPage(1);
  assert.equal(state.currentPage, 1);
  assert.equal(animations.length, 3, 'both pages animate together');
  assert.equal(animations[0].keyframes[1].transform, 'translateX(-424px)');
  assert.equal(animations[1].keyframes[0].transform, 'translateX(424px)');
  assert(animations.every(animation => animation.options.duration === 520 && animation.startTime === 0));
  assert(animations.every(animation => animation.keyframes.length === 2 &&
    animation.options.easing === 'cubic-bezier(0.16, 1, 0.3, 1)'), 'decelerate directly into place without an overshoot');
  const outgoing = grid.lastElementChild;
  assert.equal(outgoing.getAttribute('aria-hidden'), 'true');
  assert.equal(outgoing.inert, true);
  assert.equal(outgoing.querySelectorAll('[id]').length, 0);
  assert.equal(outgoing.getAttribute('data-bookmark-page-outgoing'), 'true', 'the leaving page builds no lenses');
  assert([...outgoing.children].every(card => card.style.getPropertyValue('--x-nt-glass-refraction') === ''),
    'the leaving cards drop the lenses of the cards they copy');
  assert([...grid.children].filter(card => card !== outgoing)
    .every(card => card.style.getPropertyValue('--x-nt-glass-refraction') !== ''), 'the arriving cards keep theirs');
  assert.equal(grid.style.overflowX, 'clip', 'only the slide axis is clipped, so card shadows stay');

  // Early in a slide, further turns wait (only the latest one) for its tail.
  env.clock = 100;
  for (let index = 0; index < 120; index++) pager.switchBookmarkPage(state.currentPage + 1);
  assert.equal(state.currentPage, 1, 'the page does not change before the slide reaches its tail');
  assert.equal(animations.length, 3, 'rapid clicks never start overlapping animations');
  assert.equal(grid.children.length, 3, 'only one outgoing page exists');
  assert.equal(env.pendingTimers().length, 1, 'one queued turn');
  assert.equal(env.pendingTimers()[0].ms, 160, 'the queued turn starts once the slide is 260ms in');
  env.clock = 260;
  env.runTimers();
  assert.equal(state.currentPage, 2, 'the queued turn runs once');
  assert.equal(animations.length, 6);
  assert(animations.slice(0, 3).every(animation => animation.cancelled), 'the earlier slide hands over');
  assert.equal(grid.children.length, 3, 'still only one outgoing page');
  assert.equal(env.pendingTimers().length, 0);

  // In the tail, a turn starts at once.
  env.clock = 600;
  pager.switchBookmarkPage(1);
  assert.equal(state.currentPage, 1);
  assert.equal(animations[6].keyframes[1].transform, 'translateX(424px)', 'previous page reverses the direction');
  animations.forEach(animation => animation.resolve());
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(state.pageAnimating, false);
  assert.equal(grid.children.length, 2);
  assert.equal(grid.style.overflowX, '');

  // Asking for the page already sliding in drops a queued turn.
  env.clock = 1000;
  pager.switchBookmarkPage(2);
  env.clock = 1050;
  pager.switchBookmarkPage(3);
  assert.equal(env.pendingTimers().length, 1);
  pager.switchBookmarkPage(2);
  assert.equal(env.pendingTimers().length, 0, 'turning back to the current page cancels the queued turn');

  // A data refresh or folder change drops the queued turn and the slide.
  pager.switchBookmarkPage(3);
  assert.equal(env.pendingTimers().length, 1);
  pager.renderCurrentBookmarkPage();
  assert.equal(env.pendingTimers().length, 0, 'a re-render drops the queued turn');
  assert.equal(state.pageAnimating, false, 'data refresh cleans up the interrupted animation');
  assert.equal(grid.children.length, 2);
  assert.equal(state.currentPage, 2);

  env.reducedMotion = true;
  const previousCount = animations.length;
  pager.switchBookmarkPage(1);
  assert.equal(state.currentPage, 1);
  assert.equal(animations.length, previousCount);
  env.reducedMotion = false;
  env.window.document.documentElement.setAttribute('data-lumno-motion-effects', 'off');
  pager.switchBookmarkPage(0);
  assert.equal(state.currentPage, 0);
  assert.equal(animations.length, previousCount, 'motion preference is respected');
  env.window.close();
  console.log('Bookmark page motion tests passed: single-page sliding, queued and interrupted turns, cleanup and motion preferences');
}
run().catch(error => { console.error(error); process.exitCode = 1; });
