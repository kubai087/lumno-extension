(function(root, factory) {
  const api = factory(root);
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.LumnoNewtabQuotes = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function(root) {
  'use strict';
  function createRuntime(options) {
    const config = options || {};
    const document = config.documentObj || root.document;
    const window = config.windowObj || root.window;
    const settings = root.LumnoSettings;
    const custom = root.LumnoCustomQuotes || (typeof require === 'function' ? require('./custom-quotes.js') : null);
    const key = settings.NEWTAB_QUOTE_PREFS_STORAGE_KEY;
    const t = config.t;
    // Hitokoto only serves Chinese text, so the quote exists for Chinese UI languages only.
    const isLocaleSupported = () => !config.getLocale || /^zh_(CN|TW)$/.test(config.getLocale() || '');
    const client = config.client || root.LumnoNewtabRemoteContent.createClient({
      storageArea: config.localStorageArea,
      fallbackQuote: () => ({
        text: t('newtab_quote_fallback_text', 'A journey of a thousand miles begins with a single step.'),
        author: t('newtab_quote_fallback_author', 'Laozi'),
        source: t('newtab_quote_fallback_source', 'Tao Te Ching'),
        url: 'https://hitokoto.cn/'
      })
    });
    const element = document.createElement('div');
    element.className = 'x-nt-quote';
    element.hidden = true;
    // The whole line opens the quote's Hitokoto page; its origin lives in the shared tooltip.
    const button = document.createElement('a');
    button.className = 'x-nt-quote-text';
    button.target = '_blank';
    button.rel = 'noopener noreferrer';
    // The link spans the whole row; the inline line box marks where the glyphs
    // actually sit, so wallpaper tone sampling stays local to the text.
    const line = document.createElement('span');
    line.className = 'x-nt-quote-line';
    button.appendChild(line);
    // Revealed on hover; it hangs past the line's end so the quote stays centered.
    const shuffleButton = document.createElement('button');
    shuffleButton.type = 'button';
    shuffleButton.className = 'x-nt-quote-shuffle';
    const shuffleIcon = document.createElement('i');
    shuffleIcon.className = 'ri-icon ri-size-16 ri-shuffle-line';
    shuffleIcon.setAttribute('aria-hidden', 'true');
    shuffleButton.appendChild(shuffleIcon);
    const row = document.createElement('div');
    row.className = 'x-nt-quote-row';
    row.append(button, shuffleButton);
    element.append(row);
    // Resolved on use: the page creates its tooltip controllers after the quote runtime.
    const getTooltip = () => (config.getTooltipController ? config.getTooltipController() : null);
    let origin = '';
    let prefs = settings.normalizeNewtabQuotePrefs(null);
    let quote = null;
    let revision = 0;
    let refs;
    let view = null;
    let settingsExpanded = true;
    let mounted = false;
    let dayTimer;
    let unsubscribe;
    let disposed = false;
    let draftFontSize = null;
    let shuffling = false;
    let library = null;
    let importing = false;
    let importError = false;
    let importMessage = '';
    // Settles once the cached quote (if any) is painted; the network refresh is never awaited.
    let cachedQuoteRead = Promise.resolve();
    let localeSupported = isLocaleSupported();
    const isActive = () => prefs.enabled && (prefs.provider === 'custom' || localeSupported);
    const area = config.storageArea;
    function syncBottomHeight() {
      const height = !element.hidden && prefs.position === 'bottom'
        ? Math.ceil(element.getBoundingClientRect().height) : 0;
      document.body.style.setProperty('--x-nt-quote-bottom-height', `${height}px`);
    }
    const resizeObserver = typeof window.ResizeObserver === 'function'
      ? new window.ResizeObserver(syncBottomHeight) : null;

    function syncFontSizeControls(forceValue) {
      if (!refs || !refs.quoteFontSizeSlider) return;
      const size = draftFontSize === null ? prefs.fontSize : draftFontSize;
      const min = settings.NEWTAB_QUOTE_FONT_SIZE_MIN;
      const max = settings.NEWTAB_QUOTE_FONT_SIZE_MAX;
      const label = t('newtab_quote_font_size_label', 'Quote font size (px)');
      refs.quoteFontSizeTitle.textContent = t('newtab_quote_font_size', 'Font size');
      refs.quoteFontSizeSlider.min = String(min);
      refs.quoteFontSizeSlider.max = String(max);
      refs.quoteFontSizeSlider.step = '1';
      refs.quoteFontSizeSlider.value = String(size);
      refs.quoteFontSizeSlider.setAttribute('aria-label', label);
      refs.quoteFontSizeSlider.style.setProperty('--x-range-slider-percent', `${(size - min) / (max - min) * 100}%`);
      const input = refs.quoteFontSizeSliderValueInput;
      input.min = String(min);
      input.max = String(max);
      input.step = '1';
      input.setAttribute('aria-label', label);
      if (forceValue || document.activeElement !== input) input.value = String(size);
    }

    function previewFontSize(value) {
      draftFontSize = settings.normalizeNewtabQuotePrefs({ ...prefs, fontSize: value }).fontSize;
      element.style.setProperty('--x-nt-quote-font-size', `${draftFontSize}px`);
      syncFontSizeControls(false);
      syncBottomHeight();
      if (config.onLayout) config.onLayout();
    }

    function commitFontSize(value) {
      const raw = String(value).trim();
      if (!raw || !Number.isFinite(Number(raw))) {
        draftFontSize = null;
        render();
      } else {
        const size = settings.normalizeNewtabQuotePrefs({ ...prefs, fontSize: raw }).fontSize;
        if (size !== prefs.fontSize) {
          draftFontSize = size;
          persist({ fontSize: size });
        }
        else {
          draftFontSize = null;
          render();
        }
      }
      syncFontSizeControls(true);
    }

    // Listed in on-page order, top to bottom.
    const POSITIONS = ['top', 'input', 'search', 'bottom'];
    function labels() {
      return {
        top: t('newtab_quote_top', 'Above search box'),
        input: t('newtab_quote_input', 'Below search box'),
        search: t('newtab_quote_search', 'Below shortcuts'),
        bottom: t('newtab_quote_bottom', 'Page bottom'),
        literature: t('newtab_quote_literature', 'Literature'),
        poetry: t('newtab_quote_poetry', 'Poetry')
      };
    }
    function updateSettings() {
      if (!refs) return;
      if (refs.quoteSection) refs.quoteSection.hidden = false;
      if (refs.quoteDivider) refs.quoteDivider.hidden = false;
      const text = labels();
      const title = t('newtab_quote_title', 'Daily quote');
      refs.quoteTitle.textContent = title;
      refs.quoteEnabledToggle.checked = prefs.enabled;
      refs.quoteEnabledToggle.setAttribute('aria-label', title);
      refs.quoteBody.hidden = !(prefs.enabled && settingsExpanded);
      if (refs.quoteAccordionTrigger) {
        refs.quoteAccordionTrigger.disabled = !prefs.enabled;
        refs.quoteAccordionTrigger.setAttribute('aria-disabled', prefs.enabled ? 'false' : 'true');
        refs.quoteAccordionTrigger.setAttribute(
          'aria-expanded',
          prefs.enabled && settingsExpanded ? 'true' : 'false'
        );
      }
      if (refs.quoteInfoButton) refs.quoteInfoButton.setAttribute('aria-label', getProviderLabel());
      refs.quoteCategory.setAttribute('aria-label', t('newtab_quote_category', 'Quote category'));
      if (refs.quotePositionLabel) refs.quotePositionLabel.textContent = t('newtab_quote_position', 'Quote position');
      if (refs.quoteCategoryLabel) refs.quoteCategoryLabel.textContent = t('newtab_quote_category', 'Quote category');
      const customMode = prefs.provider === 'custom';
      if (refs.quoteSourceLabel) refs.quoteSourceLabel.textContent = t('newtab_quote_source', 'Source');
      if (refs.quoteSource) {
        refs.quoteSource.setAttribute('aria-label', t('newtab_quote_source', 'Source'));
        refs.quoteSource.querySelectorAll('[data-quote-provider]').forEach(item => {
          const provider = item.dataset.quoteProvider;
          item.textContent = provider === 'custom' ? t('newtab_quote_custom', 'Custom') : t('newtab_quote_hitokoto', 'Hitokoto');
          item.setAttribute('aria-pressed', String(provider === prefs.provider));
          item.setAttribute('data-active', String(provider === prefs.provider));
          item.disabled = importing;
        });
      }
      if (refs.quoteCustomBody) refs.quoteCustomBody.hidden = !customMode;
      refs.quoteCategory.hidden = customMode;
      if (refs.quoteCategory.parentElement?.classList.contains('x-nt-appearance-setting-row')) refs.quoteCategory.parentElement.hidden = customMode;
      if (refs.quoteImportButton) {
        refs.quoteImportButton.textContent = importing ? t('newtab_quote_importing', 'Importing…') : t('newtab_quote_import_md', 'Import TXT / MD file');
        refs.quoteImportButton.disabled = importing;
      }
      if (refs.quoteImportHint) refs.quoteImportHint.textContent = t('newtab_quote_import_hint', 'TXT / MD: one non-empty content line per quote. Up to 1 MB, 1,000 quotes, 500 characters each; stored on this device only.');
      if (refs.quoteImportStatus) {
        refs.quoteImportStatus.textContent = importMessage || (library ? `${library.filename} · ${library.quotes.length} ${t('newtab_quote_entries', 'quotes')}` : t('newtab_quote_import_empty', 'Import a TXT or MD file to start.'));
        refs.quoteImportStatus.setAttribute('role', importError ? 'alert' : 'status');
      }
      syncFontSizeControls(false);
      refs.quoteCategory.querySelectorAll('[data-quote-category]').forEach((item) => {
        const value = item.getAttribute('data-quote-category');
        item.textContent = text[value];
        const selected = value === prefs.category;
        item.setAttribute('aria-pressed', selected ? 'true' : 'false');
        item.setAttribute('data-active', selected ? 'true' : 'false');
      });
      syncTabIndicator(refs.quoteCategory);
      if (view && view.renderQuotePositionSelect) {
        view.renderQuotePositionSelect({
          ariaLabel: t('newtab_quote_position', 'Quote position'),
          options: POSITIONS.map((value) => ({ value, label: text[value] })),
          value: prefs.position,
          onChange: (position) => persist({ position })
        });
      }
    }
    // Tabs hug their labels, so the indicator follows the active button's measured box.
    function syncTabIndicator(group) {
      const segmentedIndicator = globalThis.LumnoSegmentedIndicator;
      if (segmentedIndicator) segmentedIndicator.sync(group.querySelector('.x-nt-segmented-tabs-indicator'));
    }
    const tabResizeObserver = typeof window.ResizeObserver === 'function'
      ? new window.ResizeObserver((entries) => entries.forEach((entry) => syncTabIndicator(entry.target)))
      : null;
    const shuffleLabel = () => t('newtab_quote_shuffle', 'Show another quote');
    // Full-width closing punctuation leaves half an em of blank space after its ink, which reads as
    // a lopsided gap at the end of the line, so the trailing run is set half-width.
    const TRAILING_PUNCTUATION = /[\u3001\u3002\uff0c\uff0e\uff1a\uff1b\uff01\uff1f\uff09\u3009\u300b\u300d\u300f\u3011\u3015\u3017\u201d\u2019]+$/;
    function renderLine(text) {
      if (line.textContent === text) return;
      const tail = TRAILING_PUNCTUATION.exec(text);
      if (!tail) {
        line.textContent = text;
        return;
      }
      const tailElement = document.createElement('span');
      tailElement.className = 'x-nt-quote-tail';
      tailElement.textContent = tail[0];
      line.replaceChildren(document.createTextNode(text.slice(0, tail.index)), tailElement);
    }
    function updateText() {
      element.setAttribute('aria-label', t('newtab_quote_title', 'Daily quote'));
      shuffleButton.setAttribute('aria-label', shuffleLabel());
      if (!config.getTooltipController) shuffleButton.title = shuffleLabel();
      if (quote) {
        renderLine(quote.text);
        origin = [quote.author, quote.source ? `《${quote.source}》` : ''].filter(Boolean).join(' · ');
        if (!config.getTooltipController) button.title = origin;
        button.setAttribute('aria-label', [quote.text, origin].filter(Boolean).join(' — '));
        if (prefs.provider === 'custom') { button.removeAttribute('href'); button.tabIndex = -1; }
        else { button.href = /^https:\/\/hitokoto\.cn\//.test(quote.url || '') ? quote.url : 'https://hitokoto.cn/'; button.removeAttribute('tabindex'); }
      }
      updateSettings();
    }
    function render() {
      if (!mounted || disposed) return;
      element.dataset.position = prefs.position;
      document.body.dataset.quotePosition = isActive() ? prefs.position : 'off';
      element.style.setProperty('--x-nt-quote-font-size', `${draftFontSize === null ? prefs.fontSize : draftFontSize}px`);
      element.hidden = !isActive() || !quote;
      // Re-inserting a node restarts its entry animation, so only move it when its slot changed.
      const place = (parent, before) => {
        if (element.parentNode !== parent || element.nextSibling !== before) parent.insertBefore(element, before);
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
    async function refresh() {
      const current = ++revision;
      if (!isActive()) return render();
      if (prefs.provider === 'custom') {
        const values = await (cachedQuoteRead = readCustomValues());
        if (current !== revision || disposed || prefs.provider !== 'custom') return;
        library = custom.normalizeLibrary(values[custom.KEY]);
        quote = library ? custom.select(library, new Date(), values[custom.PICK_KEY], false).quote : null;
        render(); scheduleDaily(); return;
      }
      const category = prefs.category;
      // Render the last successful response before making a network request.
      if (config.localStorageArea) {
        await (cachedQuoteRead = new Promise((resolve) => config.localStorageArea.get(
          [root.LumnoNewtabRemoteContent.QUOTE_CACHE_KEY], (values) => {
            const cache = values && values[root.LumnoNewtabRemoteContent.QUOTE_CACHE_KEY];
            if (current === revision && cache && cache[category] && cache[category].quote) {
              quote = cache[category].quote;
              render();
            }
            resolve();
          }
        )));
      }
      const next = await client.getQuote(category);
      if (current !== revision || disposed || !isActive()) return;
      quote = next;
      render();
      scheduleDaily();
    }
    function scheduleDaily() {
      window.clearTimeout(dayTimer);
      const tomorrow = new Date();
      tomorrow.setHours(24, 0, 1, 0);
      dayTimer = window.setTimeout(() => {
        if (document.visibilityState === 'visible') refresh();
      }, tomorrow.getTime() - Date.now());
    }
    function apply(value) {
      const next = settings.normalizeNewtabQuotePrefs(value);
      const changedCategory = next.category !== prefs.category || next.provider !== prefs.provider;
      const activated = !isActive() && next.enabled && (next.provider === 'custom' || localeSupported);
      prefs = next;
      draftFontSize = null;
      if (changedCategory) quote = null;
      sync(changedCategory || activated);
    }
    function sync(shouldRefresh) {
      if (!isActive()) {
        revision += 1;
        window.clearTimeout(dayTimer);
      }
      render();
      updateSettings();
      if (shouldRefresh) refresh().catch(() => {});
    }
    function updateLanguage() {
      const supported = isLocaleSupported();
      if (supported === localeSupported) return updateText();
      localeSupported = supported;
      sync(mounted && supported && prefs.enabled);
    }
    function persist(change) {
      const next = settings.normalizeNewtabQuotePrefs({ ...prefs, ...change });
      if (!area) return;
      area.set({ [key]: next }, () => {
        const error = root.chrome && root.chrome.runtime && root.chrome.runtime.lastError;
        if (error) {
          draftFontSize = null;
          render();
          if (config.showToast) config.showToast(t('newtab_quote_save_error', 'Failed to save quote settings'), true);
        } else apply(next);
      });
    }
    function handleStorageChange(changes, areaName) {
      if (disposed) return;
      if (changes[key] && (!config.isPreferenceArea || config.isPreferenceArea(areaName))) apply(changes[key].newValue);
      if (areaName === 'local' && (changes[custom.KEY] || changes[custom.PICK_KEY])) {
        if (changes[custom.KEY]) library = custom.normalizeLibrary(changes[custom.KEY].newValue);
        updateSettings();
        if (prefs.provider === 'custom') refresh().catch(() => {});
      }
      if (prefs.provider !== 'custom' && areaName === 'local' && changes[root.LumnoNewtabRemoteContent.QUOTE_CACHE_KEY]) {
        const cache = changes[root.LumnoNewtabRemoteContent.QUOTE_CACHE_KEY].newValue;
        if (cache && cache[prefs.category] && cache[prefs.category].quote) {
          quote = cache[prefs.category].quote;
          render();
        }
      }
    }
    const onVisibility = () => {
      if (document.visibilityState === 'visible' && isActive()) refresh().catch(() => {});
    };
    // Open toward the free side of the page: away from the search box, and inward at the bottom edge.
    const showTooltip = (target, text) => {
      const tooltip = getTooltip();
      if (tooltip && text) {
        tooltip.show(target, text, { placement: prefs.position === 'top' || prefs.position === 'bottom' ? 'top' : 'bottom' });
      }
    };
    const showOrigin = () => showTooltip(button, origin);
    const hideOrigin = () => {
      const tooltip = getTooltip();
      if (tooltip) tooltip.hide();
    };
    // The pick replaces today's cached quote, so it stays until the next daily update.
    async function shuffle() {
      if (shuffling || !isActive()) return;
      const current = ++revision;
      const category = prefs.category;
      shuffling = true;
      shuffleButton.dataset.loading = 'true';
      shuffleButton.setAttribute('aria-busy', 'true');
      try {
        let next;
        if (prefs.provider === 'custom') {
          const values = await readCustomValues();
          const currentLibrary = custom.normalizeLibrary(values[custom.KEY]);
          if (!currentLibrary) return;
          const selected = custom.select(currentLibrary, new Date(), values[custom.PICK_KEY], true);
          await saveCustomValues({ [custom.PICK_KEY]: selected.pick });
          next = selected.quote;
        } else next = await client.getQuote(category, { reroll: true });
        if (current !== revision || disposed || !isActive()) return;
        quote = next;
        render();
        // Restart the swap fade even when two shuffles land back to back.
        line.removeAttribute('data-swap');
        void line.offsetWidth;
        line.setAttribute('data-swap', 'true');
      } catch (_error) {
        if (!disposed && config.showToast) config.showToast(t('newtab_quote_shuffle_error', 'Could not load another quote'), true);
      } finally {
        shuffling = false;
        delete shuffleButton.dataset.loading;
        shuffleButton.removeAttribute('aria-busy');
      }
    }
    const showShuffleLabel = () => showTooltip(shuffleButton, shuffleLabel());
    function getProviderLabel() {
      return prefs.provider === 'custom' ? t('newtab_quote_provider_custom', 'Custom collection · stored on this device') : t('newtab_quote_provider', 'Powered by Hitokoto');
    }
    function readCustomValues() {
      return new Promise((resolve, reject) => {
        if (!config.localStorageArea) return resolve({});
        config.localStorageArea.get([custom.KEY, custom.PICK_KEY], values => {
          const error = (config.chromeObj || root.chrome)?.runtime?.lastError;
          if (error) reject(new Error(error.message)); else resolve(values || {});
        });
      });
    }
    function saveCustomValues(values) {
      return new Promise((resolve, reject) => {
        if (!config.localStorageArea) return reject(new Error('Local quote storage unavailable'));
        config.localStorageArea.set(values, () => {
          const error = (config.chromeObj || root.chrome)?.runtime?.lastError;
          if (error) reject(new Error(error.message)); else resolve();
        });
      });
    }
    async function importQuoteFile(file) {
      if (importing || disposed) return false;
      importing = true; importError = false; importMessage = ''; updateSettings();
      let saving = false;
      try {
        if (!/\.(txt|md|markdown)$/i.test(file.name || '')) throw new Error('type');
        if (!file.size || file.size > custom.MAX_BYTES) throw new Error('too-large');
        const text = typeof file.text === 'function' ? await file.text() : await new Promise((resolve, reject) => {
          const reader = new window.FileReader(); reader.onload = () => resolve(String(reader.result)); reader.onerror = () => reject(new Error('read')); reader.readAsText(file);
        });
        const quotes = custom.parseQuotes(text, /\.txt$/i.test(file.name) ? 'txt' : 'md');
        const next = { version: 1, filename: String(file.name).slice(0, 128), revision: Date.now(), quotes };
        saving = true;
        await saveCustomValues({ [custom.KEY]: next, [custom.PICK_KEY]: null });
        saving = false;
        if (disposed) return false;
        library = next;
        persist({ provider: 'custom' });
        if (prefs.provider === 'custom') await refresh();
        return true;
      } catch (_) {
        if (!disposed) {
          importError = true;
          importMessage = saving
            ? t('newtab_quote_collection_save_error', 'Could not save on this device. Your previous collection is retained. Try again.')
            : t('newtab_quote_import_error', 'Import failed. Choose a valid TXT or MD file up to 1 MB with 1–1,000 non-empty content lines, each no longer than 500 characters.');
        }
        return false;
      } finally { importing = false; if (!disposed) updateSettings(); }
    }
    shuffleButton.addEventListener('click', () => { shuffle(); });
    line.addEventListener('animationend', () => line.removeAttribute('data-swap'));
    shuffleButton.addEventListener('mouseenter', showShuffleLabel);
    shuffleButton.addEventListener('focus', showShuffleLabel);
    shuffleButton.addEventListener('mouseleave', hideOrigin);
    shuffleButton.addEventListener('blur', hideOrigin);
    button.addEventListener('mouseenter', showOrigin);
    button.addEventListener('focus', showOrigin);
    button.addEventListener('mouseleave', hideOrigin);
    button.addEventListener('blur', hideOrigin);
    button.addEventListener('click', hideOrigin);
    // The position select is a React island owned by the panel view, so the view renders it.
    function bindSettings(nextRefs, nextView) {
      refs = nextRefs;
      view = nextView || null;
      if (!refs.quoteCategory) return;
      refs.quoteEnabledToggle.addEventListener('change', () => persist({ enabled: refs.quoteEnabledToggle.checked }));
      refs.quoteSource?.querySelectorAll('[data-quote-provider]').forEach(item => item.addEventListener('click', () => persist({ provider: item.dataset.quoteProvider })));
      refs.quoteImportButton?.addEventListener('click', () => refs.quoteFileInput?.click());
      refs.quoteFileInput?.addEventListener('change', () => {
        const file = refs.quoteFileInput.files && refs.quoteFileInput.files[0];
        refs.quoteFileInput.value = '';
        if (file) importQuoteFile(file);
      });
      if (refs.quoteAccordionTrigger) {
        refs.quoteAccordionTrigger.addEventListener('click', () => {
          if (!prefs.enabled) return;
          settingsExpanded = !settingsExpanded;
          updateSettings();
        });
      }
      refs.quoteCategory.querySelectorAll('[data-quote-category]').forEach((item) => {
        item.addEventListener('click', () => persist({ category: item.dataset.quoteCategory }));
      });
      if (tabResizeObserver) {
        // Re-measure once the collapsed panel lays out, and when translated labels change width.
        tabResizeObserver.observe(refs.quoteCategory);
      }
      if (refs.quoteFontSizeSlider) {
        const slider = refs.quoteFontSizeSlider;
        const input = refs.quoteFontSizeSliderValueInput;
        slider.addEventListener('input', () => previewFontSize(slider.value));
        slider.addEventListener('change', () => commitFontSize(slider.value));
        input.addEventListener('input', () => {
          if (input.value.trim() && Number.isFinite(Number(input.value))) previewFontSize(input.value);
        });
        input.addEventListener('blur', () => commitFontSize(input.value));
        input.addEventListener('keydown', (event) => {
          if (event.key === 'Enter') {
            event.preventDefault();
            input.blur();
          }
        });
      }
      // The body ships hidden and is bound on the panel's first open, so its first sync would
      // otherwise play the collapsible entry animation. Flush that state with transitions off.
      const body = refs.quoteBody;
      body.style.transition = 'none';
      updateSettings();
      body.getBoundingClientRect();
      body.style.transition = '';
    }
    function mount() {
      mounted = true;
      render();
      if (resizeObserver) resizeObserver.observe(element);
      document.addEventListener('visibilitychange', onVisibility);
      const onChanged = config.chromeObj && config.chromeObj.storage && config.chromeObj.storage.onChanged;
      if (onChanged) {
        onChanged.addListener(handleStorageChange);
        unsubscribe = () => onChanged.removeListener(handleStorageChange);
      }
      // Resolves after the saved preference and cached quote are rendered, so the page can
      // reveal with the quote already in its slot instead of shifting the layout afterwards.
      return new Promise((resolve) => {
        if (!area) return resolve();
        area.get([key], (values) => {
          if (!disposed) apply(values && values[key]);
          resolve(cachedQuoteRead);
        });
      });
    }
    return Object.freeze({ element, textElement: line, mount, bindSettings, updateLanguage, getProviderLabel,
      importQuoteFile,
      importMarkdown: importQuoteFile,
      destroy() {
        disposed = true;
        revision += 1;
        window.clearTimeout(dayTimer);
        if (resizeObserver) resizeObserver.disconnect();
        if (tabResizeObserver) tabResizeObserver.disconnect();
        if (unsubscribe) unsubscribe();
        document.removeEventListener('visibilitychange', onVisibility);
        hideOrigin();
        element.remove();
      } });
  }
  return Object.freeze({ createRuntime });
});
