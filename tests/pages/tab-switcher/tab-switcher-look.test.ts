import { describe, expect, it, vi } from 'vitest';
import { act } from 'react';
import { bootTabSwitcherPage, settle, switcherTabs, THEME_KEY, type TabSwitcherPage } from './boot';
import { required } from '../../fakes/dom';

// Where the tab switcher sits on the page, the theme it takes, its cards and
// the stylesheet it brings into its shadow root.

const openDefault = (page: TabSwitcherPage, extra: Record<string, unknown> = {}) =>
  page.open({ tabs: switcherTabs(4), shortcut: 'Alt+Q', ...extra });

// JSDOM has neither popovers nor modal dialogs: the page gets the browser
// pieces the switcher relies on, showPopover and a dialog matching :modal.
function stubTopLayer(implementation: (this: HTMLElement) => void) {
  const showPopover = vi.fn(implementation);
  Object.defineProperty(HTMLElement.prototype, 'showPopover', { configurable: true, writable: true, value: showPopover });
  return showPopover;
}

function openModalDialog(): HTMLDialogElement {
  const dialog = document.createElement('dialog');
  dialog.setAttribute('open', '');
  const nativeMatches = Element.prototype.matches;
  Object.defineProperty(dialog, 'matches', {
    value: (selector: string) => selector === ':modal' || Reflect.apply(nativeMatches, dialog, [selector])
  });
  return document.body.appendChild(dialog);
}

const themeOf = (page: TabSwitcherPage) => page.panel()?.getAttribute('data-theme');
const scaleOf = (page: TabSwitcherPage) => Number(page.panel()?.style.getPropertyValue('--x-tab-switcher-visible-scale'));

describe('Tab switcher placement', () => {
  it('joins the top layer as a manual popover on the root element', async () => {
    const page = await bootTabSwitcherPage();
    const promoted: Element[] = [];
    stubTopLayer(function () {
      promoted.push(this);
    });
    openDefault(page);
    const host = required(page.host(), 'the switcher host');
    expect(host.getAttribute('popover')).toBe('manual');
    expect(promoted).toEqual([host]);
    expect(host.parentNode).toBe(document.documentElement);
  });

  it('mounts inside an open modal dialog, so the modal does not make it inert', async () => {
    const page = await bootTabSwitcherPage();
    stubTopLayer(() => {});
    const modal = openModalDialog();
    const nonModal = document.body.appendChild(document.createElement('dialog'));
    nonModal.setAttribute('open', '');
    openDefault(page);
    expect(page.host()?.parentNode).toBe(modal);
  });

  it('mounts inside the fullscreen element', async () => {
    const page = await bootTabSwitcherPage();
    stubTopLayer(() => {});
    const video = document.body.appendChild(document.createElement('div'));
    Object.defineProperty(document, 'fullscreenElement', { configurable: true, value: video });
    openDefault(page);
    expect(page.host()?.parentNode).toBe(video);
  });

  it('stays a fixed layer when promotion is refused or popovers are missing', async () => {
    const page = await bootTabSwitcherPage();
    openDefault(page);
    expect(page.host()?.hasAttribute('popover')).toBe(false);
    page.press('Escape');

    stubTopLayer(() => {
      throw new Error('not allowed');
    });
    openDefault(page);
    expect(page.host()).not.toBeNull();
    expect(page.host()?.hasAttribute('popover')).toBe(false);
  });

  it('undoes page and pinch zoom down to a readable minimum, without CSS zoom', async () => {
    const page = await bootTabSwitcherPage();
    openDefault(page, { tabZoomFactor: 2 });
    expect(scaleOf(page)).toBe(0.5);
    expect(page.panel()?.style.getPropertyValue('zoom')).toBe('');
    page.visualViewport.scale = 0.8;
    act(() => {
      page.visualViewport.dispatchEvent(new Event('resize'));
    });
    expect(scaleOf(page)).toBe(0.625);
    page.visualViewport.scale = 4;
    act(() => {
      page.visualViewport.dispatchEvent(new Event('resize'));
    });
    expect(scaleOf(page)).toBe(0.35);
  });

  it.each([
    [{ width: 1440, height: 900 }, 1.08],
    [{ width: 1200, height: 720 }, 1.045]
  ])('grows slightly in a roomy %o window', async (viewport, scale) => {
    const page = await bootTabSwitcherPage({ viewport });
    openDefault(page);
    expect(scaleOf(page)).toBe(scale);
  });

  it('keeps its base scale in a compact window, centred on the visible part of the page', async () => {
    const page = await bootTabSwitcherPage({ viewport: { width: 800, height: 600, offsetLeft: 100, offsetTop: 40 } });
    openDefault(page);
    expect(scaleOf(page)).toBe(1);
    expect(page.panel()?.style.getPropertyValue('--x-tab-switcher-center-left')).toBe('500px');
    expect(page.panel()?.style.getPropertyValue('--x-tab-switcher-center-top')).toBe('340px');
  });
});

