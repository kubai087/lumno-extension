import { act } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import * as CustomQuotes from '../../../domain/custom-quotes';
import type { QuoteLibrary } from '../../../domain/custom-quotes';
import * as Settings from '../../../domain/settings';
import { cleanUpOptionsViews, renderOptionsView } from '../../../../tests/fakes/options-page';
import { DailyQuoteSection } from './daily-quote-section';
import { getElement, getTag } from '../../../../tests/fakes/dom';
import { customQuotePick } from '../../../domain/settings/newtab-quote';

// How the next import reads its file.
let readFile: () => Promise<QuoteLibrary> = () => Promise.reject(new Error('unset'));
vi.mock('../../../domain/custom-quotes', async (importOriginal) => ({
  ...await importOriginal<typeof import('../../../domain/custom-quotes')>(),
  readLibraryFile: () => readFile()
}));

const PREFS_KEY = Settings.newtabQuotePrefs.key;
const LIBRARY: QuoteLibrary = {
  version: 1,
  filename: 'quotes.txt',
  revision: 1,
  quotes: [{ text: 'First', author: '' }, { text: 'Second', author: '' }]
};

async function setUp({ local = {}, readLibraryFile = () => Promise.resolve(LIBRARY) }: {
  local?: Record<string, unknown>;
  readLibraryFile?: () => Promise<QuoteLibrary>;
} = {}) {
  readFile = readLibraryFile;
  const view = renderOptionsView(<DailyQuoteSection />, { local });
  await view.settings.settle();
  const store = (raw: unknown) => view.settings.change(Settings.newtabQuotePrefs, raw);
  return { ...view, store };
}

const expanded = (host: HTMLElement, id: string) => getElement(host, `#_x_extension_newtab_quote_${id}_2026_unique_`).dataset.expanded;
const prefs = (patch: Partial<Settings.NewtabQuotePrefs>) => ({ ...Settings.newtabQuotePrefs.parse(null), ...patch });

afterEach(cleanUpOptionsViews);

describe('Options Appearance daily quote section', () => {
  it('follows the synced preferences and this device\'s collection', async () => {
    const { host, settings } = await setUp();
    expect(getElement(host, '#_x_extension_newtab_quote_count_2026_unique_').hidden).toBe(true);
    await settings.change(Settings.customQuotes, LIBRARY);
    const count = getElement(host, '#_x_extension_newtab_quote_count_2026_unique_');
    expect([count.hidden, count.dataset.tooltip, count.textContent]).toEqual([false, 'quotes.txt', '2 quotes']);
  });

  it('opens its options with the switch and saves the record', async () => {
    const { host, writes, settings } = await setUp();
    expect(expanded(host, 'subrows')).toBe('false');
    act(() => getTag(host, '#_x_extension_newtab_quote_toggle_2026_unique_', 'input').click());
    await settings.settle();
    expect(writes).toEqual([{ [PREFS_KEY]: prefs({ enabled: true }) }]);
    expect(expanded(host, 'subrows')).toBe('true');
  });

  it('shows the collection for the custom source and the category for Hitokoto', async () => {
    const { host, writes, store, settings } = await setUp();
    await store(prefs({ enabled: true }));
    expect([expanded(host, 'library_subrows'), expanded(host, 'category_subrows')]).toEqual(['false', 'true']);
    act(() => getElement(host, '[data-quote-provider="custom"]').click());
    await settings.settle();
    expect(writes.at(-1)).toEqual({ [PREFS_KEY]: prefs({ enabled: true, provider: 'custom' }) });
    expect([expanded(host, 'library_subrows'), expanded(host, 'category_subrows')]).toEqual(['true', 'false']);
    act(() => getElement(host, '[data-quote-provider="hitokoto"]').click());
    act(() => getElement(host, '[data-quote-category="poetry"]').click());
    await settings.settle();
    expect(writes.at(-1)).toEqual({ [PREFS_KEY]: prefs({ enabled: true, category: 'poetry' }) });
  });

  it('saves the font size from its slider', async () => {
    const { host, writes, settings } = await setUp();
    const slider = getTag(host, '#_x_extension_newtab_quote_font_size_slider_2026_unique_', 'input');
    act(() => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set?.call(slider, '20');
      slider.dispatchEvent(new Event('input', { bubbles: true }));
    });
    await settings.settle();
    expect(writes).toEqual([{ [PREFS_KEY]: prefs({ fontSize: 20 }) }]);
  });

  it('imports a file into this device\'s collection and switches to it', async () => {
    const { host, writes, localWrites, settings } = await setUp();
    const input = getTag(host, '#_x_extension_newtab_quote_file_2026_unique_', 'input');
    const file = new File(['First\nSecond'], 'quotes.txt', { type: 'text/plain' });
    Object.defineProperty(input, 'files', { configurable: true, value: [file] });
    await act(async () => {
      input.dispatchEvent(new Event('change', { bubbles: true }));
    });
    await settings.settle();
    expect(localWrites).toEqual([{ [CustomQuotes.KEY]: LIBRARY, [customQuotePick.key]: null }]);
    await settings.settle();
    expect(writes).toEqual([{ [PREFS_KEY]: prefs({ provider: 'custom' }) }]);
    expect(getTag(host, '#_x_extension_newtab_quote_import_2026_unique_', 'button').textContent).toBe('Replace file');
    expect(getTag(host, '#_x_extension_newtab_quote_shuffle_2026_unique_', 'button').hidden).toBe(false);
  });

  it('keeps the previous collection and says why an import failed', async () => {
    const { host, localWrites, settings } = await setUp({ readLibraryFile: () => Promise.reject(new Error('type')) });
    const input = getTag(host, '#_x_extension_newtab_quote_file_2026_unique_', 'input');
    Object.defineProperty(input, 'files', { configurable: true, value: [new File(['x'], 'quotes.pdf')] });
    await act(async () => {
      input.dispatchEvent(new Event('change', { bubbles: true }));
    });
    await settings.settle();
    expect(localWrites).toEqual([]);
    const status = getElement(host, '#_x_extension_newtab_quote_import_status_2026_unique_');
    expect([status.hidden, status.getAttribute('role')]).toEqual([false, 'alert']);
    expect(status.textContent).toContain('Import failed');
  });

  it('moves today\'s quote on and shows it', async () => {
    const { host, localWrites, showToast } = await setUp({ local: { [CustomQuotes.KEY]: LIBRARY } });
    await act(async () => {
      getTag(host, '#_x_extension_newtab_quote_shuffle_2026_unique_', 'button').click();
    });
    expect(Object.keys(localWrites[0] || {})).toEqual([customQuotePick.key]);
    expect(showToast).toHaveBeenCalledTimes(1);
    expect(['First', 'Second']).toContain(showToast.mock.calls[0]?.[0]);
  });
});
