import { describe, expect, it } from 'vitest';
import { bootOverlayPage, settle, waitFor, type OverlayPage } from './boot';
import { required } from '../../fakes/dom';

// Opening fast and surviving page loads: what the overlay reads and asks for
// on its first open, how it restores a draft carried over from the previous
// Document, and how it keeps the open-tab list.

const OPEN_TABS_VISIBLE_KEY = '_x_extension_overlay_open_tabs_default_visible_2026_unique_';
const FIRST_OPEN_KEYS = [
  '_x_extension_language_2024_unique_',
  '_x_extension_theme_mode_2024_unique_',
  '_x_extension_overlay_size_mode_2026_unique_',
  '_x_extension_overlay_enter_animation_2026_unique_',
  '_x_extension_motion_effects_enabled_2026_unique_',
  OPEN_TABS_VISIBLE_KEY
];
const TABS = [
  { id: 1, title: 'Alpha docs', url: 'https://alpha.example.test/', favIconUrl: '' },
  { id: 2, title: 'Beta mail', url: 'https://beta.example.test/', favIconUrl: '' },
  { id: 3, title: 'Gamma notes', url: 'https://gamma.example.test/', favIconUrl: '' }
];

const tabRequests = (page: OverlayPage) => page.messages.filter((message) => message.action === 'getTabsForOverlay');
const shows = (page: OverlayPage, text: string) => (page.root()?.textContent || '').includes(text);

describe('Overlay opening', () => {
  it('reads its preferences in one read, asks for the tabs once, and tells the worker when it closes', async () => {
    const page = await bootOverlayPage({
      settings: { [OPEN_TABS_VISIBLE_KEY]: true },
      respond: (message) => (message.action === 'getTabsForOverlay' ? { tabs: TABS } : undefined)
    });
    const readsBefore = page.storageReads.length;
    await page.open();
    await settle(80);
    const firstRead = required(page.storageReads.slice(readsBefore).find((read) => read.keys.includes(FIRST_OPEN_KEYS[0])), 'the preference read');
    expect(firstRead.keys).toEqual(expect.arrayContaining(FIRST_OPEN_KEYS));
    await waitFor(() => shows(page, 'Alpha docs'), 'the open tabs did not render');
    expect(tabRequests(page)).toHaveLength(1);
    expect(page.overlayOpen()).toBe(true);

    page.toggle({ ensureOpen: true });
    await settle();
    expect(page.host()).not.toBeNull();
    expect(page.overlayOpen()).toBe(true);

    page.press('Escape');
    await settle(30);
    expect(page.host()).toBeNull();
    expect(page.overlayOpen()).toBe(false);
    // So a page load does not bring a deliberately closed overlay back.
    expect(page.messages.map((message) => message.action)).toContain('notifyOverlayClosed');
  });

  it('has its input ready while the tab list is still on its way', async () => {
    const page = await bootOverlayPage({
      settings: { [OPEN_TABS_VISIBLE_KEY]: true },
      respond: (message) => (message.action === 'getTabsForOverlay' ? new Promise(() => {}) : undefined)
    });
    await page.open();
    expect(page.root()?.activeElement).toBe(page.input());
  });

  it('shows no tab snapshot from the caller before the fresh list arrives', async () => {
    let answerTabs = () => {};
    const page = await bootOverlayPage({
      settings: { [OPEN_TABS_VISIBLE_KEY]: true },
      respond: (message) => (message.action === 'getTabsForOverlay'
        ? new Promise((resolve) => {
          answerTabs = () => resolve({ tabs: TABS });
        })
        : undefined)
    });
    page.run({
      type: 'toggle',
      tabs: [{ id: 9, title: 'Stale snapshot tab', url: 'https://stale.example.test/' }],
      context: { currentTabId: 1, currentTabUrl: location.href }
    });
    await waitFor(() => page.root()?.activeElement === page.input(), 'the overlay did not open');
    await settle(40);
    expect(shows(page, 'Stale snapshot tab')).toBe(false);

    answerTabs();
    await waitFor(() => shows(page, 'Alpha docs'), 'the fresh tab list did not render');
  });

  it('restores a draft typed before the page load, and saves its changes with the worker', async () => {
    const page = await bootOverlayPage();
    await page.open({
      loadingSessionTracked: true,
      loadingSession: { inputValue: 'draft text', selectionStart: 2, selectionEnd: 5, selectionDirection: 'backward', focused: true, revision: 3 }
    });
    const input = required(page.input(), 'the overlay input');
    expect(input.value).toBe('draft text');
    expect([input.selectionStart, input.selectionEnd, input.selectionDirection]).toEqual([2, 5, 'backward']);

    const before = page.messages.length;
    input.value = 'draft text more';
    input.setSelectionRange(15, 15);
    input.dispatchEvent(new Event('input', { bubbles: true }));
    await settle(80);
    const update = required(page.messages.slice(before).find((message) => message.action === 'updateOverlayLoadingSession'), 'the draft update');
    expect(update.session).toMatchObject({ inputValue: 'draft text more', selectionStart: 15, selectionEnd: 15, focused: true });
  });

  it('reports no draft from an overlay on a loaded page', async () => {
    const page = await bootOverlayPage();
    await page.open();
    await page.type('hello');
    expect(page.messages.map((message) => message.action)).not.toContain('updateOverlayLoadingSession');
  });

  it('filters the tabs it has in open-tab mode instead of asking again', async () => {
    const answers: Array<(value: unknown) => void> = [];
    const page = await bootOverlayPage({
      respond: (message) => (message.action === 'getTabsForOverlay' ? new Promise((resolve) => answers.push(resolve)) : undefined)
    });
    await page.open();
    await page.type('/tabs');
    page.press('Enter');
    await settle(30);
    expect(tabRequests(page)).toHaveLength(1);
    required(answers.shift(), 'the tab request')({ tabs: TABS });
    await waitFor(() => shows(page, 'Gamma notes'), 'the open tabs did not render');

    await page.type('al');
    await page.type('alp');
    await page.type('alph');
    expect(tabRequests(page)).toHaveLength(1);
    await waitFor(() => shows(page, 'Alpha docs') && !shows(page, 'Gamma notes'), 'the list did not narrow to the matching tab');
  });
});
