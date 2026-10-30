// @vitest-environment jsdom
import { existsSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { SPLIT_STYLESHEETS, readStylesheetSource } from '../fakes/css';
import { builtModules, readRepoText, repoPath } from './repository';

// Windows (and macOS set to always show scrollbars) draws a wide system
// scrollbar in any scroll box that does not style or hide its own. Inside a
// rounded panel that bar crowds the rows and leaves uneven insets, so every
// scroll box in our UI, the pages included, must either draw the thin bar or
// hide it. Where macOS draws overlay scrollbars that only show while
// scrolling, our pages keep them: src/shared/scrollbar-mode.ts marks
// <html data-lumno-scrollbars="overlay">, and every thin-bar rule is scoped
// away from it, since any ::-webkit-scrollbar style turns an overlay bar into
// a permanent one.
const STYLESHEETS = [
  'src/newtab/newtab.css',
  'src/newtab/recent/recent-history-dialog.css',
  'src/newtab/shortcuts/shortcut-dialog.css',
  'src/newtab/bookmarks/folder-color-picker.css',
  'src/newtab/remote-content.css',
  'src/options/options.css',
  'src/onboarding/onboarding.css',
  'src/overlay/suggestions-view.css',
  'src/shared/search/search-input.css',
  'src/shared/ui/menu-surface.css',
  'src/shared/ui/custom-select.css'
].filter((file) => SPLIT_STYLESHEETS[file] || existsSync(repoPath(file)));

const OVERLAY_SCOPE = ':root:not([data-lumno-scrollbars="overlay"])';
// Body overflow scrolls the viewport, whose bar is styled on :root below.
const PAGE_LEVEL_SCROLLERS = new Map([
  ['body', 'the page scrolls the viewport, styled through :root'],
  ['body.x-nt-mobile-flow', 'the narrow New Tab scrolls the viewport, styled through :root'],
  ['._x_extension_confirm_mask_2024_unique_', 'a dialog taller than the window scrolls the page-wide mask']
]);

interface CssRuleText {
  file: string;
  selector: string;
  body: string;
}

function stripComments(css: string): string {
  return css.replace(/\/\*[\s\S]*?\*\//g, '');
}

// Flattens nested at-rules into selector and body pairs, as written.
function collectRules(css: string): Array<[string, string]> {
  const rules: Array<[string, string]> = [];
  const stack: string[] = [];
  let buffer = '';
  for (const char of css) {
    if (char === '{') {
      stack.push(buffer.trim());
      buffer = '';
    } else if (char === '}') {
      const selector = stack.pop();
      if (selector !== undefined && !selector.startsWith('@')) {
        rules.push([selector, buffer]);
      }
      buffer = '';
    } else {
      buffer += char;
    }
  }
  return rules;
}

const ALL_RULES: CssRuleText[] = STYLESHEETS.flatMap((file) => collectRules(stripComments(readStylesheetSource(file)))
  .map(([selector, body]) => ({ file, selector, body })));

function splitSelectors(selector: string): string[] {
  return selector.split(/,(?![^(]*\))/).map((part) => part.replace(/\s+/g, ' ').trim()).filter(Boolean);
}

// The last compound selector names the scroll box, e.g. "#a .b[data-x]" -> ".b".
function scrollBoxKey(selector: string): string {
  const last = selector.split(/\s+|>/).filter(Boolean).pop() || '';
  const match = last.match(/^(#[\w-]+|\.[\w-]+|[a-z]+(?:\.[\w-]+)?)/);
  return match ? match[1] : last;
}

function hasOwnScrollbarTreatment(key: string): boolean {
  return ALL_RULES.some(({ selector, body }) => splitSelectors(selector).some((part) => part.includes(key) &&
    (/::-webkit-scrollbar\b/.test(part) || /scrollbar-width:\s*(none|thin)/.test(body))));
}

// Every scroll box, by the selector that names it, with the file that declares it first.
function findScrollBoxes(): Map<string, string> {
  const boxes = new Map<string, string>();
  ALL_RULES.forEach(({ file, selector, body }) => {
    if (!/overflow(-x|-y)?:\s*(auto|scroll)/.test(body)) {
      return;
    }
    splitSelectors(selector).filter((part) => !part.includes('::')).forEach((part) => {
      const key = PAGE_LEVEL_SCROLLERS.has(part) ? part : scrollBoxKey(part);
      if (!boxes.has(key)) {
        boxes.set(key, file);
      }
    });
  });
  return boxes;
}

// The options of an :is() list, each on its own.
function expandIs(part: string): string[] {
  const match = part.match(/:is\(([^()]*)\)/);
  if (!match) {
    return [part];
  }
  return match[1].split(',').flatMap((option) => expandIs(part.replace(match[0], option.trim())));
}

describe('scrollbar styles', () => {
  const scrollBoxes = findScrollBoxes();
  const newtabCss = stripComments(readStylesheetSource('src/newtab/newtab.css'));

  it('gives every scroll box the thin bar or hides it', () => {
    expect(scrollBoxes.size).toBeGreaterThanOrEqual(8);
    expect([...scrollBoxes].filter(([key]) => !PAGE_LEVEL_SCROLLERS.has(key) && !hasOwnScrollbarTreatment(key))
      .map(([key, file]) => `${key} (${file})`)).toEqual([]);
  });

  it.each([
    '#_x_extension_newtab_bottom_dock_scroller_2024_unique_',
    '#_x_extension_newtab_suggestions_container_2024_unique_',
    '._x_extension_aggregate_search_sources_2026_unique_'
  ])('keeps a stable gutter in %s so rows do not shift when the bar appears', (key) => {
    expect(scrollBoxes.has(key)).toBe(true);
    expect(ALL_RULES.some(({ selector, body }) => selector.includes(key) && /scrollbar-gutter:\s*stable/.test(body))).toBe(true);
  });

  // Over a wallpaper the dock's thumb takes the ink sampled under its track.
  it('draws the dock thumb in the sampled wallpaper ink with an opposite-tone hairline', () => {
    expect(newtabCss).toMatch(
      /body #_x_extension_newtab_bottom_dock_scroller_2024_unique_\[data-wallpaper-ink\]::-webkit-scrollbar-thumb\s*\{[^}]*background-color:\s*var\(--x-nt-wallpaper-adaptive-ink-muted\);[^}]*box-shadow:\s*inset 0 0 0 1px var\(--x-nt-bottom-dock-scrollbar-hairline\);/
    );
  });

  // The viewport on Settings and New Tab, the shell on onboarding.
  it.each([
    ['src/options/options.css', `${OVERLAY_SCOPE}::-webkit-scrollbar-thumb`],
    ['src/newtab/newtab.css', `${OVERLAY_SCOPE}::-webkit-scrollbar-thumb`],
    ['src/onboarding/onboarding.css', `${OVERLAY_SCOPE} .onboarding-shell::-webkit-scrollbar-thumb`]
  ])('draws the thin page scrollbar in %s', (file, selector) => {
    expect(ALL_RULES.some((rule) => rule.file === file && splitSelectors(rule.selector).includes(selector))).toBe(true);
  });

  // The plain menu and the searchable menu's inner listbox each scroll
  // through an inline overflow the audit above cannot see.
  it.each([
    '._x_extension_select_menu_2024_unique_',
    '._x_extension_select_listbox_2026_unique_'
  ])('draws the thin scrollbar in the inline scroller %s', (target) => {
    expect(ALL_RULES.some((rule) => rule.file === 'src/shared/ui/custom-select.css' &&
      splitSelectors(rule.selector).flatMap(expandIs).includes(`${OVERLAY_SCOPE} ${target}::-webkit-scrollbar-thumb`))).toBe(true);
  });

  // Hiding rules and the command bar (which runs on other sites' pages) are exempt.
  it('keeps macOS overlay bars by scoping every thin-bar rule away from them', () => {
    expect(ALL_RULES
      .filter(({ file, selector, body }) => file !== 'src/overlay/suggestions-view.css' &&
        selector.includes('::-webkit-scrollbar') && !/display:\s*none/.test(body))
      .flatMap(({ file, selector }) => splitSelectors(selector)
        .filter((part) => !part.startsWith(OVERLAY_SCOPE))
        .map((part) => `${part} (${file})`))).toEqual([]);
  });

  it.each([
    ['src/newtab/newtab.css', /:root\[data-lumno-scrollbars="overlay"\] #_x_extension_newtab_suggestions_container_2024_unique_\s*\{\s*--x-nt-suggestions-scrollbar-gutter:\s*0px;/],
    ['src/newtab/newtab.css', /:root\[data-lumno-scrollbars="overlay"\] \.x-nt-appearance-help-footer\s*\{\s*--x-nt-panel-scrollbar-gutter:\s*0px;/],
    ['src/options/options.css', /:root\[data-lumno-scrollbars="overlay"\] \._x_extension_aggregate_search_sources_2026_unique_\s*\{\s*--x-aggregate-sources-scrollbar-gutter:\s*0px;/]
  ])('drops the thin-bar inset for overlay bars in %s', (file, pattern) => {
    expect(readStylesheetSource(file)).toMatch(pattern);
  });

  // Every page marks the scrollbar kind in <head>, before its styles paint.
  it.each([
    ['newtab.html', 'newtab-preload'],
    ['src/options/options.html', 'options-preload'],
    ['src/onboarding/onboarding.html', 'onboarding-preload']
  ])('loads the scrollbar mode marker in the <head> of %s', (file, bundle) => {
    const head = new DOMParser().parseFromString(readRepoText(file), 'text/html').head;

    expect(head.querySelector(`script[src="../../build/${bundle}.js"]`)).not.toBeNull();
    expect(builtModules(`${bundle}.js`)).toContain('src/shared/scrollbar-mode.ts');
  });

  // macOS overlay bars can't be styled, only toned through color-scheme, so
  // the dark themes declare it and the dock follows the wallpaper under its track.
  it.each(['src/newtab/newtab.css', 'src/options/options.css'])('declares the dark color-scheme in %s so overlay bars turn light', (file) => {
    expect(stripComments(readStylesheetSource(file))).toMatch(/:root:has\(> body\[data-theme="dark"\]\)\s*\{\s*color-scheme:\s*dark;/);
  });

  it('tones overlay bars over the dock against the wallpaper ink', () => {
    expect(newtabCss).toMatch(
      /:root\[data-lumno-scrollbars="overlay"\] #_x_extension_newtab_bottom_dock_scroller_2024_unique_\[data-wallpaper-ink="light"\]\s*\{\s*color-scheme:\s*dark;[\s\S]*?\[data-wallpaper-ink="dark"\]\s*\{\s*color-scheme:\s*light;/
    );
  });
});
