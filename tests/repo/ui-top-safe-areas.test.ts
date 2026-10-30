// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { parseCss, parsePageCss, readStylesheetSource, type CssRule, type ParsedCss } from '../fakes/css';

// Every surface keeps clear of the device's safe areas and, where it can
// move, of the visual viewport's top inset. (How the pages follow the visual
// viewport at run time is checked in tests/pages and beside the overlay.)

const flat = (value: string | null | undefined) => String(value || '').replace(/\s+/g, ' ').replace(/\(\s+/g, '(').replace(/\s+\)/g, ')').trim();

function rule(css: ParsedCss, selector: string): CssRule {
  const found = css.rule(selector);
  if (!found) {
    throw new Error(`missing ${selector}`);
  }
  return found;
}

const anyDeclaration = (found: CssRule, pattern: RegExp) => found.names().some((name) => pattern.test(found.get(name) || ''));

describe('top safe areas', () => {
  describe('New Tab', () => {
    const newtab = parsePageCss('newtab.html');
    const shortcutDialog = parseCss(readStylesheetSource('src/newtab/shortcuts/shortcut-dialog.css'));

    it('combines the device and visual viewport top insets in one shared token', () => {
      const root = newtab.entries.find((entry) => entry.style.getPropertyValue('--x-nt-top-safe-inset'));

      expect(root).toBeDefined();
      expect(flat(root?.style.getPropertyValue('--x-nt-visual-viewport-top-inset'))).toBe('0px');
      expect(flat(root?.style.getPropertyValue('--x-nt-top-safe-inset')))
        .toMatch(/^max\(env\(safe-area-inset-top\), var\(--x-nt-visual-viewport-top-inset, 0px\)\)$/);
      expect(flat(root?.style.getPropertyValue('--x-nt-top-occupied-inset'))).toBe('var(--x-nt-top-safe-inset)');
    });

    it('reserves both the top bookmark bar and the safe area', () => {
      expect(newtab.entries.some((entry) => entry.selectors.includes('body[data-nt-top-occupied="true"]') &&
        /36px \+ var\(--x-nt-top-safe-inset\)/.test(entry.style.cssText))).toBe(true);
    });

    it('hides the bottom dock until the stored layout mode is restored', () => {
      expect(rule(newtab, 'body:not([data-nt-ready="1"]) #_x_extension_newtab_bottom_dock_2024_unique_').get('visibility')).toBe('hidden');
    });

    it('keeps the top bookmark bar in page coordinates below the device safe area, without following or scaling with the visual viewport', () => {
      const topbar = rule(newtab, '.x-nt-bookmarks-topbar');

      expect([topbar.get('position'), topbar.get('top')]).toEqual(['absolute', 'env(safe-area-inset-top)']);
      expect(topbar.names().filter((name) => /--x-nt-visual-viewport-top-inset|--x-nt-top-safe-inset/.test(topbar.get(name) || '') ||
        name === 'zoom' || (name === 'transform' && /scale/.test(topbar.get(name) || '')))).toEqual([]);
    });

    it('keeps the appearance panel below the top bar, scrolling inside its body under a fixed heading', () => {
      const panel = rule(newtab, '.x-nt-wallpaper-panel');
      const scroll = rule(newtab, '.x-nt-wallpaper-panel-scroll');
      const header = rule(newtab, '.x-nt-appearance-header');

      expect([panel.get('max-height'), panel.get('overflow')]).toEqual(['calc(100dvh - 76px - var(--x-nt-top-bar-max-inset))', 'hidden']);
      expect([scroll.get('overflow'), scroll.get('overscroll-behavior')]).toEqual(['hidden auto', 'contain']);
      expect(['flex', 'position', 'z-index', 'background'].map((name) => header.get(name))).toEqual(['0 0 auto', 'relative', '6', 'var(--x-nt-panel-surface)']);
    });

    it('keeps feedback details and shortcut dialogs out from under occupied top UI', () => {
      const dialog = rule(shortcutDialog, '.x-nt-shortcut-dialog');

      expect(rule(newtab, '.x-nt-feedback-control[data-detail-open="true"] .x-nt-feedback-popover').get('height'))
        .toMatch(/calc\(100dvh - 84px - var\(--x-nt-top-occupied-inset, 0px\)\)/);
      expect(anyDeclaration(rule(shortcutDialog, '.x-nt-shortcut-dialog-backdrop'), /var\(--x-nt-top-occupied-inset, 0px\)/)).toBe(true);
      expect(dialog.get('max-height')).toMatch(/var\(--x-nt-top-occupied-inset, 0px\)/);
      expect([dialog.get('overflow'), dialog.get('overscroll-behavior')]).toEqual(['hidden auto', 'contain']);
    });
  });

  describe('Settings', () => {
    const options = parsePageCss('src/options/options.html');

    it('pads its content clear of the device safe areas', () => {
      const root = options.entries.find((entry) => /env\(safe-area-inset-top\)/.test(entry.style.getPropertyValue('padding-top')) &&
        entry.style.getPropertyValue('padding-bottom'));

      expect(flat(root?.style.getPropertyValue('padding-right'))).toBe('max(20px, env(safe-area-inset-right))');
      expect(flat(root?.style.getPropertyValue('padding-bottom'))).toBe('max(40px, env(safe-area-inset-bottom))');
    });

    it('keeps toasts below the top safe area', () => {
      expect(rule(options, '._x_extension_toast_2024_unique_').get('--x-lumno-toast-top')).toBe('max(24px, calc(env(safe-area-inset-top) + 12px))');
    });

    it('scrolls dialogs inside safe-area-aware masks', () => {
      const mask = rule(options, '._x_extension_confirm_mask_2024_unique_');

      expect(anyDeclaration(mask, /env\(safe-area-inset-top\)/)).toBe(true);
      expect([mask.get('overflow'), mask.get('overscroll-behavior')]).toEqual(['auto', 'contain']);
      expect(rule(options, '._x_extension_confirm_dialog_2024_unique_').get('max-height')).toMatch(/^calc\(100dvh/);
    });
  });

  it('keeps the onboarding copy and actions in safe padding in every responsive tier', () => {
    const copyPanels = parsePageCss('src/onboarding/onboarding.html').entries
      .filter((entry) => entry.selectors.includes('.copy-panel') && entry.style.getPropertyValue('padding'));

    expect(copyPanels.length).toBeGreaterThan(0);
    copyPanels.forEach((entry) => {
      const padding = flat(entry.style.getPropertyValue('padding'));
      expect(padding).toContain('max(var(--onboarding-copy-padding-y), calc(env(safe-area-inset-top) + 12px))');
      expect(padding).toContain('max(var(--onboarding-copy-padding-y), calc(env(safe-area-inset-bottom) + 12px))');
    });
  });
});
