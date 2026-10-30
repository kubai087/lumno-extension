// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { ensurePiPDockAssets } from '../../src/content/document-pip-picker/dock';
import { appendOverlayStyleNodes } from '../../src/overlay/dom/overlay-styles';
import { parseCss, parsePageCss, readStylesheetSource, type ParsedCss } from '../fakes/css';
import { readRepoText } from './repository';

// Cursors say what a control does (pointer, grabbing, help, not-allowed,
// progress), and nothing under the pointer moves, rotates or covers the
// control it belongs to, so the cursor never flickers between hit targets.

const newtab = parsePageCss('newtab.html');
const options = parsePageCss('src/options/options.html');
const onboarding = parsePageCss('src/onboarding/onboarding.html');
const tooltip = parseCss(readStylesheetSource('src/shared/ui/tooltip.css'));
const cursorTooltip = parseCss(readStylesheetSource('src/shared/ui/cursor-tooltip.css'));
const featureHints = parseCss(readStylesheetSource('src/shared/ui/feature-hints.css'));
const overlaySuggestions = parseCss(readStylesheetSource('src/overlay/suggestions-view.css'));
const searchInput = parseCss(readStylesheetSource('src/shared/search/search-input.css'));
const shortcutDialog = parseCss(readStylesheetSource('src/newtab/shortcuts/shortcut-dialog.css'));
const infoButton = parseCss(readStylesheetSource('src/shared/ui/info-button.css'));

// The overlay panel's own style rules, as its shell puts them in its shadow root.
function readOverlayShellCss(): ParsedCss {
  const root = document.createElement('div');
  appendOverlayStyleNodes(document, { root });
  return parseCss(Array.from(root.querySelectorAll('style'), (style) => style.textContent || '').join('\n'));
}

// The clip window's dock styles, as the picker puts them in the clip window.
function readPipDockCss(): ParsedCss {
  const pipDocument = document.implementation.createHTMLDocument('clip');
  ensurePiPDockAssets(pipDocument);
  return parseCss(pipDocument.getElementById('__lumno_pip_dock_style_2026__')?.textContent || '');
}

const overlayShell = readOverlayShellCss();
const pipDock = readPipDockCss();

const OVERLAY = ':is(#_x_extension_overlay_2024_unique_, #_x_extension_onboarding_overlay_demo_2026_unique_)';
const PANEL = '#_x_extension_overlay_2024_unique_';
const DOCK = '#_x_extension_newtab_bottom_dock_2024_unique_';

// The declarations every selector of a list ends up with at the top level.
function declared(css: ParsedCss, selectors: string[], name: string): Array<string | null> {
  return selectors.map((selector) => {
    const found = css.rule(selector);
    expect(found, `Expected a CSS rule for ${selector}`).not.toBeNull();
    return found ? found.get(name) : null;
  });
}

function expectDeclared(css: ParsedCss, selectors: string[], name: string, value: string | RegExp): void {
  declared(css, selectors, name).forEach((actual) => {
    if (value instanceof RegExp) {
      expect(actual).toMatch(value);
    } else {
      expect(actual).toBe(value);
    }
  });
}

// A hovered control keeps its hit box where it is.
function expectStableHoverTarget(css: ParsedCss, selectors: string[]): void {
  expectDeclared(css, selectors, 'transform', 'none');
}

// Contents take the owning control's cursor without giving up hit testing.
function expectCursorInheritance(css: ParsedCss, selectors: string[]): void {
  expectDeclared(css, selectors, 'cursor', 'inherit');
  declared(css, selectors, 'pointer-events').forEach((value) => expect(value).not.toBe('none'));
}

// Decorative contents take the owning control's cursor and stay outside hit testing.
function expectDecorative(css: ParsedCss, selectors: string[]): void {
  expectDeclared(css, selectors, 'cursor', 'inherit');
  expectDeclared(css, selectors, 'pointer-events', 'none');
}

const on = (scope: string, selectors: string[]) => selectors.map((selector) => `${scope} ${selector}`);
const CONTROL_CONTENTS = ['button *', 'a[href] *', '[role="button"] *', '[role="menuitem"] *', '[role="option"] *'];
const CONTROL_ICONS = ['button .ri-icon', 'a[href] .ri-icon', '[role="button"] .ri-icon'];
const ENABLED_CONTROLS = [
  'button:not(:disabled)', 'a[href]', '[role="button"]:not([aria-disabled="true"])',
  '[role="menuitem"]:not([aria-disabled="true"])', '[role="option"]:not([aria-disabled="true"])'
];

