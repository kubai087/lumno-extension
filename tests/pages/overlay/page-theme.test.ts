import { afterEach, describe, expect, it, vi } from 'vitest';
import { OVERLAY_HOST_ID, OVERLAY_ID, OVERLAY_INPUT_ID, bootOverlayPage, settle, waitFor } from './boot';
import { getElementById, required } from '../../fakes/dom';
import { parseCss, readStylesheet } from '../../fakes/css';

// The overlay takes the theme of the page it opens on: it is themed, and its
// input shielded from page extensions, before its host joins the page; it
// samples the page once per open, before changing anything there; and it
// follows the "adapt theme colors to each webpage" setting live.

const ADAPTATION_KEY = '_x_extension_overlay_page_theme_adaptation_enabled_2026_unique_';
const THEME_KEY = '_x_extension_theme_mode_2024_unique_';
const FONT_FACES_ID = '_x_extension_overlay_font_faces_2026_unique_';
const CJK_FACES_ID = '_x_extension_overlay_cjk_font_faces_2026_unique_';
const LIGHT_PAGE = '<!doctype html><html><head><meta name="color-scheme" content="light"></head><body>Page</body></html>';
// Password managers, grammar checkers and writing suggestions skip the input.
const INPUT_ISOLATION: Record<string, string> = {
  'data-1p-ignore': 'true',
  'data-op-ignore': 'true',
  'data-lpignore': 'true',
  'data-bwignore': 'true',
  'data-form-type': 'other',
  'data-gramm': 'false',
  'data-lt-active': 'false',
  spellcheck: 'false',
  writingsuggestions: 'false'
};

// Calls `seen` with the host and its closed shadow root as the host joins the page.
function watchHostMount(seen: (host: Element, root: ShadowRoot | undefined) => void): void {
  const roots = new WeakMap<Element, ShadowRoot>();
  const attachShadow = Element.prototype.attachShadow;
  vi.spyOn(Element.prototype, 'attachShadow').mockImplementation(function (this: Element, init: ShadowRootInit) {
    const root: ShadowRoot = Reflect.apply(attachShadow, this, [init]);
    roots.set(this, root);
    return root;
  });
  const appendChild = Node.prototype.appendChild;
  vi.spyOn(Node.prototype, 'appendChild').mockImplementation(function <T extends Node>(this: Node, child: T): T {
    if (child instanceof Element && child.id === OVERLAY_HOST_ID) {
      seen(child, roots.get(child));
    }
    return Reflect.apply(appendChild, this, [child]);
  });
}

const panelOf = (root: ShadowRoot) => required(root.getElementById(OVERLAY_ID), 'the overlay panel');

afterEach(() => {
  Reflect.deleteProperty(document, 'elementFromPoint');
});

describe('Overlay page theme', () => {
  it('is themed and shields its input before its host joins the page, and focuses only once shown', async () => {
    const atMount: Array<{ theme: string | null; input: Record<string, string | null> | null; focused: boolean }> = [];
    watchHostMount((_host, root) => {
      const shadow = required(root, 'the host shadow root');
      const input = shadow.getElementById(OVERLAY_INPUT_ID);
      atMount.push({
        theme: panelOf(shadow).getAttribute('data-theme'),
        input: input && Object.fromEntries(Object.keys(INPUT_ISOLATION).map((name) => [name, input.getAttribute(name)])),
        focused: shadow.activeElement !== null && shadow.activeElement === input
      });
    });
    const page = await bootOverlayPage({ darkSystem: true });
    await page.open();
    expect(atMount).toHaveLength(1);
    expect(atMount[0]).toEqual({ theme: 'dark', input: INPUT_ISOLATION, focused: false });
    expect(page.root()?.activeElement).toBe(page.input());
  });

  // Hit-testing the page forces a style and layout pass once it has pending
  // changes, and each font face added to the page restyles all of it.
  it('samples the page once per open, before adding its fonts or host, and again only when the page theme changes', async () => {
    const samples: Array<{ hostMounted: boolean; fontFaces: boolean }> = [];
    const atMount: Array<{ fontFaces: boolean; cjkFaces: boolean }> = [];
    Object.defineProperty(document, 'elementFromPoint', {
      configurable: true,
      value: () => {
        samples.push({ hostMounted: Boolean(document.getElementById(OVERLAY_HOST_ID)), fontFaces: Boolean(document.getElementById(FONT_FACES_ID)) });
        return document.body;
      }
    });
    watchHostMount(() => {
      atMount.push({ fontFaces: Boolean(document.getElementById(FONT_FACES_ID)), cjkFaces: Boolean(document.getElementById(CJK_FACES_ID)) });
    });
    const page = await bootOverlayPage({ settings: { _x_extension_language_2024_unique_: 'system' } });
    page.browser.i18n.getUILanguage = () => 'zh-CN';
    await page.open();
    const perOpen = samples.length;
    expect(perOpen).toBeGreaterThan(0);
    expect(samples.every((sample) => !sample.hostMounted && !sample.fontFaces)).toBe(true);
    expect(atMount).toEqual([{ fontFaces: true, cjkFaces: true }]);
    const cjkCss = getElementById(CJK_FACES_ID).textContent;
    expect(cjkCss).toMatch(/PingFangSC-Medium/);

    document.documentElement.setAttribute('data-theme', 'dark');
    await waitFor(() => samples.length === perOpen * 2, 'a page theme change did not sample the page again');
    await settle(60);
    expect(samples).toHaveLength(perOpen * 2);
    expect(getElementById(CJK_FACES_ID).textContent).toBe(cjkCss);
  });

  it('follows the page theme adaptation setting live while the theme follows the system', async () => {
    const page = await bootOverlayPage({ html: LIGHT_PAGE, darkSystem: true });
    const panel = panelOf(await page.open());
    expect(panel.getAttribute('data-theme')).toBe('light');

    page.changeSetting(ADAPTATION_KEY, false);
    await settle();
    expect(panel.getAttribute('data-theme')).toBe('dark');
    page.changeSetting(ADAPTATION_KEY, true);
    await settle();
    expect(panel.getAttribute('data-theme')).toBe('light');
  });

  it('stays dark on a light page when dark is chosen, with a stronger background only there', async () => {
    const page = await bootOverlayPage({ html: LIGHT_PAGE, settings: { [THEME_KEY]: 'dark' } });
    const panel = panelOf(await page.open());
    expect(panel.getAttribute('data-theme')).toBe('dark');
    const overLight = panel.style.getPropertyValue('--x-ov-bg');

    required(document.head.querySelector('meta[name="color-scheme"]'), 'the color-scheme meta').setAttribute('content', 'dark');
    await waitFor(() => panel.style.getPropertyValue('--x-ov-bg') !== overLight, 'the dark panel kept its stronger background over a dark page');
    expect(panel.getAttribute('data-theme')).toBe('dark');
  });
});

