import { afterEach, describe, expect, it, vi } from 'vitest';
import enLocale from '../../../_locales/en/messages.json';
import jaLocale from '../../../_locales/ja/messages.json';
import zhCnLocale from '../../../_locales/zh_CN/messages.json';
import zhTwLocale from '../../../_locales/zh_TW/messages.json';
import { KEY as CUSTOM_KEY, type QuoteFile } from '../../domain/custom-quotes';
import { customQuotePick, newtabQuotePrefs, quoteCache } from '../../domain/settings/newtab-quote';
import type { SurfaceLocale } from '../../shared/i18n/surface-locale';
import { createStore, type Store } from '../../shared/state/store';
import type { DailyQuote } from '../remote-content-types';
import type { QuoteLineHandlers, QuoteLineState } from '../react/quote-line';
import { createMemorySettings, type MemorySettings } from '../../../tests/fakes/memory-settings';
import { getElement, required } from '../../../tests/fakes/dom';
import { createRuntime } from './quotes';

// The daily quote on New Tab: its line, its section in the appearance panel,
// the language it shows for and the user's own collection. The line view
// records what the runtime hands it; its markup is covered by
// src/newtab/react/quote-line.test.tsx.
interface LineRecord {
  handlers: QuoteLineHandlers | null;
  store: Store<QuoteLineState> | null;
  destroyed: boolean;
}

const lines = vi.hoisted(() => {
  const made: LineRecord[] = [];
  return { made };
});

vi.mock(import('../react/quote-line'), async (importOriginal) => ({
  ...await importOriginal(),
  createQuoteLineView(_host: HTMLElement, handlers: QuoteLineHandlers, store: Store<QuoteLineState>) {
    const record: LineRecord = { handlers, store, destroyed: false };
    lines.made.push(record);
    return { getTextElement: () => null, destroy() { record.destroyed = true; } };
  }
}));

type LocaleState = ReturnType<SurfaceLocale['store']['getSnapshot']>;
type Messages = Record<string, { message: string } | undefined>;
type Runtime = ReturnType<typeof createRuntime>;

const tick = () => new Promise((resolve) => setTimeout(resolve, 0));
const drag = { dragging: true, final: false };
const settled = { dragging: false, final: true };

function setUpPage(): void {
  document.body.replaceChildren(...['search', 'shortcuts', 'recent'].map((id) => Object.assign(document.createElement('div'), { id })));
}

function createLocale(locale: string) {
  const store = createStore<LocaleState>({ mode: 'system', locale, messages: null });
  return { locale: { store }, setLocale: (next: string) => store.setState({ mode: 'system', locale: next, messages: null }) };
}

// The line the runtime made last.
function line() {
  const record = required(lines.made[lines.made.length - 1], 'a quote line view');
  return {
    record,
    model: () => required(required(record.store, 'the line store').getSnapshot().model, 'the line model'),
    handlers: () => required(record.handlers, 'the line handlers')
  };
}

function panel(runtime: Runtime) {
  const model = () => required(runtime.settingsState.getSnapshot().model, 'the quote section model');
  return { section: () => model().quote, actions: () => model().actions };
}

function makeRuntime(settings: MemorySettings, locale: string, client: { getQuote(category: string, options?: { reroll?: boolean }): Promise<DailyQuote> },
  extra: Partial<Parameters<typeof createRuntime>[0]> = {}) {
  return createRuntime({
    t: (_key, fallback) => fallback,
    locale: createLocale(locale).locale,
    getSearchRoot: () => getElement(document, '#search'),
    getShortcutSection: () => document.getElementById('shortcuts'),
    settings: settings.store,
    client,
    ...extra
  });
}

afterEach(() => {
  lines.made.splice(0);
  document.body.replaceChildren();
  Object.keys(document.body.dataset).forEach((key) => delete document.body.dataset[key]);
});

