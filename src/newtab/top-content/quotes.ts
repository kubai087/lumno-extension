// The daily quote: its line on the page, its settings in the appearance
// panel, and the custom collection it can read from.
import * as LumnoSettings from '../../domain/settings';
import type { NewtabQuotePosition, NewtabQuotePrefs } from '../../domain/settings';
import type { StorageAreaLike, StorageItems } from '../../domain/storage-port';
import type { SettingsStore } from '../../platform/settings-store';
import type { TooltipController } from '../../shared/ui/tooltip';
import type { ShowToast, Translate } from '../newtab-types';
import type { WallpaperViewController } from '../react/wallpaper-view';
import type { QuoteSettingsActions, QuoteSettingsModel } from '../react/wallpaper-panel/panel-model';
import type { SliderChange } from '../react/wallpaper-panel/panel-primitives';
import type { QuoteLineModel } from '../react/quote-line';
import * as LumnoNewtabRemoteContent from '../remote-content';
import type { RemoteContentClient } from '../remote-content';
import type { DailyQuote } from '../remote-content-types';
import * as LumnoCustomQuotes from '../../domain/custom-quotes';
import type { QuoteFile, QuoteLibrary } from '../../domain/custom-quotes';
import { createQuoteLineView } from '../react/quote-line';
import { quoteCache } from '../../domain/settings/newtab-quote';
import * as NewtabQuoteSettings from '../../domain/settings/newtab-quote';

type QuoteStorageArea = Pick<StorageAreaLike, 'get' | 'set'>;

type QuoteTooltip = Pick<TooltipController, 'show' | 'hide'>;

// The panel view, which draws the quote section.
type QuoteSettingsView = Pick<WallpaperViewController, 'renderQuoteSettings'>;

interface QuoteRuntimeOptions {
  documentObj?: Document;
  windowObj?: Window & typeof globalThis;
  // The quote preferences, this device's collection and the cached quote.
  settings: Pick<SettingsStore, 'getStored' | 'include' | 'set' | 'setMany' | 'subscribe'>;
  // This device's storage, where the remote client caches what it fetched.
  localStorageArea?: QuoteStorageArea | null;
  t: Translate;
  showToast?: ShowToast;
  getLocale?: () => string | null | undefined;
  getSearchRoot(): HTMLElement;
  getShortcutSection?: () => HTMLElement | null | undefined;
  getTooltipController?: () => QuoteTooltip | null | undefined;
  onLayout?: () => void;
  client?: Pick<RemoteContentClient, 'getQuote'>;
}