describe('Tab switcher theme', () => {
  it('applies the stored theme, follows its changes in sync storage, and reads it again on reopening', async () => {
    const page = await bootTabSwitcherPage({ sync: { [THEME_KEY]: 'dark' } });
    openDefault(page);
    await settle();
    expect(themeOf(page)).toBe('dark');
    expect(page.panel()?.style.getPropertyValue('color-scheme')).toBe('dark');
    page.changeStorage(THEME_KEY, 'light');
    expect(themeOf(page)).toBe('light');
    page.changeStorage(THEME_KEY, 'dark', 'local');
    expect(themeOf(page)).toBe('light');

    page.press('Escape');
    page.changeStorage(THEME_KEY, 'dark');
    openDefault(page);
    await settle();
    expect(themeOf(page)).toBe('dark');
  });

  it.each([
    ['a dark color-scheme', { name: 'color-scheme', content: 'dark' }],
    ['a dark theme-color', { name: 'theme-color', content: '#101418' }]
  ])('takes the page\'s own theme from %s over the stored one', async (_case, meta) => {
    const page = await bootTabSwitcherPage({ sync: { [THEME_KEY]: 'light' }, meta: [meta] });
    openDefault(page);
    await settle();
    expect(themeOf(page)).toBe('dark');
  });

  it('follows the system theme while open and stops when closed', async () => {
    const page = await bootTabSwitcherPage();
    openDefault(page);
    await settle();
    expect(themeOf(page)).toBe('light');
    page.setSystemDark(true);
    expect(themeOf(page)).toBe('dark');
    page.press('Escape');
    expect(page.mediaListeners.size).toBe(0);
  });

  it('restyles when the page switches itself to dark', async () => {
    const page = await bootTabSwitcherPage();
    openDefault(page);
    await settle();
    document.documentElement.setAttribute('data-color-scheme', 'dark');
    await settle(40);
    expect(themeOf(page)).toBe('dark');
  });
});

describe('Tab switcher pointer and cards', () => {
  it('selects a hovered card, stays open on presses inside and closes on presses outside', async () => {
    const page = await bootTabSwitcherPage();
    openDefault(page);
    const third = page.cards()[2];
    act(() => {
      third.dispatchEvent(new PointerEvent('pointerover', { bubbles: true, composed: true }));
    });
    expect(page.selectedIndex()).toBe(2);
    act(() => {
      third.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, composed: true }));
    });
    expect(page.host()).not.toBeNull();
    act(() => {
      document.body.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
    });
    expect(page.host()).toBeNull();
    expect(page.listenerCount('pointerdown')).toBe(0);
  });

  it('gives each card its tab accent and hides a favicon that fails to load', async () => {
    const page = await bootTabSwitcherPage();
    page.open({
      tabs: [
        { id: 1, windowId: 1, title: 'One', url: 'https://one.example.test/', accentRgb: [10, 20, 30], favIconUrl: 'https://one.example.test/icon.png' },
        { id: 2, windowId: 1, title: 'Two', url: 'https://two.example.test/', accentRgb: [400, 0, 0] }
      ]
    });
    const [first, second] = page.cards();
    expect(first.style.getPropertyValue('--x-tab-switcher-card-accent')).toBe('rgb(10, 20, 30)');
    expect(second.style.getPropertyValue('--x-tab-switcher-card-accent')).toBe('');
    const favicon = required(first.querySelector('.x-tab-switcher-title-favicon'), 'the title favicon');
    expect(favicon.getAttribute('src')).toBeTruthy();
    act(() => {
      favicon.dispatchEvent(new Event('error'));
    });
    expect(favicon.getAttribute('data-broken')).toBe('true');
    expect(favicon.hasAttribute('src')).toBe(false);
  });
});