describe('Overlay style reveal', () => {
  const overlay = `#${OVERLAY_ID}`;

  // What the overlay puts in its shadow root before its component
  // stylesheets arrive, read through the CSS object model.
  it('styles its controls before its stylesheets load, below their specificity', async () => {
    const page = await bootOverlayPage();
    const root = await page.open();
    const shell = parseCss(Array.from(root.querySelectorAll('style'), (style) => style.textContent || '').join('\n'));
    const rule = (selector: string) => required(shell.rule(selector), selector);

    const switchButton = rule(`:where(${overlay}) :where(.x-ov-suggestion-switch-button)`);
    expect(['background', 'border-radius', 'font', 'font-size', 'height'].map((name) => switchButton.get(name)))
      .toEqual(['var(--x-ov-suggestion-action-button-bg, transparent)', '6px', 'inherit', '12px', 'var(--x-ov-suggestion-action-height, 26px)']);
    expect(shell.selectors()).not.toContain(`${overlay} .x-ov-suggestion-switch-button`);
    const inputFallback = rule(`:where(${overlay}) :where(.x-lumno-search-input, .x-lumno-search-input__container)`);
    expect([inputFallback.get('all'), inputFallback.get('width')]).toEqual(['unset', '100%']);
    expect(rule(`:where(${overlay}[data-lumno-site-fix-style-fallback]) :where(.x-ov-suggestions-container)`).get('visibility')).toBe('hidden');

    // A late input stylesheet hides the deferred mode controls, not the actions.
    const hiddenControls = required(shell.entries.find((entry) => entry.style.getPropertyValue('display') === 'none' &&
      entry.selectors.some((selector) => selector.startsWith(`:where(${overlay}[data-lumno-site-fix-style-fallback])`) && selector.includes('mode__prefix'))),
    'the deferred mode controls rule');
    const hidden = hiddenControls.selectors.join(' ');
    ['mode__prefix', 'mode__badge', 'mode__tab-hint'].forEach((part) => expect(hidden).toContain(part));
    ['search-input__right-icon', 'x-ov-close-other-tabs'].forEach((part) => expect(hidden).not.toContain(part));

    // Icons draw from cached Remix SVGs in the theme's icon color while the icon font loads.
    ['.x-lumno-search-input__icon', '.x-lumno-search-input__right-icon', '.x-ov-close-other-tabs'].forEach((icon) => {
      const mask = rule(`:where(${overlay}) :where(${icon})::before`);
      expect(mask.get('mask-image')).toMatch(/^url\("chrome-extension:\/\/[^/]+\/assets\/remixicon\/.+\.svg"\)$/);
      expect(mask.get('background-color')).toBe('currentColor');
      expect(mask.has('border')).toBe(false);
    });
  });

  it.each([
    ['src/shared/search/search-input.css', '.x-lumno-search-input__right-icon'],
    ['src/overlay/suggestions-view.css', '.x-ov-close-other-tabs']
  ])('keeps %s from transitioning %s out of the native button face while revealing', (file, control) => {
    const found = parseCss(readStylesheet(file)).rule(`${overlay}[data-lumno-site-fix-reveal] ${control}`);
    expect(found && [found.get('transition'), found.priority('transition')]).toEqual(['none', 'important']);
  });
});