function createRuntime(options: QuoteRuntimeOptions) {
  const config = options;
  const document = config.documentObj || globalThis.document;
  const window = config.windowObj || globalThis.window;
  const settings = LumnoSettings;
  const custom = LumnoCustomQuotes;
  const t = config.t;
  // Hitokoto only serves Chinese text, so the quote exists for Chinese UI languages only.
  const isLocaleSupported = () => !config.getLocale || /^zh_(CN|TW)$/.test(config.getLocale() || '');
  const client = config.client || LumnoNewtabRemoteContent.createClient({
    storageArea: config.localStorageArea,
    fallbackQuote: () => ({
      text: t('newtab_quote_fallback_text', 'A journey of a thousand miles begins with a single step.'),
      author: t('newtab_quote_fallback_author', 'Laozi'),
      source: t('newtab_quote_fallback_source', 'Tao Te Ching'),
      url: 'https://hitokoto.cn/'
    })
  });
  // The line's host: it moves between slots on the page with the chosen position.
  const element = document.createElement('div');
  element.className = 'x-nt-quote';
  element.hidden = true;
  // Resolved on use: the page creates its tooltip controllers after the quote runtime.
  const getTooltip = () => (config.getTooltipController ? config.getTooltipController() : null);
  let origin = '';
  let prefs = settings.newtabQuotePrefs.parse(null);
  let quote: DailyQuote | null = null;
  let revision = 0;
  let settingsView: QuoteSettingsView | null = null;
  let settingsExpanded = true;
  let mounted = false;
  let dayTimer: number | undefined;
  let unsubscribes: Array<() => void> = [];
  let disposed = false;
  let draftFontSize: number | null = null;
  let shuffling = false;
  let swapCount = 0;
  let library: QuoteLibrary | null = null;
  let importing = false;
  let importError = false;
  let importMessage = '';
  // Settles once the cached quote (if any) is painted; the network refresh is never awaited.
  let cachedQuoteRead: Promise<unknown> = Promise.resolve();
  let localeSupported = isLocaleSupported();
  const isActive = () => prefs.enabled && (prefs.provider === 'custom' || localeSupported);
  const store = config.settings;
  function syncBottomHeight(): void {
    const height = !element.hidden && prefs.position === 'bottom'
      ? Math.ceil(element.getBoundingClientRect().height) : 0;
    document.body.style.setProperty('--x-nt-quote-bottom-height', `${height}px`);
  }
  const resizeObserver = typeof window.ResizeObserver === 'function'
    ? new window.ResizeObserver(syncBottomHeight) : null;

  function getFontSize(): number {
    return draftFontSize === null ? prefs.fontSize : draftFontSize;
  }

  function previewFontSize(size: number): void {
    draftFontSize = settings.newtabQuotePrefs.parse({ ...prefs, fontSize: size }).fontSize;
    element.style.setProperty('--x-nt-quote-font-size', `${draftFontSize}px`);
    renderSettings();
    syncBottomHeight();
    if (config.onLayout) config.onLayout();
  }

  function commitFontSize(size: number): void {
    const normalized = settings.newtabQuotePrefs.parse({ ...prefs, fontSize: size }).fontSize;
    if (normalized !== prefs.fontSize) {
      draftFontSize = normalized;
      persist({ fontSize: normalized });
    } else {
      draftFontSize = null;
      render();
    }
  }

  function getFont() {
    return settings.NEWTAB_QUOTE_FONTS.find((font) => font.id === prefs.font) || settings.NEWTAB_QUOTE_FONTS[0];
  }

  // Listed in on-page order, top to bottom.
  const POSITIONS: readonly NewtabQuotePosition[] = ['top', 'input', 'search', 'bottom'];
  function labels(): Record<NewtabQuotePosition | NewtabQuotePrefs['category'], string> {
    return {
      top: t('newtab_quote_top', 'Above search box'),
      input: t('newtab_quote_input', 'Below search box'),
      search: t('newtab_quote_search', 'Below shortcuts'),
      bottom: t('newtab_quote_bottom', 'Page bottom'),
      literature: t('newtab_quote_literature', 'Literature'),
      poetry: t('newtab_quote_poetry', 'Poetry')
    };
  }

  const settingsActions: QuoteSettingsActions = {
    toggleExpanded() {
      if (!prefs.enabled) return;
      settingsExpanded = !settingsExpanded;
      renderSettings();
    },
    setEnabled(enabled) {
      if (enabled) settingsExpanded = true;
      persist({ enabled });
    },
    setProvider(provider) {
      persist({ provider });
    },
    importFile(file) {
      void importQuoteFile(file);
    },
    shuffleLibrary() {
      void shuffle();
    },
    setCategory(category) {
      persist({ category });
    },
    setFontSize(size: number, change: SliderChange) {
      if (change.final) commitFontSize(size);
      else previewFontSize(size);
    }
  };

  function getSettingsModel(): QuoteSettingsModel {
    const text = labels();
    const title = t('newtab_quote_title', 'Daily quote');
    const sourceLabel = t('newtab_quote_source', 'Source');
    const categoryLabel = t('newtab_quote_category', 'Quote category');
    const positionLabel = t('newtab_quote_position', 'Quote position');
    const count = library
      ? t('newtab_quote_count', '{count} quotes').replace('{count}', String(library.quotes.length))
      : '';
    return {
      quote: {
        title,
        enabled: prefs.enabled,
        expanded: settingsExpanded,
        infoTooltip: getProviderLabel(),
        sourceLabel,
        source: {
          active: prefs.provider === 'custom' ? 'custom' : 'hitokoto',
          label: sourceLabel,
          options: [
            { value: 'hitokoto', label: t('newtab_quote_hitokoto', 'Hitokoto') },
            { value: 'custom', label: t('newtab_quote_custom', 'Custom') }
          ]
        },
        customMode: prefs.provider === 'custom',
        library: {
          title: t('newtab_quote_library', 'Quote collection'),
          infoTooltip: t('newtab_quote_import_hint', 'TXT / MD: one non-empty content line per quote. Up to 1 MB, 1,000 quotes, 500 characters each; kept on this device, not in browser sync; WebDAV syncs it when turned on.'),
          importLabel: importing
            ? t('newtab_quote_importing', 'Importing…')
            : (library ? t('newtab_quote_replace', 'Replace file') : t('newtab_quote_import', 'Import file')),
          importing,
          shuffleLabel: t('newtab_quote_shuffle_button', 'Shuffle'),
          shuffleVisible: Boolean(library && library.quotes.length >= 2),
          status: importMessage ? { text: importMessage, error: importError } : null,
          count: library ? { text: count, label: `${library.filename} · ${count}`, filename: library.filename } : null
        },
        categoryLabel,
        category: {
          active: prefs.category === 'poetry' ? 'poetry' : 'literature',
          label: categoryLabel,
          options: [
            { value: 'literature', label: text.literature },
            { value: 'poetry', label: text.poetry }
          ]
        },
        positionLabel,
        positionSelect: {
          ariaLabel: positionLabel,
          options: POSITIONS.map((value) => ({ value, label: text[value] })),
          value: prefs.position,
          onChange: (position) => persist({ position })
        },
        fontLabel: t('newtab_quote_font', 'Font'),
        fontSelect: {
          ariaLabel: t('newtab_quote_font_label', 'Quote font'),
          options: settings.NEWTAB_QUOTE_FONTS.map((font) => ({ value: font.id, label: t(font.labelKey, font.label) })),
          value: getFont().id,
          onChange: (font) => persist({ font })
        },
        fontSize: {
          label: t('newtab_quote_font_size', 'Font size'),
          ariaLabel: t('newtab_quote_font_size_label', 'Quote font size (px)'),
          min: settings.NEWTAB_QUOTE_FONT_SIZE_MIN,
          max: settings.NEWTAB_QUOTE_FONT_SIZE_MAX,
          value: getFontSize()
        }
      },
      actions: settingsActions
    };
  }

  function renderSettings(): void {
    if (settingsView) settingsView.renderQuoteSettings(getSettingsModel());
  }

  const shuffleLabel = () => t('newtab_quote_shuffle', 'Show another quote');
  // Open toward the free side of the page: away from the search box, and inward at the bottom edge.
  const showTooltip = (target: HTMLElement, text: string) => {
    const tooltip = getTooltip();
    if (tooltip && text) {
      tooltip.show(target, text, { placement: prefs.position === 'top' || prefs.position === 'bottom' ? 'top' : 'bottom' });
    }
  };
  const hideTooltip = () => {
    const tooltip = getTooltip();
    if (tooltip) tooltip.hide();
  };
  const lineView = createQuoteLineView(element, {
    onShowOrigin: (target) => showTooltip(target, origin),
    onShowShuffleLabel: (target) => showTooltip(target, shuffleLabel()),
    onHideTooltip: hideTooltip,
    onShuffle: () => { void shuffle(); }
  });

  function getLineModel(current: DailyQuote): QuoteLineModel {
    const withoutTooltip = !config.getTooltipController;
    return {
      text: current.text,
      href: prefs.provider === 'custom'
        ? null
        : (/^https:\/\/hitokoto\.cn\//.test(current.url || '') ? current.url : 'https://hitokoto.cn/'),
      ariaLabel: [current.text, origin].filter(Boolean).join(' — '),
      shuffleLabel: shuffleLabel(),
      originTitle: withoutTooltip ? origin : '',
      shuffleTitle: withoutTooltip ? shuffleLabel() : '',
      shuffling,
      swapCount
    };
  }

  function renderLine(): void {
    if (quote && !disposed) lineView.render(getLineModel(quote));
  }

  function updateText(): void {
    element.setAttribute('aria-label', t('newtab_quote_title', 'Daily quote'));
    if (quote) {
      origin = [quote.author, quote.source ? `《${quote.source}》` : ''].filter(Boolean).join(' · ');
      renderLine();
    }
    renderSettings();
  }
  function render(): void {
    if (!mounted || disposed) return;
    element.dataset.position = prefs.position;
    document.body.dataset.quotePosition = isActive() ? prefs.position : 'off';
    element.style.setProperty('--x-nt-quote-font-size', `${getFontSize()}px`);
    element.style.setProperty('--x-nt-quote-font-family', getFont().family);
    element.hidden = !isActive() || !quote;
    // Re-inserting a node restarts its entry animation, so only move it when its slot changed.
    const place = (parent: ParentNode | null, before: ChildNode | null) => {
      if (parent && (element.parentNode !== parent || element.nextSibling !== before)) parent.insertBefore(element, before);
    };
    if (prefs.position === 'top') {
      const anchor = config.getSearchRoot();
      place(anchor.parentNode, anchor);
    } else if (prefs.position === 'input') {
      const anchor = config.getSearchRoot();
      place(anchor.parentNode, anchor.nextSibling);
    } else if (prefs.position === 'search') {
      const shortcuts = config.getShortcutSection && config.getShortcutSection();
      const anchor = shortcuts && shortcuts.parentNode ? shortcuts : config.getSearchRoot();
      place(anchor.parentNode, anchor.nextSibling);
    } else if (element.parentNode !== document.body) document.body.appendChild(element);
    updateText();
    syncBottomHeight();
    if (config.onLayout) config.onLayout();
  }
  async function refresh(): Promise<void> {
    const current = ++revision;
    if (!isActive()) return render();
    if (prefs.provider === 'custom') {
      const values = await (cachedQuoteRead = readCustomValues());
      if (current !== revision || disposed || prefs.provider !== 'custom') return;
      library = custom.normalizeLibrary(values[custom.KEY]);
      quote = library ? custom.select(library, new Date(), custom.readQuotePick(values[NewtabQuoteSettings.customQuotePick.key]), false).quote : null;
      render(); scheduleDaily(); return;
    }
    const category = prefs.category;
    // Render the last successful response before making a network request.
    await (cachedQuoteRead = store.include(quoteCache).then(() => {
      const cached = LumnoNewtabRemoteContent.readCachedQuoteFor(store.getStored(quoteCache), category);
      if (current === revision && cached) {
        quote = cached;
        render();
      }
    }));
    const next = await client.getQuote(category);
    if (current !== revision || disposed || !isActive()) return;
    quote = next;
    render();
    scheduleDaily();
  }
  function scheduleDaily(): void {
    window.clearTimeout(dayTimer);
    const tomorrow = new Date();
    tomorrow.setHours(24, 0, 1, 0);
    dayTimer = window.setTimeout(() => {
      if (document.visibilityState === 'visible') void refresh();
    }, tomorrow.getTime() - Date.now());
  }
  function apply(value: unknown): void {
    const next = settings.newtabQuotePrefs.parse(value);
    const changedCategory = next.category !== prefs.category || next.provider !== prefs.provider;
    const activated = !isActive() && next.enabled && (next.provider === 'custom' || localeSupported);
    prefs = next;
    draftFontSize = null;
    if (changedCategory) quote = null;
    sync(changedCategory || activated);
  }
  function sync(shouldRefresh: boolean): void {
    if (!isActive()) {
      revision += 1;
      window.clearTimeout(dayTimer);
    }
    render();
    renderSettings();
    if (shouldRefresh) refresh().catch(() => {});
  }
  function updateLanguage(): void {
    const supported = isLocaleSupported();
    if (supported === localeSupported) return updateText();
    localeSupported = supported;
    sync(mounted && supported && prefs.enabled);
  }
  // Saves a preference change; each value is normalized like a stored one.
  function persist(change: Partial<Record<keyof NewtabQuotePrefs, unknown>>): void {
    const next = settings.newtabQuotePrefs.parse({ ...prefs, ...change });
    store.set(settings.newtabQuotePrefs, next).then(() => apply(next), () => {
      draftFontSize = null;
      render();
      if (config.showToast) config.showToast(t('newtab_quote_save_error', 'Failed to save quote settings'), true);
    });
  }
  // Changes other pages or Settings store: the preferences, this device's
  // collection and pick, and a quote the remote client cached.
  function followStoredQuotes(): void {
    unsubscribes = [
      store.subscribe(settings.newtabQuotePrefs, () => {
        if (!disposed) apply(store.getStored(settings.newtabQuotePrefs));
      }),
      store.subscribe([NewtabQuoteSettings.customQuotes, NewtabQuoteSettings.customQuotePick], () => {
        if (disposed) return;
        library = custom.normalizeLibrary(store.getStored(NewtabQuoteSettings.customQuotes));
        renderSettings();
        if (prefs.provider === 'custom') refresh().catch(() => {});
      }),
      store.subscribe(quoteCache, () => {
        if (disposed || prefs.provider === 'custom') return;
        const cached = LumnoNewtabRemoteContent.readCachedQuoteFor(store.getStored(quoteCache), prefs.category);
        if (cached) {
          quote = cached;
          render();
        }
      })
    ];
  }
  const onVisibility = () => {
    if (document.visibilityState === 'visible' && isActive()) refresh().catch(() => {});
  };
  // The pick replaces today's cached quote, so it stays until the next daily update.
  async function shuffle(): Promise<void> {
    if (shuffling || !isActive()) return;
    const current = ++revision;
    const category = prefs.category;
    shuffling = true;
    renderLine();
    try {
      let next: DailyQuote;
      if (prefs.provider === 'custom') {
        const values = await readCustomValues();
        const currentLibrary = custom.normalizeLibrary(values[custom.KEY]);
        if (!currentLibrary) return;
        const selected = custom.select(currentLibrary, new Date(), custom.readQuotePick(values[NewtabQuoteSettings.customQuotePick.key]), true);
        await store.set(NewtabQuoteSettings.customQuotePick, selected.pick);
        next = selected.quote;
      } else next = await client.getQuote(category, { reroll: true });
      if (current !== revision || disposed || !isActive()) return;
      quote = next;
      // Each shuffled quote fades in, even when two land back to back.
      swapCount += 1;
      render();
    } catch {
      if (!disposed && config.showToast) config.showToast(t('newtab_quote_shuffle_error', 'Could not load another quote'), true);
    } finally {
      shuffling = false;
      renderLine();
    }
  }
  function getProviderLabel(): string {
    return prefs.provider === 'custom' ? t('newtab_quote_provider_custom', 'Custom collection · on this device, syncs with WebDAV') : t('newtab_quote_provider', 'Powered by Hitokoto');
  }
  function readCustomValues(): Promise<StorageItems> {
    const stored = [NewtabQuoteSettings.customQuotes, NewtabQuoteSettings.customQuotePick];
    return store.include(stored).then(() => ({
      [custom.KEY]: store.getStored(NewtabQuoteSettings.customQuotes),
      [NewtabQuoteSettings.customQuotePick.key]: store.getStored(NewtabQuoteSettings.customQuotePick)
    }));
  }
  async function importQuoteFile(file: QuoteFile): Promise<boolean> {
    if (importing || disposed) return false;
    importing = true; importError = false; importMessage = ''; renderSettings();
    let saving = false;
    try {
      const next = await custom.readLibraryFile(file);
      saving = true;
      await store.setMany([[NewtabQuoteSettings.customQuotes, next], [NewtabQuoteSettings.customQuotePick, null]]);
      saving = false;
      if (disposed) return false;
      library = next;
      persist({ provider: 'custom' });
      if (prefs.provider === 'custom') await refresh();
      return true;
    } catch {
      if (!disposed) {
        importError = true;
        importMessage = saving
          ? t('newtab_quote_collection_save_error', 'Couldn’t save on this device. Your previous collection is kept.')
          : t('newtab_quote_import_error', 'Import failed: the file doesn’t meet the format or size limits. Your previous collection is kept.');
      }
      return false;
    } finally { importing = false; if (!disposed) renderSettings(); }
  }
  // Draws the quote section in the panel from now on.
  function bindSettings(nextView: QuoteSettingsView | null | undefined): void {
    if (!nextView) return;
    settingsView = nextView;
    renderSettings();
  }
  function mount(): Promise<void> {
    mounted = true;
    render();
    if (resizeObserver) resizeObserver.observe(element);
    document.addEventListener('visibilitychange', onVisibility);
    followStoredQuotes();
    // Resolves after the saved preference and cached quote are rendered, so the page can
    // reveal with the quote already in its slot instead of shifting the layout afterwards.
    return store.include(settings.newtabQuotePrefs).then(() => {
      if (!disposed) apply(store.getStored(settings.newtabQuotePrefs));
      return cachedQuoteRead;
    }).then(() => undefined);
  }
  return Object.freeze({ element, mount, bindSettings, updateLanguage, getProviderLabel,
    getTextElement: () => lineView.getTextElement(),
    importQuoteFile,
    importMarkdown: importQuoteFile,
    destroy() {
      disposed = true;
      revision += 1;
      window.clearTimeout(dayTimer);
      if (resizeObserver) resizeObserver.disconnect();
      unsubscribes.forEach((stop) => stop());
      document.removeEventListener('visibilitychange', onVisibility);
      hideTooltip();
      lineView.destroy();
      element.remove();
    } });
}

type QuoteRuntime = ReturnType<typeof createRuntime>;

export { createRuntime };
export type { QuoteRuntime, QuoteRuntimeOptions };