describe('Tab switcher stylesheet', () => {
  async function openStyles() {
    const page = await bootTabSwitcherPage();
    openDefault(page);
    return page.styles();
  }

  const get = (rule: { get(name: string): string | null } | null, name: string) => required(rule, name).get(name);

  it('places the panel by its centre, fades it in and sizes it to its cards', async () => {
    const styles = await openStyles();
    const panel = styles.rule('#panel');
    expect(get(panel, 'transform')).toBe('translate3d(-50%, -50%, 0) scale(var(--x-tab-switcher-visible-scale))');
    expect(get(styles.rule('#panel[data-visible="true"]'), 'transform')).toBe(get(panel, 'transform'));
    expect(get(panel, 'transition')).toBe('opacity 90ms ease');
    expect(get(panel, 'left')).toBe('var(--x-tab-switcher-center-left, 50%)');
    expect(get(panel, 'top')).toBe('var(--x-tab-switcher-center-top, 50%)');
    expect(get(panel, 'width')).toBe('fit-content');
    expect(get(panel, 'border')).toBe('0');
    expect(get(panel, 'color-scheme')).toBe('light');
    expect(get(panel, '--x-tab-switcher-radius-card')).toBe('calc(var(--x-tab-switcher-radius-panel) - var(--x-tab-switcher-padding-panel))');
    expect(get(panel, '--x-tab-switcher-radius-thumb'))
      .toBe('calc(var(--x-tab-switcher-radius-card) - var(--x-tab-switcher-padding-card) - var(--x-tab-switcher-border-card))');
  });

  it('lays the cards out in one row of fixed-width tracks with a reserved border', async () => {
    const styles = await openStyles();
    expect(get(styles.rule('.x-tab-switcher-list'), 'grid-template-columns'))
      .toBe('repeat(var(--x-tab-count, 5), var(--x-tab-switcher-card-width))');
    const card = styles.rule('.x-tab-switcher-card');
    ['width', 'min-width', 'max-width'].forEach((name) => {
      expect(get(card, name)).toBe('var(--x-tab-switcher-card-width)');
    });
    expect(get(card, 'cursor')).toBe('pointer');
    expect(get(card, 'background')).toBe('transparent');
    expect(get(card, 'border')).toBe('var(--x-tab-switcher-border-card) solid transparent');
    expect(get(card, 'border-radius')).toBe('var(--x-tab-switcher-radius-card)');
    const narrow = styles.rule('.x-tab-switcher-list', /max-width/);
    expect(narrow ? narrow.has('grid-template-columns') : false).toBe(false);
  });

  it('draws thumbnails on the card accent with a hairline stroke and fades fresh captures in', async () => {
    const styles = await openStyles();
    const thumb = required(styles.rule('.x-tab-switcher-thumb'), 'the thumbnail rule');
    expect(thumb.has('border')).toBe(false);
    expect(thumb.has('box-shadow')).toBe(false);
    expect(thumb.get('background')).toMatch(/var\(--x-tab-switcher-card-accent/);
    expect(thumb.get('background')).not.toMatch(/gradient/);
    const stroke = styles.rule('.x-tab-switcher-thumb::after');
    expect(get(stroke, 'border')).toBe('0.5px solid var(--x-tab-switcher-thumb-stroke-color)');
    expect(get(stroke, 'inset')).toBe('0');
    expect(get(stroke, 'pointer-events')).toBe('none');
    expect(get(styles.rule('.x-tab-switcher-thumb img[data-kind="thumbnail"]'), 'transition')).toBe('opacity var(--x-tab-switcher-motion-cover)');
    expect(get(styles.rule('.x-tab-switcher-thumb img[data-kind="thumbnail"][data-entering="true"]'), 'opacity')).toBe('0');
    expect(get(styles.rule('.x-tab-switcher-thumb img[data-broken="true"]'), 'display')).toBe('none');
    expect(get(styles.rule('.x-tab-switcher-favicon[data-broken="true"]'), 'visibility')).toBe('hidden');
    const favicon = required(styles.rule('.x-tab-switcher-favicon'), 'the favicon rule');
    expect(favicon.has('background')).toBe(false);
    expect(favicon.has('box-shadow')).toBe(false);
  });

  it('keeps titles on one line with a still favicon', async () => {
    const styles = await openStyles();
    const name = styles.rule('.x-tab-switcher-name');
    expect(get(name, 'white-space')).toBe('nowrap');
    expect(name?.get('letter-spacing') || '').not.toMatch(/^-/);
    expect(styles.rule('.x-tab-switcher-name-row')?.has('transition')).toBe(false);
    expect(styles.selectors().some((selector) => /\[data-active="true"\] \.x-tab-switcher-(name-row|title-favicon)/.test(selector))).toBe(false);
    expect(styles.selectors().some((selector) => /data-thumbnail-status/.test(selector))).toBe(false);
  });

  it('restyles dark mode through its tokens', async () => {
    const styles = await openStyles();
    const dark = required(styles.rule('#panel[data-theme="dark"]'), 'the dark panel rule');
    expect(dark.get('color-scheme')).toBe('dark');
    expect(dark.has('--x-tab-switcher-thumb-stroke-color')).toBe(true);
    expect(get(styles.rule('#panel[data-theme="dark"] .x-tab-switcher-card'), 'background')).toBe('transparent');
    expect(get(styles.rule('#panel[data-theme="dark"] .x-tab-switcher-thumb'), 'background')).toMatch(/var\(--x-tab-switcher-card-accent/);
    expect(styles.rule('#panel[data-theme="dark"] .x-tab-switcher-favicon')).toBeNull();
  });

  it.each(['#panel', '.x-tab-switcher-card', '.x-tab-switcher-thumb', '.x-tab-switcher-thumb::after', '.x-tab-switcher-favicon', '.x-tab-switcher-title-favicon'])(
    'gives %s the overlay corner curve', async (selector) => {
      const styles = await openStyles();
      expect(styles.rule(selector, /corner-shape/)?.get('corner-shape')).toBe('superellipse(1.25)');
    });
});