describe('New Tab daily quote', () => {
  it('fetches nothing while off, then shows the quote as text with a safe link and its origin in the tooltip', async () => {
    setUpPage();
    const memory = createMemorySettings({ sync: { [newtabQuotePrefs.key]: { position: 'off', category: 'literature' } } });
    let resolveQuote: (quote: DailyQuote) => void = () => {};
    const getQuote = vi.fn(() => new Promise<DailyQuote>((resolve) => { resolveQuote = resolve; }));
    const tooltip = { show: vi.fn(), hide: vi.fn() };
    const runtime = makeRuntime(memory, 'zh_CN', { getQuote }, { getTooltipController: () => tooltip });
    const { section, actions } = panel(runtime);
    runtime.bindSettings();
    await runtime.mount();

    expect(getQuote).not.toHaveBeenCalled();
    expect([section().enabled, section().enabled && section().expanded]).toEqual([false, false]);
    expect(section().fontSize.value).toBe(15);
    actions().setEnabled(true);
    expect(newtabQuotePrefs.parse(memory.store.getStored(newtabQuotePrefs)).enabled).toBe(true);
    await tick();
    resolveQuote({ text: '<img src=x onerror=alert(1)>', source: 'book', author: 'author', url: 'javascript:alert(1)' });
    await tick();

    expect(runtime.element.previousElementSibling?.id).toBe('shortcuts');
    expect(runtime.element.nextElementSibling?.id).toBe('recent');
    expect(runtime.element.hidden).toBe(false);
    expect(line().model().text).toBe('<img src=x onerror=alert(1)>');
    expect(line().model().href).toBe('https://hitokoto.cn/');
    expect(line().model().ariaLabel).toContain('author');
    expect(tooltip.show).not.toHaveBeenCalled();
    line().handlers().onShowOrigin(runtime.element);
    expect(tooltip.show.mock.calls.map((call) => [call[1], call[2].placement])).toEqual([['author · 《book》', 'bottom']]);
    line().handlers().onHideTooltip();
    expect(tooltip.hide).toHaveBeenCalledTimes(1);
    expect(section().enabled && section().expanded).toBe(true);
    runtime.destroy();
  });

  it('previews a font size while dragging, saves it within range, and changes the face without fetching again', async () => {
    setUpPage();
    const memory = createMemorySettings({ sync: { [newtabQuotePrefs.key]: { enabled: true, position: 'search', category: 'literature' } } });
    const getQuote = vi.fn(async () => ({ text: '今日', author: '', source: '', url: '' }));
    const runtime = makeRuntime(memory, 'zh_CN', { getQuote });
    const { section, actions } = panel(runtime);
    const saved = () => newtabQuotePrefs.parse(memory.store.getStored(newtabQuotePrefs));
    runtime.bindSettings();
    await runtime.mount();
    await tick();

    actions().setFontSize(20, drag);
    expect(runtime.element.style.getPropertyValue('--x-nt-quote-font-size')).toBe('20px');
    expect([section().fontSize.value, saved().fontSize]).toEqual([20, 15]);
    actions().setFontSize(20, settled);
    expect(saved().fontSize).toBe(20);
    actions().setFontSize(30, settled);
    expect([saved().fontSize, section().fontSize.value]).toEqual([24, 24]);

    const fontSelect = () => section().fontSelect;
    expect(fontSelect().options.map((option) => option.value)).toEqual(['wenkai', 'xiaowei', 'sans']);
    expect(fontSelect().value).toBe('wenkai');
    expect(runtime.element.style.getPropertyValue('--x-nt-quote-font-family')).toMatch(/^"LXGW WenKai"/);
    fontSelect().onChange('xiaowei');
    expect([saved().font, fontSelect().value]).toEqual(['xiaowei', 'xiaowei']);
    expect(runtime.element.style.getPropertyValue('--x-nt-quote-font-family')).toMatch(/^"Lumno Quote XiaoWei"/);
    fontSelect().onChange('sans');
    expect(runtime.element.style.getPropertyValue('--x-nt-quote-font-family')).toMatch(/^"PingFang SC"/);
    expect(getQuote).toHaveBeenCalledTimes(1);
    runtime.destroy();
  });

  it('places the quote in on-page order and keeps the day’s quote while it moves', async () => {
    setUpPage();
    const memory = createMemorySettings({ sync: { [newtabQuotePrefs.key]: { enabled: true, position: 'search' } } });
    const getQuote = vi.fn(async () => ({ text: '今日', author: '', source: '', url: '' }));
    const runtime = makeRuntime(memory, 'zh_CN', { getQuote });
    const { section } = panel(runtime);
    const choose = (value: string) => {
      expect(section().positionSelect.options.map((option) => option.value)).toContain(value);
      section().positionSelect.onChange(value);
    };
    runtime.bindSettings();
    await runtime.mount();
    await tick();

    expect(section().positionSelect.options.map((option) => option.value)).toEqual(['top', 'input', 'search', 'bottom']);
    expect(section().positionSelect.value).toBe('search');
    choose('top');
    expect([runtime.element.nextElementSibling?.id, document.body.dataset.quotePosition, section().positionSelect.value]).toEqual(['search', 'top', 'top']);
    choose('input');
    expect([runtime.element.previousElementSibling?.id, runtime.element.nextElementSibling?.id, document.body.dataset.quotePosition]).toEqual(['search', 'shortcuts', 'input']);
    choose('bottom');
    expect([document.body.dataset.quotePosition, runtime.element.dataset.position]).toEqual(['bottom', 'bottom']);
    expect(getQuote).toHaveBeenCalledTimes(1);
    runtime.destroy();
  });

  it('reads the stored placement, off unless the user turned it on', () => {
    expect(newtabQuotePrefs.parse({ position: 'top' }).position).toBe('top');
    expect(newtabQuotePrefs.parse({ position: 'input' }).position).toBe('input');
    expect(newtabQuotePrefs.parse({ position: 'nope' }).position).toBe('search');
    [null, undefined, {}, { position: 'search' }, { position: 'bottom', category: 'poetry' }, { enabled: 'true' }].forEach((saved) => {
      expect(newtabQuotePrefs.parse(saved).enabled).toBe(false);
    });
  });

  it.each<[string, Messages]>([['en', enLocale], ['ja', jaLocale], ['zh_CN', zhCnLocale], ['zh_TW', zhTwLocale]])(
    'names the quote section in %s without fetching another quote', async (_name, messages) => {
      setUpPage();
      const memory = createMemorySettings({ sync: { [newtabQuotePrefs.key]: { enabled: true, position: 'bottom' } } });
      const getQuote = vi.fn(async () => ({ text: '今日', author: '', source: '', url: '' }));
      let current: Messages = {};
      const runtime = makeRuntime(memory, 'zh_CN', { getQuote }, { t: (key, fallback) => current[key]?.message || fallback });
      const { section } = panel(runtime);
      runtime.bindSettings();
      await runtime.mount();
      await tick();
      const text = line().model().text;
      const message = (key: string) => required(messages[key], key).message;

      current = messages;
      runtime.updateLanguage();
      expect([section().title, section().infoTooltip, section().positionSelect.ariaLabel, section().category.label, section().fontSize.label, section().fontSize.ariaLabel])
        .toEqual(['newtab_quote_title', 'newtab_quote_provider', 'newtab_quote_position', 'newtab_quote_category', 'newtab_quote_font_size', 'newtab_quote_font_size_label'].map(message));
      section().positionSelect.options.forEach((option) => expect(option.label).toBe(message(`newtab_quote_${option.value}`)));
      section().category.options.forEach((option) => expect(option.label).toBe(message(`newtab_quote_${option.value}`)));
      expect([line().model().text, section().positionSelect.value]).toEqual([text, 'bottom']);
      expect(getQuote).toHaveBeenCalledTimes(1);
      runtime.destroy();
    });

  it('keeps a late answer from showing a quote turned off, and keeps its settings through the switch', async () => {
    setUpPage();
    const memory = createMemorySettings({ sync: { [newtabQuotePrefs.key]: { enabled: true, position: 'bottom', fontSize: 24, font: 'sans' } } });
    let resolveQuote: (quote: DailyQuote) => void = () => {};
    const getQuote = vi.fn(() => new Promise<DailyQuote>((resolve) => { resolveQuote = resolve; }));
    const runtime = makeRuntime(memory, 'zh_CN', { getQuote });
    const { section, actions } = panel(runtime);
    runtime.bindSettings();
    await runtime.mount();
    resolveQuote({ text: '今日', author: '', source: '', url: 'https://hitokoto.cn/' });
    await tick();

    actions().setCategory('poetry');
    await tick();
    actions().setEnabled(false);
    resolveQuote({ text: 'late poem', author: '', source: '', url: 'https://hitokoto.cn/' });
    await tick();
    expect(runtime.element.hidden).toBe(true);
    expect([section().enabled, section().enabled && section().expanded, document.body.dataset.quotePosition]).toEqual([false, false, 'off']);
    expect(memory.store.getStored(newtabQuotePrefs)).toEqual({ enabled: false, position: 'bottom', category: 'poetry', fontSize: 24, provider: 'hitokoto', font: 'sans' });

    actions().setEnabled(true);
    await tick();
    resolveQuote({ text: 'restored poem', author: '', source: '', url: 'https://hitokoto.cn/' });
    await tick();
    expect(runtime.element.hidden).toBe(false);
    expect(runtime.element.dataset.position).toBe('bottom');
    expect(runtime.element.style.getPropertyValue('--x-nt-quote-font-size')).toBe('24px');
    expect(section().category.active).toBe('poetry');
    const shown = line();
    runtime.destroy();
    expect(shown.record.destroyed).toBe(true);
  });

  it('shows only for Chinese UI languages, keeping its settings and the panel for every language', async () => {
    setUpPage();
    const memory = createMemorySettings({ sync: { [newtabQuotePrefs.key]: { enabled: true, position: 'bottom' } } });
    const getQuote = vi.fn(async () => ({ text: '海上生明月', author: '', source: '', url: '' }));
    const { locale, setLocale } = createLocale('en');
    const runtime = makeRuntime(memory, 'en', { getQuote }, { locale });
    runtime.bindSettings();
    await runtime.mount();
    await tick();

    expect(getQuote).not.toHaveBeenCalled();
    expect([runtime.element.hidden, document.body.dataset.quotePosition]).toEqual([true, 'off']);
    expect(runtime.settingsState.getSnapshot().model).not.toBeNull();
    setLocale('zh_TW');
    await tick();
    await tick();
    expect(getQuote).toHaveBeenCalledTimes(1);
    expect([runtime.element.hidden, document.body.dataset.quotePosition]).toEqual([false, 'bottom']);
    setLocale('ja');
    expect([runtime.element.hidden, document.body.dataset.quotePosition]).toEqual([true, 'off']);
    setLocale('zh_CN');
    await tick();
    expect(runtime.element.hidden).toBe(false);
    runtime.destroy();
  });

  it('paints the cached quote before mounting settles, never waiting for the network, and redraws in place', async () => {
    setUpPage();
    const memory = createMemorySettings({
      sync: { [newtabQuotePrefs.key]: { enabled: true, position: 'top' } },
      local: { [quoteCache.key]: { literature: { quote: { text: '缓存', author: '', source: '', url: '' } } } }
    });
    const runtime = makeRuntime(memory, 'zh_CN', { getQuote: () => new Promise(() => {}) });
    await runtime.mount();

    expect(runtime.element.hidden).toBe(false);
    expect(runtime.element.nextElementSibling?.id).toBe('search');
    const observer = new MutationObserver(() => {});
    observer.observe(required(runtime.element.parentNode, 'the quote parent'), { childList: true });
    memory.receive('sync', newtabQuotePrefs.key, { enabled: true, position: 'top', fontSize: 18 });
    expect(runtime.element.style.getPropertyValue('--x-nt-quote-font-size')).toBe('18px');
    expect(observer.takeRecords()).toHaveLength(0);
    observer.disconnect();
    runtime.destroy();
  });

  it('shuffles to another quote of the category once at a time, and keeps the quote when that fails', async () => {
    setUpPage();
    const memory = createMemorySettings({ sync: { [newtabQuotePrefs.key]: { enabled: true, position: 'input', category: 'poetry' } } });
    let reroll: Promise<DailyQuote> = Promise.resolve({ text: '换一句', author: '', source: '', url: '' });
    const getQuote = vi.fn((_category: string, options?: { reroll?: boolean }) => (options && options.reroll
      ? reroll
      : Promise.resolve({ text: '今日', author: '', source: '', url: '' })));
    const toasts: unknown[][] = [];
    const runtime = makeRuntime(memory, 'zh_CN', { getQuote }, { showToast: (message, isError) => { toasts.push([message, isError]); } });
    await runtime.mount();
    await tick();
    const shown = line();

    expect([shown.model().shuffleLabel, shown.model().swapCount]).toEqual(['Show another quote', 0]);
    shown.handlers().onShuffle();
    expect(shown.model().shuffling).toBe(true);
    shown.handlers().onShuffle();
    await tick();
    expect(getQuote.mock.calls.map((call) => [call[0], Boolean(call[1] && call[1].reroll)])).toEqual([['poetry', false], ['poetry', true]]);
    expect([shown.model().text, shown.model().swapCount, shown.model().shuffling]).toEqual(['换一句', 1, false]);

    reroll = Promise.reject(new Error('offline'));
    shown.handlers().onShuffle();
    await tick();
    await tick();
    expect([shown.model().text, shown.model().swapCount]).toEqual(['换一句', 1]);
    expect(toasts).toEqual([['Could not load another quote', true]]);
    runtime.destroy();
  });
});

