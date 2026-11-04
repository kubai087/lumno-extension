import { act } from 'react';
import { describe, expect, it, vi } from 'vitest';
import newtabHtml from '../../../newtab.html?raw';
import { newtabGlassAdaptive, newtabGlassStyle, newtabLiquidGlassTintDark, newtabLiquidGlassTintLight } from '../../../src/domain/settings/newtab-page';
import { createBrowserFake } from '../../fakes/browser';
import { parseCss, readStylesheetSource } from '../../fakes/css';
import { bootReadyNewtab } from './boot';
import { pause } from './search-page';

// The New Tab glass material: none, frosted or liquid, and whether it adapts
// to the wallpaper. The liquid material's rim refraction is drawn by the
// liquid glass module, which needs a real canvas; the test counts the
// surfaces New Tab asks it for and hands each to the real one.
const surfaces = vi.hoisted(() => ({ created: 0, destroyed: 0, selector: '', properties: new Array<string>() }));

vi.mock(import('../../../src/newtab/dom/liquid-glass'), async (importOriginal) => {
  const real = await importOriginal();
  return {
    ...real,
    createLiquidSurfaces(options: Parameters<typeof real.createLiquidSurfaces>[0]) {
      surfaces.created += 1;
      surfaces.selector = options.selector;
      surfaces.properties.push(options.property);
      const created = real.createLiquidSurfaces(options);
      return {
        ...created,
        destroy() {
          surfaces.destroyed += 1;
          created.destroy();
        }
      };
    }
  };
});

async function openNewtab(style?: string, adaptive?: boolean, stored: Record<string, unknown> = {}) {
  Object.assign(surfaces, { created: 0, destroyed: 0, selector: '', properties: [] });
  const sync: Record<string, unknown> = { ...stored };
  if (style !== undefined) sync[newtabGlassStyle.key] = style;
  if (adaptive !== undefined) sync[newtabGlassAdaptive.key] = adaptive;
  const browser = createBrowserFake({ sync });
  await bootReadyNewtab(browser, { darkSystem: true });
  await pause(250);
  const body = document.body;
  return {
    style: () => body.getAttribute('data-glass-style'),
    inkFixed: () => body.hasAttribute('data-glass-ink-fixed'),
    inkHint: () => body.getAttribute('data-glass-ink-hint'),
    theme: () => body.getAttribute('data-theme'),
    async change(next: string) {
      await act(async () => browser.storage.sync.externalSet({ [newtabGlassStyle.key]: next }));
      await pause(80);
    },
    tint: (theme: 'light' | 'dark') => body.style.getPropertyValue(`--x-nt-glass-tint-k-${theme}`),
    async store(values: Record<string, unknown>) {
      await act(async () => browser.storage.sync.externalSet(values));
      await pause(80);
    },
    async changeAdaptive(next: boolean) {
      await act(async () => browser.storage.sync.externalSet({ [newtabGlassAdaptive.key]: next }));
      await pause(80);
    }
  };
}

