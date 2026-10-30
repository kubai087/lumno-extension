import { describe, expect, it } from 'vitest';
import { parseCss, parsePageCss, readRepoFile, readStylesheet, type CssCondition, type ParsedCss } from '../../fakes/css';

// New Tab's entrance as its stylesheets ship it: the page's own layers and
// controls, the shared search entry it opts into, and its feature hints.

const newtabCss = parsePageCss('newtab.html');
const searchInputCss = parseCss(readStylesheet('src/shared/search/search-input.css'));
const featureHintsCss = parseCss(readRepoFile('src/shared/ui/feature-hints.css'));

function expectRule(selector: string, expected: Record<string, string | RegExp>, condition?: CssCondition, sheet: ParsedCss = newtabCss): void {
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

describe('the New Tab entrance', () => {
  it('keeps the wallpaper effect layers free of transitions throughout', () => {
    ['body:not([data-nt-enter="done"]) .x-nt-wallpaper-effect-canvas', 'body:not([data-nt-enter="done"])::after']
      .forEach((selector) => expectRule(selector, { transition: 'none' }));
  });

  it('hides the corner controls until their entrance state is installed', () => {
    ['.x-nt-wallpaper-control', '.x-nt-feedback-control', '.x-nt-bookmark-cascade-debug-control']
      .forEach((control) => expectRule(`body:not([data-nt-ready="1"]) ${control}`, { visibility: 'hidden' }));
  });

  it('unrolls the docked bookmarks top bar from its top edge without moving it', () => {
    expectRule('body[data-nt-enter="run"][data-nt-ready="1"] .x-nt-bookmarks-topbar[data-visible="true"]', {
      animation: '_x_nt_topbar_entry_2026_unique_ 220ms cubic-bezier(0.16, 1, 0.3, 1) both'
    });
    const unroll = newtabCss.keyframes('_x_nt_topbar_entry_2026_unique_');
    expect(unroll && ['0%', '85%', '100%'].map((frame) => unroll[frame].getPropertyValue('clip-path')))
      .toEqual(['inset(0 0 100% 0)', 'inset(0 0 0 0)', 'inset(0 0 -32px 0)']);
  });

  it('settles the floating bookmarks top bar in from its top edge', () => {
    expectRule('body[data-nt-enter="run"][data-nt-ready="1"] .x-nt-bookmarks-topbar[data-visible="true"][data-layout="floating"]', {
      'animation-name': '_x_nt_topbar_floating_entry_2026_unique_',
      'transform-origin': '50% 0'
    });
    const settle = newtabCss.keyframes('_x_nt_topbar_floating_entry_2026_unique_');
    expect(settle && [settle['0%'].getPropertyValue('opacity'), settle['0%'].getPropertyValue('scale')]).toEqual(['0', '0.96']);
  });

  it('does not draw the hidden top bar as a bare filtered strip before the reveal', () => {
    expectRule('body:not([data-nt-ready="1"]) .x-nt-bookmarks-topbar', { visibility: 'hidden', 'backdrop-filter': 'none' });
  });

  it('enters shortcut tiles with a tight 10ms stagger and the bottom sections with them', () => {
    expectRule('body[data-nt-enter="run"] .x-nt-shortcuts-section[data-visible="true"] .x-nt-shortcut-tile', {
      animation: /calc\(20ms \+ \(var\(--x-nt-shortcut-enter-index\) \* 10ms\)\) both$/
    });
    expectRule('body[data-nt-enter="run"] #_x_extension_newtab_recent_sites_2024_unique_[data-visible="true"]', {
      animation: /40ms both$/
    });
  });

  it('raises a visible appearance-button hint above the feedback button', () => {
    expectRule('.x-nt-wallpaper-control:has(> .x-lumno-feature-hint[data-visible="true"])', { 'z-index': '20' });
  });
});

describe('the shared search entry on New Tab', () => {
  it('leads with the New Tab timing and an ease-out from the center', () => {
    expectRule('.x-lumno-search-entry[data-lumno-search-entry="run"]', {
      animation: /^_x_lumno_search_entry_2026_unique_ .*var\(--x-lumno-search-entry-duration, 240ms\).*var\(--x-lumno-search-entry-delay, 20ms\) both$/,
      'transform-origin': 'center center'
    }, undefined, searchInputCss);
  });

  it('expands the field subtly without moving it or blurring its backdrop-filtered panel', () => {
    const frames = searchInputCss.keyframes('_x_lumno_search_entry_2026_unique_');
    expect(frames).not.toBeNull();
    const entry = frames || {};
    expect([entry['0%'].getPropertyValue('scale'), entry['100%'].getPropertyValue('scale')])
      .toEqual(['var(--x-lumno-search-entry-scale-start, 0.97) 1', '1']);
    Object.values(entry).forEach((frame) => {
      expect(frame.getPropertyValue('translate')).toBe('');
      expect(frame.getPropertyValue('filter')).not.toMatch(/blur/);
    });
  });

  it('is not duplicated by the page', () => {
    expect(newtabCss.keyframes('_x_lumno_search_entry_2026_unique_') || newtabCss.keyframes('_x_nt_search_entry_2026_unique_')).toBeNull();
  });

  it('is off for reduced-motion users', () => {
    expectRule('.x-lumno-search-entry[data-lumno-search-entry]', { animation: 'none', filter: 'none', opacity: '1', scale: '1' },
      /prefers-reduced-motion:\s*reduce/, searchInputCss);
  });
});

describe('New Tab feature hints during the entrance', () => {
  it('keep only their fixed positioning transform', () => {
    [
      ['.x-lumno-feature-hint--newtab-wallpaper', 'translateY(-50%)'],
      ['.x-lumno-feature-hint--newtab-ai-quick-jump', 'translateX(-50%)'],
      ['.x-lumno-feature-hint--newtab-tab-switcher', ''],
      ['.x-lumno-feature-hint--newtab-webdav-sync', ''],
      ['.x-lumno-feature-hint--update-notice-newtab', '']
    ].forEach(([selector, positioning]) => {
      const found = featureHintsCss.rule(selector, '*');
      expect(found, selector).not.toBeNull();
      const transforms = found ? found.names().flatMap((name) => (found.get(name) || '').match(/translate(?:X|Y)?\([^)]*\)/g) || []) : [];
      expect(transforms, selector).toEqual(positioning ? [positioning] : []);
    });
  });
});
