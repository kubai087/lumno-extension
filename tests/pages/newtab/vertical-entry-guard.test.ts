import { act } from 'react';
import { describe, expect, it } from 'vitest';
import { NEWTAB_TOP_CONTENT_OFF, NEWTAB_TOP_CONTENT_TIME, newtabTopContentMode } from '../../../src/domain/settings/newtab-time';
import { createBrowserFake } from '../../fakes/browser';
import { parseCss, parsePageCss, readStylesheet, type ParsedCss } from '../../fakes/css';
import { getElement, getElementById } from '../../fakes/dom';
import { pause } from './search-page';
import { bootReadyNewtab } from './boot';

// New Tab's panels, menus, hints and entry motion reveal in place: nothing
// slides in vertically.
const VERTICAL_TRANSLATION = /\btranslate(?:Y|3d)?\s*\(|\btranslate\s*:/;
const newtabCss = parsePageCss('newtab.html');
const featureHintCss = parseCss(readStylesheet('src/shared/ui/feature-hints.css'));
const shortcutDialogCss = parseCss(readStylesheet('src/newtab/shortcuts/shortcut-dialog.css'));

function blocks(css: ParsedCss, matches: (selector: string) => boolean) {
  return css.entries
    .map((entry) => ({ selector: entry.selectors.join(', '), declarations: entry.style.cssText }))
    .filter(({ selector }) => matches(selector));
}

describe('New Tab vertical entry guard', () => {
  it.each([
    '.x-nt-feedback-popover',
    '.x-nt-feedback-menu',
    '.x-nt-feedback-detail',
    '.x-nt-shortcut-context-menu-portal',
    '.x-nt-section-mode-portal',
    '.x-nt-wallpaper-panel',
    '.x-nt-wallpaper-body',
    '.x-nt-panel-collapsible',
    '.x-nt-wallpaper-grid[data-motion="enter"]',
    '.x-nt-search-width-control',
    '.x-nt-effect-slider-control',
    '.x-nt-folder-preview',
    '.x-nt-bookmark-cascade-debug-label',
    '.x-nt-bookmark-cascade-level',
    '.x-nt-recent-action',
    '.x-nt-recent-pin'
  ])('reveals %s in place', (fragment) => {
    const matching = blocks(newtabCss, (selector) => selector.includes(fragment));
    expect(matching.length).toBeGreaterThan(0);
    matching.forEach(({ declarations }) => expect(declarations).not.toMatch(VERTICAL_TRANSLATION));
  });

  it.each([
    '.x-lumno-feature-hint--newtab-ai-quick-jump',
    '.x-lumno-feature-hint--newtab-tab-switcher',
    '.x-lumno-feature-hint--newtab-webdav-sync',
    '.x-lumno-feature-hint--newtab-help-center-ask',
    '.x-lumno-feature-hint--update-notice-newtab'
  ])('reveals the %s feature hint in place', (fragment) => {
    const matching = blocks(featureHintCss, (selector) => selector.includes(fragment));
    expect(matching.length).toBeGreaterThan(0);
    matching.forEach(({ declarations }) => expect(declarations).not.toMatch(VERTICAL_TRANSLATION));
  });

  it('moves the wallpaper hint vertically only to center it on its anchor', () => {
    const matching = blocks(featureHintCss, (selector) => selector.includes('.x-lumno-feature-hint--newtab-wallpaper'));
    expect(matching.length).toBeGreaterThan(0);
    matching.forEach(({ declarations }) => {
      (declarations.match(/translateY\([^)]*\)/g) || []).forEach((translation) => expect(translation).toBe('translateY(-50%)'));
    });
  });

  it('opens the shortcut dialog in place', () => {
    const matching = blocks(shortcutDialogCss, (selector) => selector.includes('.x-nt-shortcut-dialog') && !selector.includes('.x-lumno-action-button'));
    expect(matching.length).toBeGreaterThan(0);
    matching.forEach(({ declarations }) => expect(declarations).not.toMatch(VERTICAL_TRANSLATION));
  });

  it('overrides the shared vertical reveal of tooltips', () => {
    const rest = newtabCss.entries.find((entry) => entry.selectors.some((selector) => selector.startsWith(
      'body ._x_extension_tooltip_2026_unique_._x_extension_cursor_tooltip_tag_2026_unique_[data-tooltip-kind][data-visible="true"]'
    )));
    expect(rest?.style.getPropertyValue('transform')).toBe('none');
  });

  it.each([
    '_x_nt_time_seconds_soft_swap_2026_unique_',
    '_x_nt_wordmark_enter_2026_unique_',
    '_x_nt_shortcut_entry_2026_unique_',
    '_x_nt_content_section_entry_2026_unique_',
    '_x_nt_corner_control_entry_2026_unique_',
    '_x_nt_topbar_entry_2026_unique_',
    '_x_nt_topbar_floating_entry_2026_unique_',
    '_x_nt_topbar_content_entry_2026_unique_'
  ])('keeps @keyframes %s at the final vertical coordinate', (name) => {
    const frames = newtabCss.keyframes(name);
    expect(frames).not.toBeNull();
    expect(Object.values(frames || {}).map((frame) => frame.cssText).join(' ')).not.toMatch(VERTICAL_TRANSLATION);
  });

  it('keeps the horizontal direction cue of the wallpaper source tabs', () => {
    expect(newtabCss.rule('.x-nt-wallpaper-grid[data-motion="enter-next"]')?.get('transform')).toBe('translateX(8px)');
    expect(newtabCss.rule('.x-nt-wallpaper-grid[data-motion="enter-prev"]')?.get('transform')).toBe('translateX(-8px)');
  });

  it('opens the scope panel where it closes and shows the top content in place', async () => {
    const browser = createBrowserFake();
    await bootReadyNewtab(browser);
    const menu = getElement(document, '.x-lumno-search-input-mode__menu');
    const vertical = (name: string) => (menu.style.getPropertyValue(name).match(/^translateY\(.*\)(?= scale)/) || [''])[0];
    const closed = vertical('--x-extension-menu-surface-closed-transform');

    expect(closed).toBeTruthy();
    expect(vertical('--x-extension-menu-surface-open-transform')).toBe(closed);
    const topContent = getElementById('_x_extension_newtab_wordmark_2026_unique_');
    await act(async () => browser.storage.sync.externalSet({ [newtabTopContentMode.key]: NEWTAB_TOP_CONTENT_OFF }));
    await pause(200);
    await act(async () => browser.storage.sync.externalSet({ [newtabTopContentMode.key]: NEWTAB_TOP_CONTENT_TIME }));
    await pause(200);
    expect(topContent.getAttribute('style') || '').not.toMatch(VERTICAL_TRANSLATION);
  });
});
