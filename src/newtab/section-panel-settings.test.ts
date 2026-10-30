import { afterEach, describe, expect, it, vi } from 'vitest';
import type { StorageChanges } from '../domain/storage-port';
import { required } from '../../tests/fakes/dom';
import { createRuntime } from './section-panel-settings';

// The appearance panel's bookmark and site-card sections, as the model the
// panel draws, over page state read through getters and changed through setters.
function setUp() {
  const page = {
    viewMode: 'folder',
    bookmarkCount: 8,
    bookmarkColumns: 6,
    folderIconsVisible: true,
    topbarLayout: 'docked',
    surfaceMode: 'adaptive',
    recentMode: 'most',
    recentCount: 0
  };
  const calls: unknown[][] = [];
  let messages: Record<string, string> = {};
  let storageListener: ((changes: StorageChanges, area?: string) => void) | null = null;
  const runtime = createRuntime({
    chromeObj: {
      storage: {
        onChanged: {
          addListener(listener) { storageListener = listener; },
          removeListener() { storageListener = null; }
        }
      }
    },
    t: (key, fallback) => messages[key] || fallback,
    watchedKeys: ['bookmark_count', 'recent_count'],
    getBookmarkViewMode: () => page.viewMode,
    setBookmarkViewMode: (mode) => { calls.push(['viewMode', mode]); page.viewMode = mode; },
    getBookmarkCount: () => page.bookmarkCount,
    setBookmarkCount: (value, options) => { calls.push(['bookmarkCount', value, options.persist]); page.bookmarkCount = value; },
    getBookmarkColumns: () => page.bookmarkColumns,
    setBookmarkColumns: (value, options) => { calls.push(['bookmarkColumns', value, options.persist]); page.bookmarkColumns = value; },
    getBookmarkFolderIconsVisible: () => page.folderIconsVisible,
    setBookmarkFolderIconsVisible: (value, options) => { calls.push(['folderIcons', value, options.persist]); page.folderIconsVisible = value; },
    getBookmarkTopbarLayout: () => page.topbarLayout,
    setBookmarkTopbarLayout: (layout) => { calls.push(['layout', layout]); page.topbarLayout = layout; },
    getBookmarkTopbarSurfaceMode: () => page.surfaceMode,
    setBookmarkTopbarSurfaceMode: (mode) => { calls.push(['surface', mode]); page.surfaceMode = mode; },
    pickBookmarkTopbarSurfaceColor: () => { calls.push(['pickColor']); },
    getRecentMode: () => page.recentMode,
    setRecentMode: (mode) => { calls.push(['recentMode', mode]); page.recentMode = mode; },
    getRecentCount: () => page.recentCount,
    setRecentCount: (value, options) => { calls.push(['recentCount', value, options.persist]); page.recentCount = value; }
  });
  runtime.bindSettings();
  return {
    page,
    calls,
    runtime,
    model: () => required(runtime.settingsState.getSnapshot().model, 'the section settings model'),
    // A change another page or a section menu made.
    storageChange(changes: StorageChanges, area: string) {
      required(storageListener, 'the storage listener')(changes, area);
      vi.advanceTimersByTime(5);
    },
    setMessages(next: Record<string, string>) { messages = next; },
    listening: () => storageListener !== null
  };
}

const drag = { dragging: true, final: false };
const settled = { dragging: false, final: true };