describe('New Tab custom quote collection', () => {
  const english: Messages = enLocale;
  const file: QuoteFile = { name: 'my.md', size: 200, text: async () => 'First local quote.\nSecond local quote.' };

  function collection(memory: MemorySettings): { filename?: unknown; quotes?: Array<{ text: string }> } {
    const stored = memory.data.local[CUSTOM_KEY];
    return typeof stored === 'object' && stored !== null ? { ...stored } : {};
  }

  it('imports a collection on this device and shows it in every language, without remote requests', async () => {
    setUpPage();
    const memory = createMemorySettings({ sync: { [newtabQuotePrefs.key]: { enabled: true, position: 'search', provider: 'custom' } } });
    const getQuote = vi.fn(async () => ({ text: 'Remote', author: '', source: '', url: 'https://hitokoto.cn/' }));
    const runtime = makeRuntime(memory, 'en', { getQuote }, { t: (key, fallback) => (english[key]?.message || fallback) });
    await runtime.mount();
    await tick();
    runtime.bindSettings();
    const status = () => panel(runtime).section().library.status;

    expect(getQuote).not.toHaveBeenCalled();
    expect(runtime.element.hidden).toBe(true);
    await expect(runtime.importQuoteFile(file)).resolves.toBe(true);
    await tick();
    expect(collection(memory).quotes).toHaveLength(2);
    expect(runtime.element.hidden).toBe(false);
    expect(line().model().text).toContain('local quote');
    expect(line().model().href).toBeNull();

    await expect(runtime.importQuoteFile({ ...file, name: 'LINES.TXT', text: async () => '﻿第一句\r\n第二句\r\n\r\n第三句' })).resolves.toBe(true);
    expect((collection(memory).quotes || []).map((quote) => quote.text)).toEqual(['第一句', '第二句', '第三句']);
    expect(collection(memory).filename).toBe('LINES.TXT');
    const before = JSON.stringify(memory.data.local[CUSTOM_KEY]);
    await expect(runtime.importMarkdown({ ...file, text: async () => '# Empty' })).resolves.toBe(false);
    expect(JSON.stringify(memory.data.local[CUSTOM_KEY])).toBe(before);
    await expect(runtime.importQuoteFile({ ...file, name: 'wrong.pdf' })).resolves.toBe(false);
    expect(status()?.text).toMatch(/format or size limits/);

    memory.state.failWrites = true;
    await expect(runtime.importMarkdown(file)).resolves.toBe(false);
    memory.state.failWrites = false;
    expect(JSON.stringify(memory.data.local[CUSTOM_KEY])).toBe(before);
    expect(status()?.text).toMatch(/save on this device.*previous collection is kept/);
    expect(status()?.text).not.toMatch(/format or size limits/);
    expect(status()?.error).toBe(true);
    expect(getQuote).not.toHaveBeenCalled();
    runtime.destroy();
  });

  it('keeps a shuffled quote through a refresh', async () => {
    setUpPage();
    const memory = createMemorySettings({ sync: { [newtabQuotePrefs.key]: { enabled: true, position: 'search', provider: 'custom' } } });
    const getQuote = vi.fn(async () => ({ text: 'Remote', author: '', source: '', url: 'https://hitokoto.cn/' }));
    const runtime = makeRuntime(memory, 'en', { getQuote });
    await runtime.mount();
    await tick();
    await runtime.importQuoteFile({ ...file, text: async () => 'One.\nTwo.\nThree.\nFour.' });
    await tick();

    line().handlers().onShuffle();
    await tick();
    const afterShuffle = line().model().text;
    expect(memory.data.local[customQuotePick.key]).toBeTruthy();
    runtime.destroy();
    const restored = makeRuntime(memory, 'en', { getQuote });
    await restored.mount();
    await tick();
    expect(line().model().text).toBe(afterShuffle);
    expect(getQuote).not.toHaveBeenCalled();
    restored.destroy();
  });
});
