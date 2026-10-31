import { act } from 'react';
import { describe, expect, it, vi } from 'vitest';
import newtabHtml from '../../../newtab.html?raw';
import { newtabGlassStyle, newtabGlassTheme } from '../../../src/domain/settings/newtab-page';
import { createBrowserFake } from '../../fakes/browser';
import { parseCss, readStylesheetSource } from '../../fakes/css';
import { bootReadyNewtab } from './boot';
import { pause } from './search-page';

// The New Tab glass material: none, frosted or liquid, and the light or dark
// it holds the page in. The liquid material's rim refraction is drawn by the
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

async function openNewtab(style?: string, theme?: string) {
  Object.assign(surfaces, { created: 0, destroyed: 0, selector: '', properties: [] });
  const sync: Record<string, unknown> = {};
  if (style !== undefined) sync[newtabGlassStyle.key] = style;
  if (theme !== undefined) sync[newtabGlassTheme.key] = theme;
  const browser = createBrowserFake({ sync });
  await bootReadyNewtab(browser, { darkSystem: true });
  await pause(250);
  const body = document.body;
  return {
    style: () => body.getAttribute('data-glass-style'),
    glassTheme: () => body.getAttribute('data-glass-theme'),
    inkHint: () => body.getAttribute('data-glass-ink-hint'),
    theme: () => body.getAttribute('data-theme'),
    async change(next: string) {
      await act(async () => browser.storage.sync.externalSet({ [newtabGlassStyle.key]: next }));
      await pause(80);
    },
    async changeTheme(next: string) {
      await act(async () => browser.storage.sync.externalSet({ [newtabGlassTheme.key]: next }));
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

  it('holds the page’s theme with the material’s light or dark only while a material is on', async () => {
    // The system theme here is dark.
    const page = await openNewtab('liquid', 'light');
    expect([page.glassTheme(), page.theme()]).toEqual(['light', 'light']);
    expect(page.inkHint()).toBe('dark');

    await page.changeTheme('dark');
    expect([page.glassTheme(), page.theme()]).toEqual(['dark', 'dark']);
    await page.changeTheme('light');
    await page.change('none');
    expect([page.glassTheme(), page.theme()]).toEqual([null, 'dark']);
    await page.change('frosted');
    expect([page.glassTheme(), page.theme()]).toEqual(['light', 'light']);
    await page.changeTheme('follow');
    expect([page.glassTheme(), page.theme()]).toEqual([null, 'dark']);
  });

  it('follows the New Tab theme for a material without a theme of its own', async () => {
    const page = await openNewtab('frosted');

    expect([page.glassTheme(), page.theme()]).toEqual([null, 'dark']);
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

  it('loads after the page styles it overrides', () => {
    const page = new DOMParser().parseFromString(newtabHtml, 'text/html');
    const links = Array.from(page.querySelectorAll('link[rel="stylesheet"]'), (link) => link.getAttribute('href') || '');
    const index = links.indexOf('glass-style.css');

    expect(index).toBeGreaterThan(0);
    expect(links.slice(0, index).some((href) => href.startsWith('styles/'))).toBe(true);
    expect(links.slice(index + 1).some((href) => href.startsWith('styles/'))).toBe(false);
  });
});
