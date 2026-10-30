import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  STORAGE_KEYS,
  createRuntime,
  installBroadcastChannel,
  installMatchMedia,
  openPanel,
  panelActions,
  panelOf,
  panelState
} from '../../../tests/fakes/wallpaper/runtime';
import { required } from '../../../tests/fakes/dom';

vi.mock('../react/wallpaper-view', async () => ({
  createWallpaperViewController: (await import('../../../tests/fakes/wallpaper/view-recorder')).createRecordingWallpaperView
}));

const DARK_SCHEME = '(prefers-color-scheme: dark)';
const FAVICON_THEME_CHANNEL = 'lumno:newtab-favicon-theme';
let media: ReturnType<typeof installMatchMedia>;

beforeEach(() => {
  media = installMatchMedia();
  installBroadcastChannel();
});

function faviconLink(root: ParentNode = document.head): HTMLLinkElement {
  const link = root.querySelector('link');
  if (!(link instanceof HTMLLinkElement)) {
    throw new Error('Expected a favicon link.');
  }
  return link;
}

function decodeSvgDataUrl(url: string | null): string {
  const prefix = 'data:image/svg+xml;charset=UTF-8,';
  const text = String(url || '');
  expect(text.startsWith(prefix)).toBe(true);
  return decodeURIComponent(text.slice(prefix.length));
}

describe('the New Tab favicon choice', () => {
  async function setup() {
    const harness = await createRuntime({
      sync: { [STORAGE_KEYS.favicon]: 'default' },
      formatMessage: (_key, fallback, params) => String(fallback || '').replace('{name}', String(params ? params.name : ''))
    });
    await harness.runtime.bootstrapInitialNewtabFavicon();
    harness.runtime.createControls();
    openPanel(harness.runtime);
    return harness;
  }

  it('offers the default and the alternate icon, previewed', async () => {
    const { runtime } = await setup();
    const { favicon } = panelState(runtime);
    const model = required(panelOf(runtime).model.favicons, 'the favicon model');
    expect(favicon.title).toBe('New Tab favicon');
    expect(favicon.options.map((option) => [option.id, option.selected])).toEqual([['default', true], ['alternate', false]]);
    expect(favicon.options[1].label).toBe('Select Alternate favicon');
    expect(model[0].previewUrl).toContain('assets/images/lumno.png');
    expect(required(model[1].inlineSvg)[0]).toBe('svg');
  });

  it('previews the alternate icon as the supplied lumno1.svg shapes', async () => {
    const { runtime } = await setup();
    const model = required(panelOf(runtime).model.favicons, 'the favicon model');
    const preview = JSON.stringify(required(model.find((item) => item.id === 'alternate')).inlineSvg);
    expect(preview).toContain('M14.1832');
    expect(preview).toContain('M34.0761');
  });

  it('saves the choice, caches it for the next preload and applies a themed SVG icon', async () => {
    const { runtime, browser } = await setup();
    panelActions(runtime).selectFavicon('alternate');

    await vi.waitFor(() => expect(browser.storage.sync.values[STORAGE_KEYS.favicon]).toBe('alternate'));
    expect(localStorage.getItem(STORAGE_KEYS.faviconPreload)).toBe('alternate');
    expect(panelState(runtime).favicon.options.map((option) => option.selected)).toEqual([false, true]);
    const link = faviconLink();
    expect(link.getAttribute('rel')).toBe('icon');
    expect(link.getAttribute('type')).toBe('image/svg+xml');
    expect(link.getAttribute('sizes')).toBe('any');
    expect(link.getAttribute('data-newtab-favicon-id')).toBe('alternate');
    expect(link.getAttribute('data-lumno-newtab-favicon-theme')).toBe('light');
    const lightSvg = decodeSvgDataUrl(link.getAttribute('href'));
    expect(lightSvg).toMatch(/fill="#000000"/);
    expect(lightSvg).toMatch(/fill-opacity="0\.5"/);
  });

  it('follows the browser color scheme, and re-checks it when a background tab regains focus', async () => {
    const { runtime } = await setup();
    panelActions(runtime).selectFavicon('alternate');
    const link = faviconLink();
    const lightHref = link.getAttribute('href');

    media.set(DARK_SCHEME, true);
    expect(link.getAttribute('data-lumno-newtab-favicon-theme')).toBe('dark');
    const darkHref = link.getAttribute('href');
    expect(darkHref).not.toBe(lightHref);
    const darkSvg = decodeSvgDataUrl(darkHref);
    expect(darkSvg).toMatch(/fill="#f1f3f4"/);
    expect(darkSvg).toMatch(/fill-opacity="0\.72"/);

    media.set(DARK_SCHEME, false);
    expect(link.getAttribute('data-lumno-newtab-favicon-theme')).toBe('light');
    expect(link.getAttribute('href')).toBe(lightHref);

    // A background tab can miss the media query change.
    media.setSilently(DARK_SCHEME, true);
    expect(link.getAttribute('href')).toBe(lightHref);
    window.dispatchEvent(new Event('focus'));
    expect(link.getAttribute('data-lumno-newtab-favicon-theme')).toBe('dark');
    expect(decodeSvgDataUrl(link.getAttribute('href'))).toMatch(/fill="#f1f3f4"/);
  });

  // Each tab follows the scheme through its own media query; one that missed
  // the change hears of it from the tab that saw it.
  it('tells the other New Tabs of a scheme change it sees', async () => {
    const { runtime } = await createRuntime({ sync: { [STORAGE_KEYS.favicon]: 'alternate' } });
    await runtime.bootstrapInitialNewtabFavicon();
    const otherTab = new BroadcastChannel(FAVICON_THEME_CHANNEL);
    const heard: unknown[] = [];
    otherTab.addEventListener('message', (event) => heard.push(event.data));

    media.set(DARK_SCHEME, true);

    expect(heard).toEqual([expect.objectContaining({ action: 'lumno:newtab-favicon-theme-refresh' })]);
    otherTab.close();
  });

  it('refreshes its icon unfocused when another New Tab tells of a scheme change', async () => {
    const { runtime } = await createRuntime({ sync: { [STORAGE_KEYS.favicon]: 'alternate' } });
    await runtime.bootstrapInitialNewtabFavicon();
    const link = faviconLink();
    const lightHref = link.getAttribute('href');
    expect(link.getAttribute('data-lumno-newtab-favicon-theme')).toBe('light');
    media.setSilently(DARK_SCHEME, true);
    const otherTab = new BroadcastChannel(FAVICON_THEME_CHANNEL);

    otherTab.postMessage({ action: 'lumno:newtab-favicon-theme-refresh', at: Date.now() });

    expect(link.getAttribute('data-lumno-newtab-favicon-theme')).toBe('dark');
    expect(link.getAttribute('href')).not.toBe(lightHref);
    expect(decodeSvgDataUrl(link.getAttribute('href'))).toMatch(/fill="#f1f3f4"/);
    otherTab.close();
  });
});