describe('New Tab glass style', () => {
  it('keeps the original surfaces on a new installation', async () => {
    const page = await openNewtab();

    expect(page.style()).toBeNull();
    expect(surfaces.created).toBe(0);
  });

  it('applies a saved material at startup and a synced one live, refracting only liquid glass', async () => {
    const page = await openNewtab('frosted');
    expect(page.style()).toBe('frosted');
    expect(surfaces.created).toBe(0);

    await page.change('liquid');
    expect(page.style()).toBe('liquid');
    expect(surfaces.created).toBe(1);
    expect(surfaces.properties).toEqual(['--x-nt-glass-refraction']);
    // The search stack and the dock's cards bend; menus and the panel, on layers of their own,
    // sometimes show their lens's map in Chrome 155. The bookmarks bar keeps its own glass.
    expect(surfaces.selector).toContain('#_x_extension_newtab_suggestions_surface_2026_unique_');
    expect(surfaces.selector).toContain('.x-nt-recent-card-visual');
    expect(surfaces.selector).toContain(':not(.x-nt-bookmarks-topbar .x-nt-bookmark-card)');
    expect(surfaces.selector).not.toContain('_x_extension_menu_surface_2024_unique_');
    await page.change('liquid');
    expect(surfaces.created).toBe(1);
    await page.change('none');
    expect(page.style()).toBeNull();
    expect(surfaces.destroyed).toBe(1);
    await page.change('glass');
    expect(page.style()).toBeNull();
  });

  it('fixes the glass ink to the theme only while a material is on and adaptation is off', async () => {
    // The system theme here is dark.
    const page = await openNewtab('liquid', false);
    expect([page.inkFixed(), page.theme()]).toEqual([true, 'dark']);
    expect(page.inkHint()).toBe('dark');

    await page.change('none');
    expect(page.inkFixed()).toBe(false);
    await page.change('frosted');
    expect(page.inkFixed()).toBe(true);
    await page.changeAdaptive(true);
    expect([page.inkFixed(), page.theme()]).toEqual([false, 'dark']);
  });

  it('scales the liquid tint by the opacity set for each theme, and follows a synced change', async () => {
    const page = await openNewtab('liquid', undefined, { [newtabLiquidGlassTintDark.key]: 40 });
    expect([page.tint('light'), page.tint('dark')]).toEqual(['1', '0.4']);

    await page.store({ [newtabLiquidGlassTintLight.key]: 150, [newtabLiquidGlassTintDark.key]: 0 });
    expect([page.tint('light'), page.tint('dark')]).toEqual(['1.5', '0']);
  });

  it('adapts to the wallpaper and follows the New Tab theme by default', async () => {
    const page = await openNewtab('frosted');

    expect([page.inkFixed(), page.theme()]).toEqual([false, 'dark']);
  });
});