describe('New Tab section panel settings', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('mirrors the page on first render, collapsed, and expands only a section that is on', () => {
    vi.useFakeTimers();
    const { model } = setUp();
    const { bookmark, recent } = model();

    expect([bookmark.title, bookmark.enabled, bookmark.expanded]).toEqual(['Bookmarks', true, false]);
    expect([bookmark.rows.value, bookmark.rows.label, bookmark.columns.value]).toEqual([2, 'Bookmark rows', 6]);
    expect(bookmark.folderIcons.checked).toBe(true);
    expect(bookmark.topbarMode).toBe(false);
    expect(bookmark.viewModeSelect.value).toBe('folder');
    expect(bookmark.viewModeSelect.options.map((option) => option.value)).toEqual(['folder', 'list', 'top']);
    expect(recent.enabled).toBe(false);
    model().actions.toggleRecentExpanded();
    expect(model().recent.expanded).toBe(false);
    model().actions.toggleBookmarkExpanded();
    expect(model().bookmark.expanded).toBe(true);
  });

  it('previews each step of a drag and saves only the settled value, or the value a pause leaves', () => {
    vi.useFakeTimers();
    const { model, calls, page, storageChange } = setUp();

    model().actions.setBookmarkRows(3, drag);
    expect(calls.pop()).toEqual(['bookmarkCount', 12, false]);
    // A storage change for the old value lands mid-drag; the thumb stays where it is.
    page.bookmarkCount = 8;
    storageChange({ bookmark_count: { newValue: 8 } }, 'sync');
    expect(model().bookmark.rows.value).toBe(3);
    model().actions.setBookmarkRows(3, settled);
    expect(calls.pop()).toEqual(['bookmarkCount', 12, true]);
    expect(page.bookmarkCount).toBe(12);
    model().actions.setBookmarkRows(4, drag);
    expect(calls.pop()).toEqual(['bookmarkCount', 16, false]);
    vi.advanceTimersByTime(200);
    expect(calls.pop()).toEqual(['bookmarkCount', 16, true]);

    model().actions.setBookmarkColumns(8, drag);
    model().actions.setBookmarkColumns(8, settled);
    expect(calls.slice(-2)).toEqual([['bookmarkColumns', 8, false], ['bookmarkColumns', 8, true]]);
    model().actions.setBookmarkFolderIconsVisible(false);
    expect(calls.pop()).toEqual(['folderIcons', false, true]);
  });

  it('hides the bookmarks by saving zero rows and brings back the last row count', () => {
    vi.useFakeTimers();
    const { model, calls } = setUp();
    model().actions.toggleBookmarkExpanded();
    model().actions.setBookmarkRows(4, settled);

    model().actions.setBookmarkVisible(false);
    expect(calls.pop()).toEqual(['bookmarkCount', 0, true]);
    expect(model().bookmark.enabled).toBe(false);
    expect(model().bookmark.rows.value).toBe(4);
    model().actions.setBookmarkVisible(true);
    expect(calls.pop()).toEqual(['bookmarkCount', 16, true]);
    expect(model().bookmark.expanded).toBe(true);
  });

  it('offers the top bar its shape and background, with a custom color only from the picker', () => {
    vi.useFakeTimers();
    const { model, calls } = setUp();

    model().bookmark.viewModeSelect.onChange('top');
    expect(calls.pop()).toEqual(['viewMode', 'top']);
    expect([model().bookmark.topbarMode, model().bookmark.viewModeSelect.value]).toEqual([true, 'top']);
    model().actions.setBookmarkTopbarLayout('floating');
    expect(calls.pop()).toEqual(['layout', 'floating']);
    expect(model().bookmark.topbarLayout.active).toBe('floating');
    const surface = () => model().bookmark.topbarSurfaceSelect;
    expect(surface().options.map((option) => option.value)).toEqual(['adaptive', 'transparent', 'custom']);
    expect(surface().onChange('clear')).toBe(false);
    expect(surface().onChange('transparent')).toBeUndefined();
    expect(calls.pop()).toEqual(['surface', 'transparent']);
    expect(surface().value).toBe('transparent');
    expect(surface().options.find((option) => option.value === 'transparent')?.checked).toBe(true);
    expect(surface().onChange('custom')).toBe(false);
    expect(calls.pop()).toEqual(['pickColor']);
    expect(surface().options.find((option) => option.value === 'custom')?.trailingIconName).toBe('ri-dropper-line');
  });

  it('turns the site cards on with one row and saves their rows and mode at once', () => {
    vi.useFakeTimers();
    const { model, calls } = setUp();

    model().actions.setRecentVisible(true);
    expect(calls.pop()).toEqual(['recentCount', 4, true]);
    expect([model().recent.enabled, model().recent.expanded, model().recent.rows.active]).toEqual([true, true, '1']);
    model().actions.setRecentRows('2');
    expect(calls.pop()).toEqual(['recentCount', 8, true]);
    expect(model().recent.rows.active).toBe('2');
    expect(model().recent.mode.active).toBe('most');
    model().actions.setRecentMode('latest');
    expect(calls.pop()).toEqual(['recentMode', 'latest']);
  });

  it('shows changes made elsewhere, ignoring unrelated keys, in the current language', () => {
    vi.useFakeTimers();
    const { model, page, runtime, storageChange, setMessages, listening } = setUp();
    model().actions.setRecentVisible(true);
    model().actions.setRecentRows('2');

    page.recentCount = 0;
    page.viewMode = 'list';
    storageChange({ unrelated_key: { newValue: 1 } }, 'local');
    expect(model().recent.enabled).toBe(true);
    storageChange({ recent_count: { newValue: 0 } }, 'sync');
    expect(model().recent.enabled).toBe(false);
    expect([model().bookmark.viewModeSelect.value, model().bookmark.topbarMode]).toEqual(['list', false]);
    expect(model().recent.rows.active).toBe('2');

    setMessages({ bookmarks_heading: '书签', settings_recent_sites_title: '站点卡片', newtab_recent_rows_title: '站点卡片行数' });
    runtime.updateLanguage();
    expect([model().bookmark.title, model().recent.title, model().recent.rowsLabel]).toEqual(['书签', '站点卡片', '站点卡片行数']);
    runtime.destroy();
    expect(listening()).toBe(false);
  });
});