describe('interaction cursors', () => {
  describe('New Tab cards and tiles', () => {
    it('keep a pointer while clickable, draggable or not', () => {
      expectDeclared(newtab, [
        '.x-nt-bookmark-card',
        '.x-nt-bookmark-card[data-bookmark-draggable="true"]',
        '.x-nt-bookmark-cascade-item[data-bookmark-draggable="true"]',
        '.x-nt-shortcut-tile[data-shortcut-draggable="true"]',
        '.x-nt-recent-card'
      ], 'cursor', 'pointer');
    });

    it('grab during drag sessions, over every underlying page target too', () => {
      expectDeclared(newtab, [
        '.x-nt-shortcuts-grid[data-shortcut-dragging="true"] .x-nt-shortcut-tile',
        '.x-nt-bookmark-cascade-menu[data-drag-mode="true"] .x-nt-bookmark-cascade-item',
        '.x-nt-bookmark-cascade-item[data-bookmark-dragging="true"]',
        '#_x_extension_newtab_bookmarks_grid_2024_unique_[data-bookmark-dragging="true"] .x-nt-bookmark-card'
      ], 'cursor', 'grabbing');
      ['body[data-drag-source]', 'body[data-drag-source] *'].forEach((selector) => {
        const rule = newtab.rule(selector);
        expect(rule ? [rule.get('cursor'), rule.priority('cursor')] : null).toEqual(['var(--x-nt-drag-cursor, grabbing)', 'important']);
      });
    });

    it('keep hovered hit boxes stationary', () => {
      expectStableHoverTarget(newtab, [
        '.x-nt-bookmark-card.x-nt-bookmark-card--hover',
        '.x-nt-recent-card:hover',
        '.x-nt-feedback-action:hover',
        '.x-nt-suggestion-action-button[data-visible="true"]:hover',
        '.x-nt-suggestion-utility-button[data-hover="true"]'
      ]);
    });

    it('rotate the recent card visual instead of its hit box, less as the dock gets denser', () => {
      expectDeclared(newtab, ['.x-nt-recent-card:hover .x-nt-recent-card-visual'], 'transform',
        /^var\(--x-nt-dock-recent-card-hover-transform, rotate\(-3deg\) scale\(1\.01, 1\.005\)\)$/);
      expectDeclared(newtab, [DOCK], '--x-nt-dock-recent-card-hover-transform', /^rotate\(-3deg\) scale\(1\.01, 1\.005\)$/);
      expectDeclared(newtab, [`${DOCK}[data-density="compact"]`], '--x-nt-dock-recent-card-hover-transform', /^rotate\(-1\.5deg\) scale\(1\.006\)$/);
      expectDeclared(newtab, [`${DOCK}[data-density="tiny"]`], '--x-nt-dock-recent-card-hover-transform', /^scale\(1\.004\)$/);
    });

    it('keep animated visuals out of the hit target', () => {
      expectDecorative(newtab, [
        '.x-nt-shortcut-icon',
        '.x-nt-bookmark-card > :not(button)',
        '.x-nt-recent-card-visual',
        '.x-nt-wallpaper-tile > :not(button)'
      ]);
    });
  });

  describe('hover motion on shared and injected controls', () => {
    it('keeps the hit box stationary and moves only the decorative icon', () => {
      expectStableHoverTarget(pipDock, ['.lumno-pip-dock-btn:hover', '.lumno-pip-dock-btn:focus-visible']);
      expectDecorative(pipDock, ['.lumno-pip-dock-btn > *']);
      expectDeclared(pipDock, ['.lumno-pip-dock-btn:hover .ri-icon', '.lumno-pip-dock-btn:focus-visible .ri-icon'], 'transform', 'scale(1.03)');
      expectStableHoverTarget(featureHints, ['.x-lumno-feature-hint__link:hover']);
      expectStableHoverTarget(searchInput, ['.x-lumno-search-input__right-icon[data-hover-active="true"]']);
      expectDeclared(searchInput, ['.x-lumno-search-input__right-icon[data-hover-active="true"] .ri-icon'], 'transform', 'scale(1.06)');
      expectStableHoverTarget(overlaySuggestions, [
        `${OVERLAY} .x-ov-close-other-tabs[data-hover-active="true"]`,
        `${OVERLAY} .x-ov-suggestion-utility-button[data-hover="true"]`
      ]);
      expectDeclared(overlaySuggestions, [`${OVERLAY} .x-ov-close-other-tabs[data-hover-active="true"] .ri-icon`], 'transform', 'scale(1.06)');
    });

    it('lets icons inherit their owning button cursor', () => {
      expectDecorative(searchInput, ['.x-lumno-search-input__right-icon *']);
      expectDecorative(overlaySuggestions, [`${OVERLAY} .x-ov-close-other-tabs .ri-icon`]);
    });
  });

  describe('tooltips', () => {
    const declaresCursor = (css: ParsedCss, host: RegExp) => css.entries
      .filter((entry) => entry.selectors.some((selector) => host.test(selector)) && entry.style.names.includes('cursor'))
      .flatMap((entry) => entry.selectors);

    it('leave the owning control its pointer, grab and disabled cursors', () => {
      const host = /\._x_extension_tooltip_host_(?:2026|2024)_unique_\[data-tooltip\]/;
      expect(declaresCursor(tooltip, host)).toEqual([]);
      expect(declaresCursor(options, host)).toEqual([]);
      expect(declaresCursor(cursorTooltip, /\._x_extension_cursor_tooltip_host_2026_unique_\[data-cursor-tooltip\]/)).toEqual([]);
    });

    it('show the help cursor on hover-only help affordances', () => {
      expectDeclared(infoButton, ['._x_extension_info_button_2026_unique_'], 'cursor', 'help');
      expectDeclared(options, ['[role="img"][data-tooltip]'], 'cursor', 'help');
      expectDeclared(newtab, ['.x-nt-appearance-info-button'], 'cursor', 'help');
    });
  });

  describe('unavailable and busy controls', () => {
    it('show not-allowed while unavailable and progress while loading', () => {
      expectDeclared(newtab, ['.x-nt-bookmarks-pager-btn:disabled', '.x-nt-bookmarks-pager-btn[aria-disabled="true"]'], 'cursor', 'not-allowed');
      expectDeclared(newtab, ['.x-nt-feedback-detail-action:disabled', '.x-nt-wallpaper-tile[data-loading="true"]'], 'cursor', 'progress');
      expectDeclared(shortcutDialog, ['.x-lumno-action-button:disabled'], 'cursor', 'not-allowed');
    });

    it('keep disabled pager buttons hit-testable so not-allowed can render', () => {
      expect(newtab.entries.filter((entry) => entry.selectors.includes('.x-nt-bookmarks-pager-btn:disabled') &&
        entry.style.getPropertyValue('pointer-events') === 'none')).toEqual([]);
    });

    it('show not-allowed and progress on the overlay', () => {
      expectDeclared(overlayShell, on(PANEL, [
        'button:disabled', '[role="button"][aria-disabled="true"]', '[role="menuitem"][aria-disabled="true"]', '[role="option"][aria-disabled="true"]'
      ]), 'cursor', 'not-allowed');
      expectDeclared(overlayShell, on(PANEL, ['button[aria-busy="true"]:disabled', '[role="button"][aria-busy="true"]']), 'cursor', 'progress');
    });
  });

  describe('page-wide baselines', () => {
    const NEWTAB_SCOPE = 'body[data-lumno-page="newtab"]';

    it('point at every enabled control, React islands on New Tab included', () => {
      expectDeclared(newtab, on(NEWTAB_SCOPE, ENABLED_CONTROLS), 'cursor', 'pointer');
      expectDeclared(options, ENABLED_CONTROLS, 'cursor', 'pointer');
      expectDeclared(onboarding, ENABLED_CONTROLS, 'cursor', 'pointer');
      expectDeclared(overlayShell, on(PANEL, ENABLED_CONTROLS), 'cursor', 'pointer');
    });

    it('scope the New Tab baseline to its body, outside the legacy React root', () => {
      const doc = new DOMParser().parseFromString(readRepoText('newtab.html'), 'text/html');
      expect(doc.body.getAttribute('data-lumno-page')).toBe('newtab');
    });

    it('let control contents inherit the control cursor', () => {
      expectCursorInheritance(newtab, on(NEWTAB_SCOPE, CONTROL_CONTENTS));
      expectCursorInheritance(options, CONTROL_CONTENTS);
      expectCursorInheritance(onboarding, CONTROL_CONTENTS);
      expectCursorInheritance(overlayShell, [...on(PANEL, CONTROL_CONTENTS), `${PANEL} .x-ov-suggestion-item *`]);
    });

    it('keep decorative icons outside hit testing', () => {
      expectDeclared(newtab, on(NEWTAB_SCOPE, CONTROL_ICONS), 'pointer-events', 'none');
      expectDeclared(options, CONTROL_ICONS, 'pointer-events', 'none');
      expectDeclared(onboarding, CONTROL_ICONS, 'pointer-events', 'none');
      expectDeclared(overlayShell, [...on(PANEL, CONTROL_ICONS), `${PANEL} .x-ov-suggestion-item .ri-icon`], 'pointer-events', 'none');
    });

    it('keep the Options indicators from covering the controls under them', () => {
      expectDeclared(options, ['._x_extension_tabs_indicator_2024_unique_', '._x_extension_theme_indicator_2024_unique_'], 'pointer-events', 'none');
    });
  });
});