describe('New Tab glass stylesheet', () => {
  const glass = parseCss(readStylesheetSource('src/newtab/glass-style.css'));

  it('leaves the default style untouched', () => {
    glass.entries.forEach((entry) => entry.selectors.forEach((selector) => expect(selector.startsWith('body[data-glass-style')).toBe(true)));
  });

  it('gives a dialog flipped to dark glass every color the dark theme gives it', () => {
    const variables = (entries: typeof glass.entries) => new Set(entries.flatMap((entry) => entry.style.names.filter((name) => name.startsWith('--'))));
    const darkDialog = variables(parseCss(readStylesheetSource('src/newtab/shortcuts/shortcut-dialog.css')).entries
      .filter((entry) => entry.selectors.includes('body[data-theme="dark"] .x-nt-shortcut-dialog')));
    const glassDialog = variables(glass.entries.filter((entry) => entry.selectors.some((selector) =>
      /^body\[data-glass-style\] (\.x-nt-shortcut-dialog|:is\(\.x-nt-shortcut-dialog, \.x-nt-shortcut-dialog \*\)|\[data-glass-ink-theme="dark"\] \.x-nt-shortcut-dialog)$/.test(selector))));

    expect(darkDialog.has('--panel-text')).toBe(true);
    expect([...darkDialog].filter((name) => !glassDialog.has(name))).toEqual([]);
  });

  it('floats the search bar’s confirm bubble as glass, so it carries the ink it inherits from the bar', () => {
    const bubbleRule = (selector: string) => glass.entries.find((entry) => entry.selectors.includes(selector));

    expect(bubbleRule('body[data-glass-style] .x-lumno-search-input__popconfirm')?.style.getPropertyValue('background')).toBe('var(--x-nt-glass-fill)');
    expect(bubbleRule('body[data-glass-style] .x-lumno-search-input__popconfirm[data-open="true"]')?.style.getPropertyValue('backdrop-filter')).toContain('var(--x-nt-glass-float-filter)');
    expect(glass.entries.some((entry) => entry.style.getPropertyValue('backdrop-filter') === 'none' && entry.selectors.some((selector) =>
      selector.includes('#_x_extension_newtab_root_2024_unique_:has(') && selector.includes('.x-lumno-search-input__popconfirm[data-open="true"]')))).toBe(true);
  });

  it('scales the liquid tint, its veil and the recent cards\' inner sheet by the theme\'s opacity', () => {
    // The declaration of `name` in a rule for `selector`.
    const declared = (selector: string, name: string) => glass.entries
      .find((entry) => entry.selectors.includes(selector) && entry.style.getPropertyValue(name) !== '')?.style.getPropertyValue(name);
    const plates = glass.entries.find((entry) => entry.selectors.includes('body[data-glass-style]') &&
      entry.style.getPropertyValue('--x-nt-glass-tint-alpha') !== '')?.style;
    expect(plates?.getPropertyValue('--x-nt-glass-tint-alpha')).toContain('var(--x-nt-glass-tint-k, 1)');
    // Each theme takes its own factor, set on the body by the page.
    expect(declared('body[data-glass-style="liquid"]', '--x-nt-glass-tint-k')).toBe('var(--x-nt-glass-tint-k-light, 1)');
    expect(declared('body[data-glass-style="liquid"][data-theme="dark"]', '--x-nt-glass-tint-k')).toBe('var(--x-nt-glass-tint-k-dark, 1)');
    expect(declared('body[data-glass-style="liquid"]', '--x-nt-glass-veil-k')).toBe('min(1, var(--x-nt-glass-tint-k))');
    // The veil (contrast and brightness) thins with it; blur and saturation stay.
    const filter = declared('body[data-glass-style="liquid"][data-nt-ready="1"]', '--x-nt-glass-filter') || '';
    expect(filter).toContain('blur(var(--x-nt-glass-blur))');
    expect(filter).toContain('contrast(calc(1 + (var(--x-nt-glass-contrast) - 1) * var(--x-nt-glass-veil-k)))');
    expect(filter).toContain('brightness(calc(1 + (var(--x-nt-glass-brightness) - 1) * var(--x-nt-glass-veil-k)))');
    expect(declared('body[data-glass-style="liquid"] .x-nt-recent-inner', 'background-color')).toContain('var(--x-nt-glass-veil-k)');
  });

  it('lights the rim of the liquid plates from inside, in both themes, and not the small controls', () => {
    const edgeRules = glass.entries.filter((entry) => entry.style.getPropertyValue('--x-nt-glass-edge').includes('var(--x-nt-glass-bevel)'));
    const selectors = edgeRules.flatMap((entry) => entry.selectors).join(' ');
    ['#_x_extension_newtab_suggestions_surface_2026_unique_', '.x-nt-bookmark-card', '.x-nt-recent-card-visual', '._x_extension_menu_surface_2024_unique_']
      .forEach((plate) => expect(selectors).toContain(plate));
    expect(selectors).toContain('[data-theme="dark"]');
    expect(selectors).not.toContain('.x-nt-shortcut-icon');
    expect(selectors).not.toContain('.x-nt-wallpaper-button');
    const bevel = (selector: string) => glass.entries
      .find((entry) => entry.selectors.includes(selector) && entry.style.getPropertyValue('--x-nt-glass-bevel') !== '')?.style.getPropertyValue('--x-nt-glass-bevel');
    expect(bevel('body[data-glass-style="liquid"]')).toContain('inset 0 6px 8px -6px rgba(255, 255, 255, 0.5)');
    expect(bevel('body[data-glass-style="liquid"][data-theme="dark"]')).toContain('inset 0 6px 8px -6px rgba(255, 255, 255, 0.18)');
  });

  it('loads after the page styles it overrides', () => {
    const page = new DOMParser().parseFromString(newtabHtml, 'text/html');
    const links = Array.from(page.querySelectorAll('link[rel="stylesheet"]'), (link) => link.getAttribute('href') || '');
    const index = links.indexOf('glass-style.css');

    expect(index).toBeGreaterThan(0);
    expect(links.slice(0, index).some((href) => href.startsWith('styles/'))).toBe(true);
    expect(links.slice(index + 1).some((href) => href.startsWith('styles/'))).toBe(false);
  });
});
