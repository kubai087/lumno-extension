const assert = require('assert');
const path = require('path');
const { parsePageCss } = require('../helpers/css-rules');
const { getPageScripts, runsBefore } = require('../helpers/runtime-scripts');

const repoRoot = path.resolve(__dirname, '..', '..');
const {
  buildCascadeSafeTriangle,
  isPointInsideCascadeSafeTriangle
} = require(path.join(repoRoot, 'src', 'newtab', 'bookmarks', 'bookmark-cascade-position.ts'));

// The menu's behaviour is covered by bookmark-cascade-menu.test.ts; this
// checks the safe triangle's geometry, the page's load order and the styles.

// A layer value: a number, or calc(number + number) once tokens resolve.
function layer(value) {
  const text = String(value || '').replace(/\s+/g, ' ').trim();
  const sum = text.match(/^calc\((-?\d+) \+ (\d+)\)$/);
  return sum ? Number(sum[1]) + Number(sum[2]) : Number.parseInt(text, 10);
}

assert.strictEqual(
  typeof buildCascadeSafeTriangle,
  'function',
  'cascade positioning should expose a safe-triangle builder'
);
assert.strictEqual(
  typeof isPointInsideCascadeSafeTriangle,
  'function',
  'cascade positioning should expose safe-triangle hit testing'
);

{
  const triangle = buildCascadeSafeTriangle({
    pointer: { x: 100, y: 120 },
    submenuRect: { left: 220, right: 420, top: 80, bottom: 220 },
    side: 'right'
  });

  assert.deepStrictEqual(
    triangle,
    [
      { x: 100, y: 120 },
      { x: 220, y: 80 },
      { x: 220, y: 220 }
    ],
    'right-opening submenus should use the submenu left edge as the safe-triangle base'
  );
  assert.ok(
    isPointInsideCascadeSafeTriangle({ x: 180, y: 128 }, triangle),
    'points inside the right-opening safe triangle should be protected'
  );
  assert.ok(
    !isPointInsideCascadeSafeTriangle({ x: 180, y: 40 }, triangle),
    'points outside the right-opening safe triangle should not be protected'
  );
}

{
  const triangle = buildCascadeSafeTriangle({
    pointer: { x: 500, y: 220 },
    submenuRect: { left: 120, right: 320, top: 160, bottom: 360 },
    side: 'left'
  });

  assert.deepStrictEqual(
    triangle,
    [
      { x: 500, y: 220 },
      { x: 320, y: 160 },
      { x: 320, y: 360 }
    ],
    'left-opening submenus should use the submenu right edge as the safe-triangle base'
  );
  assert.ok(
    isPointInsideCascadeSafeTriangle({ x: 410, y: 230 }, triangle),
    'points inside the left-opening safe triangle should be protected'
  );
  assert.ok(
    !isPointInsideCascadeSafeTriangle({ x: 410, y: 120 }, triangle),
    'points outside the left-opening safe triangle should not be protected'
  );
}

{
  const newtabScripts = getPageScripts('newtab.html');
  assert.ok(
    runsBefore(newtabScripts, 'src/newtab/bookmarks/bookmark-cascade-position.ts', 'src/newtab/app/main.ts') &&
      runsBefore(newtabScripts, 'src/newtab/bookmarks/bookmark-cascade-menu.ts', 'src/newtab/app/main.ts'),
    'newtab should load the cascade menu runtime and its positioning helpers before the page entry'
  );
}
{
  const css = parsePageCss('newtab.html');
  const item = css.rule('.x-nt-bookmark-cascade-item');
  assert.strictEqual(item.get('transition'), 'color 120ms ease',
    'row text colour transitions while the hover background appears at once');
  assert.ok(css.selectors().some((selector) => selector.startsWith('.x-nt-bookmark-cascade-item[data-hover-suppressed="true"]:hover')),
    'rows crossed inside a safe triangle should not show a competing hover');
  assert.ok(layer(css.rule('.x-nt-bookmark-cursor-tooltip').get('--x-extension-tooltip-z-index')) >
    layer(css.rule('.x-nt-bookmark-cascade-menu').get('z-index')),
  'the bookmark cursor tooltip should render above the bookmark menus');
  assert.ok(!css.entries.some((entry) => entry.selectors.includes('.x-nt-bookmark-cascade-item:focus-visible') &&
    /^2px solid/.test(entry.style.getPropertyValue('outline'))),
  'keyboard focus in a menu uses the selected row background, not an outline');
}

console.log('newtab bookmark cascade safe triangle, load order and style tests passed');
