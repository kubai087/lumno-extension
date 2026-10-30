import { describe, expect, it } from 'vitest';
import { parsePageCss, type CssCondition, type ParsedCss } from '../../fakes/css';

// New Tab's layout as its stylesheets ship it: page scrolling, the bottom
// dock's densities and scrollbar, the mobile flow and touch targets.

const css = parsePageCss('newtab.html');
const DOCK = '#_x_extension_newtab_bottom_dock_2024_unique_';
const SCROLLER = '#_x_extension_newtab_bottom_dock_scroller_2024_unique_';
const PHONE = /max-width:\s*640px/;
const NARROW_LANDSCAPE = /min-width:\s*641px\) and \(max-width:\s*900px\) and \(max-height:\s*560px/;
const TOUCH = /hover:\s*none/;

// The declarations `selector` gets (inside an @media / @supports block
// matching `condition`, when given); values are exact strings or RegExps.
function expectRule(selector: string, expected: Record<string, string | RegExp>, condition?: CssCondition, sheet: ParsedCss = css): void {
  const found = sheet.rule(selector, condition);
  expect(found, `a rule for ${selector}`).not.toBeNull();
  Object.entries(expected).forEach(([name, value]) => {
    const actual = found ? found.get(name) : null;
    if (value instanceof RegExp) {
      expect(String(actual), `${selector} ${name}`).toMatch(value);
    } else {
      expect(actual, `${selector} ${name}`).toBe(value);
    }
  });
}

function hasConditionalValue(condition: RegExp, name: string, value: string): boolean {
  return css.entries.some((entry) => entry.conditions.some((text) => condition.test(text)) &&
    entry.style.getPropertyValue(name).replace(/\s+/g, ' ').trim() === value);
}

describe('New Tab scrolling', () => {
  it('suppresses rubber-band overscroll at the root but keeps document scrolling as the fallback', () => {
    ['html', 'body'].forEach((selector) => expectRule(selector, { height: '100%', 'overscroll-behavior': 'none' }));
    expectRule('body', { 'overflow-x': 'hidden', 'overflow-y': 'auto' });
    expectRule('body.x-nt-bottom-layout:not(.x-nt-mobile-flow)', { 'overflow-y': 'hidden' });
  });

  it('draws a thin translucent dock scrollbar instead of the classic system one', () => {
    const classic = ':root:not([data-lumno-scrollbars="overlay"])';
    expectRule(`${classic} ${SCROLLER}::-webkit-scrollbar`, { width: '10px' });
    expectRule(`${classic} ${SCROLLER}::-webkit-scrollbar-track`, {
      background: 'transparent',
      'margin-bottom': 'max(10px, var(--x-nt-bottom-dock-scrollbar-end-inset, 0px))'
    });
    expectRule(`${classic} ${SCROLLER}::-webkit-scrollbar-thumb`, { 'border-radius': '999px' });
    expect(css.rule(`${classic} body[data-theme="dark"] ${SCROLLER}::-webkit-scrollbar-thumb`)).not.toBeNull();
    expectRule(SCROLLER, { 'scrollbar-width': 'thin' }, /not selector\(::-webkit-scrollbar\)/);
  });

  it('scrolls inside the dock in a stable gutter 14px beside the cards, which keep their width', () => {
    expectRule(SCROLLER, {
      '--x-nt-bottom-dock-shadow-bleed-end': '14px',
      'scrollbar-gutter': 'stable',
      'overflow-y': 'auto',
      'overscroll-behavior': 'contain'
    });
    const scroller = css.rule(SCROLLER);
    expect(scroller && scroller.names().some((name) => /var\(--x-nt-bottom-dock-scrollbar-gutter,\s*0px\)/.test(scroller.get(name) || ''))).toBe(true);
  });

  it('keeps the top bar scrolling without chaining wheel input to the page', () => {
    expectRule('.x-nt-bookmarks-topbar-viewport', { 'overflow-x': 'auto', 'overscroll-behavior': 'contain' });
  });
});

describe('New Tab bookmarks and suggestions', () => {
  it('limits the suggestions by content, viewport and an open scope panel', () => {
    expectRule('#_x_extension_newtab_suggestions_container_2024_unique_', {
      'max-height': /^min\(.*--x-nt-suggestions-max-height.*--x-nt-suggestions-viewport-fit-max-height.*--x-nt-suggestions-menu-fit-max-height/
    });
  });

  it('keeps top bar titles in the theme ink until the wallpaper tone is sampled', () => {
    expectRule('body[data-wallpaper-active="true"] .x-nt-bookmarks-topbar[data-surface-mode="adaptive"]', {
      '--x-nt-bookmarks-topbar-ink': 'var(--x-nt-bookmark-title, #111827)'
    });
    expectRule('body[data-wallpaper-active="true"] .x-nt-bookmarks-topbar[data-wallpaper-ink][data-surface-mode="adaptive"]', {
      '--x-nt-bookmarks-topbar-ink': /^var\(--x-nt-wallpaper-adaptive-ink,/
    });
  });

  it('balances the bookmark heading and breadcrumb hover padding without shifting neighbours', () => {
    expectRule('.x-nt-bookmarks-heading.x-nt-bookmarks-heading--link', { padding: '3px 5px', 'margin-left': '-5px', 'margin-right': '-5px' });
    expectRule('.x-nt-bookmarks-crumb', { padding: '0 5px 0 7px' });
  });

  it('gives the pager mode trigger the wallpaper tone of its surface', () => {
    expect(css.selectors()).toContain(
      'body[data-wallpaper-active="true"] [data-wallpaper-icon-bg="true"] .x-nt-section-mode-select ._x_extension_select_trigger_2024_unique_');
  });
});

describe('the bottom dock densities', () => {
  it('defines card sizes per density', () => {
    [
      [DOCK, '51px', '104px'],
      [`${DOCK}[data-density="compact"]`, '44px', '86px'],
      [`${DOCK}[data-density="tiny"]`, '40px', '72px']
    ].forEach(([selector, cardHeight, recentHeight]) => {
      expectRule(selector, { '--x-nt-dock-bookmark-card-height': cardHeight, '--x-nt-dock-recent-inner-height': recentHeight });
    });
    expectRule(`${DOCK}[data-density="mobile"]`, {
      '--x-nt-dock-bookmark-card-height': '44px',
      '--x-nt-dock-recent-card-padding': '6px 6px 8px',
      '--x-nt-dock-recent-card-gap': '6px',
      '--x-nt-dock-recent-inner-height': '82px',
      '--x-nt-dock-recent-inner-hover-height': '82px'
    });
  });

  it('sizes bookmark and recent cards from those tokens', () => {
    expectRule('.x-nt-bookmark-card', {
      height: 'var(--x-nt-dock-bookmark-card-height, 51px)',
      padding: 'var(--x-nt-dock-bookmark-card-padding, 13px 15px)'
    });
    expectRule('.x-nt-recent-inner', {
      padding: 'var(--x-nt-dock-recent-inner-padding, 13px 13px 14px 15px)',
      height: 'var(--x-nt-dock-recent-inner-height, 104px)'
    });
  });

  it('aligns folder previews and keeps room for their rotation', () => {
    expectRule('.x-nt-folder-preview', { 'margin-right': '-2px' });
    expectRule('.x-nt-bookmark-card--folder.x-nt-bookmark-card--folder-expanded .x-nt-folder-preview', { padding: '2px 0 2px 3px' });
  });

  it('tightens the space around the shortcuts as the dock gets denser', () => {
    expectRule('body[data-nt-bottom-dock-density="compact"]', {
      '--x-nt-shortcuts-reserved-height': '54px',
      '--x-nt-shortcuts-section-margin-top': '8px'
    });
    expectRule('body[data-nt-bottom-dock-density="tiny"]', {
      '--x-nt-shortcuts-reserved-height': '42px',
      '--x-nt-shortcuts-section-margin-top': '6px'
    });
  });

  it('keeps the shortcut row and interactive rows touch-sized in a narrow landscape window', () => {
    expectRule('body[data-nt-bottom-dock-density="tiny"]', { '--x-nt-shortcuts-reserved-height': '50px' }, NARROW_LANDSCAPE);
    expectRule(`${DOCK}[data-density="tiny"]`, { '--x-nt-dock-bookmark-card-height': '44px' }, NARROW_LANDSCAPE);
  });
});

describe('the mobile flow', () => {
  it('does not force wide content sections on phones', () => {
    ['#_x_extension_newtab_bookmarks_2024_unique_', '#_x_extension_newtab_recent_sites_2024_unique_'].forEach((section) => {
      expectRule(section, { 'min-width': '0', width: 'min(96vw, var(--x-nt-content-max-width, 1040px))' }, /max-width:\s*520px/);
    });
  });

  it('scrolls the document, respecting the safe areas and an occupied top surface', () => {
    expectRule('body.x-nt-mobile-flow', {
      'min-height': '100dvh',
      'overflow-y': 'auto',
      'padding-top': /^max\(.*48px.*var\(--x-nt-top-occupied-inset,.*env\(safe-area-inset-top\)/,
      'padding-inline': 'max(24px, env(safe-area-inset-left)) max(24px, env(safe-area-inset-right))'
    }, PHONE);
  });

  it('lets the dock join the flow at the bottom of the first screen and release its own scrolling', () => {
    expectRule(DOCK, { position: 'static', transform: 'none', 'max-height': 'none', 'margin-top': 'auto' }, PHONE);
    expectRule(SCROLLER, { 'max-height': 'none', overflow: 'visible', 'overscroll-behavior': 'auto' }, PHONE);
  });

  it('shows two columns on narrow viewports', () => {
    ['#_x_extension_newtab_bookmarks_grid_2024_unique_', '#_x_extension_newtab_recent_sites_grid_2024_unique_'].forEach((grid) => {
      expectRule(grid, { 'grid-template-columns': 'repeat(2, minmax(0, 1fr))' }, /max-width:\s*860px/);
    });
  });

  it('uses the compact vertical spacing budget and touch-safe shortcuts', () => {
    expectRule(':root', {
      '--x-nt-section-inner-gap': '10px',
      '--x-nt-grid-row-gap': '8px',
      '--x-nt-bottom-dock-section-gap': '10px',
      '--x-nt-bottom-dock-corridor-size': '0px',
      '--x-nt-bottom-dock-top-padding': '12px',
      '--x-nt-bottom-dock-bottom-padding': 'calc(72px + env(safe-area-inset-bottom))',
      '--x-nt-shortcuts-reserved-height': '64px',
      '--x-nt-shortcuts-section-margin-top': '10px',
      '--x-nt-shortcut-tile-size': 'min(var(--x-nt-shortcut-user-tile-size), 52px)',
      '--x-nt-shortcut-icon-size': 'min(var(--x-nt-shortcut-user-icon-size), 40px)'
    }, PHONE);
  });
});

describe('the corner controls', () => {
  it('take the corner size, 44px wherever input is by touch', () => {
    ['.x-nt-wallpaper-button', '.x-nt-feedback-button'].forEach((button) => {
      expectRule(button, { width: /^var\(--x-nt-corner-size/, height: /^var\(--x-nt-corner-size/ });
    });
    [PHONE, TOUCH, NARROW_LANDSCAPE].forEach((condition) => {
      expect(hasConditionalValue(condition, '--x-nt-corner-size', '44px'), String(condition)).toBe(true);
    });
  });

  it('clear the bottom safe area on phones', () => {
    expect(hasConditionalValue(PHONE, '--x-nt-corner-inset-y', 'max(10px, env(safe-area-inset-bottom))')).toBe(true);
  });

  it('keep the appearance button distinct over a wallpaper on phones', () => {
    expectRule('.x-nt-wallpaper-button', {
      background: 'var(--control-bg)',
      'border-color': 'var(--tab-border)',
      'backdrop-filter': 'blur(16px)'
    }, PHONE);
  });
});

describe('touch input', () => {
  it('keeps recent cards still instead of the hover lift and expansion', () => {
    expectRule('.x-nt-recent-card:hover', { transform: 'none' }, TOUCH);
    expectRule('.x-nt-recent-card:hover .x-nt-recent-card-visual', { transform: 'none', 'box-shadow': 'var(--x-nt-recent-card-shadow)' }, TOUCH);
    expectRule('.x-nt-recent-card:hover .x-nt-recent-inner', {
      height: 'var(--x-nt-dock-recent-inner-height, 104px)',
      transform: 'none',
      'margin-bottom': '0'
    }, TOUCH);
  });
});

describe('the appearance panel', () => {
  it('is safe-area aware and scrolls on its own on phones', () => {
    expectRule('.x-nt-wallpaper-panel', {
      position: 'fixed',
      left: 'max(12px, env(safe-area-inset-left))',
      right: 'max(12px, env(safe-area-inset-right))',
      bottom: 'calc(max(12px, env(safe-area-inset-bottom)) + 56px)',
      width: 'auto',
      'max-width': 'none',
      'max-height': 'calc(100dvh - 80px - var(--x-nt-top-bar-max-inset) - var(--x-nt-bottom-safe-inset))',
      '--x-nt-panel-padding': '16px'
    }, PHONE);
    expectRule('.x-nt-wallpaper-panel-scroll', { 'scrollbar-gutter': 'auto' }, PHONE);
  });

  it('always leaves room for the top bar, whether or not it shows', () => {
    expectRule(':root', { '--x-nt-top-bar-max-inset': 'calc(48px + var(--x-nt-top-safe-inset))' });
    const maxHeights = css.entries
      .filter((entry) => entry.selectors.includes('.x-nt-wallpaper-panel') && entry.style.getPropertyValue('max-height'))
      .map((entry) => entry.style.getPropertyValue('max-height'));
    expect(maxHeights.length).toBeGreaterThan(0);
    maxHeights.forEach((value) => {
      expect(value).toMatch(/var\(--x-nt-top-bar-max-inset\)/);
      expect(value).not.toMatch(/--x-nt-top-occupied-inset/);
    });
  });
});
