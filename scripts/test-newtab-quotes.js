const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { JSDOM } = require('jsdom');
const settings = require('../src/shared/settings.js');
require('../src/newtab/remote-content.js');
const quotes = require('../src/newtab/quotes.js');
const tick = () => new Promise((resolve) => setImmediate(resolve));

async function main() {
  const dom = new JSDOM('<body><div id="search"></div><div id="shortcuts"></div><div id="recent"></div></body>', { url: 'https://lumno.test/' });
  const document = dom.window.document;
  let prefs = { position: 'off', category: 'literature' };
  let requests = 0;
  let resolveQuote;
  let messages = {};
  const tooltipCalls = [];
  const tooltipController = {
    show(_target, text, options) { tooltipCalls.push(['show', text, options.placement]); },
    hide() { tooltipCalls.push(['hide']); }
  };
  const runtime = quotes.createRuntime({ documentObj: document, windowObj: dom.window,
    t: (key, fallback) => messages[key] ? messages[key].message : fallback,
    getSearchRoot: () => document.querySelector('#search'),
    getShortcutSection: () => document.querySelector('#shortcuts'),
    getTooltipController: () => tooltipController,
    storageArea: {
      get(_keys, callback) { callback({ [settings.NEWTAB_QUOTE_PREFS_STORAGE_KEY]: prefs }); },
      set(value, callback) { prefs = value[settings.NEWTAB_QUOTE_PREFS_STORAGE_KEY]; callback(); }
    },
    client: { getQuote: () => { requests += 1; return new Promise((resolve) => { resolveQuote = resolve; }); } }
  });
  const createGroup = (data, values) => {
    const group = document.createElement('div');
    values.forEach((value) => { const button = document.createElement('button'); button.dataset[data] = value; group.appendChild(button); });
    return group;
  };
  // Stands in for the panel view, which renders the position dropdown.
  let positionSelect = null;
  const view = { renderQuotePositionSelect(model) { positionSelect = model; } };
  const choosePosition = (value) => {
    assert(positionSelect.options.some((option) => option.value === value));
    positionSelect.onChange(value);
  };
  const refs = { quoteTitle: document.createElement('span'), quoteBody: document.createElement('div'),
    quoteEnabledToggle: document.createElement('input'), quoteInfoButton: document.createElement('button'),
    quoteCategory: createGroup('quoteCategory', ['literature', 'poetry']),
    quoteFontSizeRow: document.createElement('div'), quoteFontSizeTitle: document.createElement('span'),
    quoteFontSizeSlider: document.createElement('input'), quoteFontSizeSliderValueInput: document.createElement('input') };
  refs.quoteFontSizeSlider.type = 'range';
  refs.quoteFontSizeSliderValueInput.type = 'number';
  refs.quoteEnabledToggle.type = 'checkbox';
  refs.quoteFontSizeRow.append(refs.quoteFontSizeTitle, refs.quoteFontSizeSlider, refs.quoteFontSizeSliderValueInput);
  refs.quoteBody.append(refs.quoteCategory, refs.quoteFontSizeRow);
  document.body.append(refs.quoteEnabledToggle, refs.quoteBody, refs.quoteInfoButton);
  runtime.bindSettings(refs, view);
  await runtime.mount();
  assert.equal(requests, 0, 'Disabled quotes must not contact an external API');
  assert.equal(refs.quoteBody.hidden, true);
  assert.equal(refs.quoteEnabledToggle.checked, false);
  assert.equal(refs.quoteFontSizeSlider.value, '15', 'Older saved preferences should use the default font size');
  refs.quoteEnabledToggle.click();
  assert.equal(prefs.enabled, true);
  await tick();
  resolveQuote({ text: '<img src=x onerror=alert(1)>', source: 'book', author: 'author', url: 'javascript:alert(1)' });
  await tick();
  assert.equal(runtime.element.previousElementSibling.id, 'shortcuts');
  assert.equal(runtime.element.nextElementSibling.id, 'recent');
  assert.equal(runtime.element.hidden, false);
  assert.equal(runtime.element.querySelector('img'), null, 'Quotes must be rendered as text');
  const quoteButton = runtime.element.querySelector('a.x-nt-quote-text');
  assert.equal(quoteButton.href, 'https://hitokoto.cn/', 'Only Hitokoto URLs may be opened from the quote');
  assert.equal(quoteButton.target, '_blank');
  assert.equal(runtime.element.querySelectorAll('a').length, 1, 'The quote itself is the only link');
  assert(quoteButton.getAttribute('aria-label').includes('author'));
  assert.equal(tooltipCalls.length, 0);
  quoteButton.dispatchEvent(new dom.window.MouseEvent('mouseenter'));
  assert.deepEqual(tooltipCalls.pop(), ['show', 'author · 《book》', 'bottom'],
    'Hovering shows the origin in the shared tooltip, away from the search box');
  quoteButton.dispatchEvent(new dom.window.MouseEvent('mouseleave'));
  assert.deepEqual(tooltipCalls.pop(), ['hide']);
  assert.equal(refs.quoteBody.hidden, false);
  refs.quoteFontSizeSlider.value = '20';
  refs.quoteFontSizeSlider.dispatchEvent(new dom.window.Event('input'));
  assert.equal(runtime.element.style.getPropertyValue('--x-nt-quote-font-size'), '20px');
  assert.equal(refs.quoteFontSizeSliderValueInput.value, '20');
  assert.equal(prefs.fontSize, 15, 'Dragging should preview before writing preferences');
  refs.quoteFontSizeSlider.dispatchEvent(new dom.window.Event('change'));
  assert.equal(prefs.fontSize, 20, 'Completing the drag should save the chosen font size');
  const sizeInput = refs.quoteFontSizeSliderValueInput;
  sizeInput.focus();
  sizeInput.value = '30';
  sizeInput.dispatchEvent(new dom.window.Event('input'));
  assert.equal(sizeInput.value, '30', 'Typing must not overwrite the focused input');
  assert.equal(runtime.element.style.getPropertyValue('--x-nt-quote-font-size'), '24px');
  sizeInput.dispatchEvent(new dom.window.KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
  assert.equal(prefs.fontSize, 24, 'Enter should save a value within the supported size range');
  assert.equal(sizeInput.value, '24');
  sizeInput.focus();
  sizeInput.value = '';
  sizeInput.blur();
  assert.equal(prefs.fontSize, 24, 'An empty input must retain the saved font size');
  assert.equal(sizeInput.value, '24');
  assert.equal(requests, 1, 'Adjusting font size should reuse the current daily quote');
  assert.deepEqual(positionSelect.options.map((option) => option.value), ['top', 'input', 'search', 'bottom'],
    'Positions are listed in on-page order');
  assert.equal(positionSelect.value, 'search');
  choosePosition('top');
  assert.equal(runtime.element.nextElementSibling.id, 'search', 'The top placement sits right above the search box');
  assert.equal(document.body.dataset.quotePosition, 'top');
  assert.equal(positionSelect.value, 'top');
  assert.equal(settings.normalizeNewtabQuotePrefs({ position: 'top' }).position, 'top');
  choosePosition('input');
  assert.equal(runtime.element.previousElementSibling.id, 'search', 'The input placement sits right under the search box');
  assert.equal(runtime.element.nextElementSibling.id, 'shortcuts');
  assert.equal(document.body.dataset.quotePosition, 'input');
  assert.equal(settings.normalizeNewtabQuotePrefs({ position: 'input' }).position, 'input');
  for (const saved of [null, undefined, {}, { position: 'search' }, { position: 'bottom', category: 'poetry' }, { enabled: 'true' }]) {
    assert.equal(settings.normalizeNewtabQuotePrefs(saved).enabled, false, 'Quotes stay off unless the user enabled them');
  }
  assert.equal(settings.normalizeNewtabQuotePrefs({ position: 'nope' }).position, 'search');
  choosePosition('bottom');
  assert.equal(document.body.dataset.quotePosition, 'bottom');
  assert.equal(runtime.element.dataset.position, 'bottom');
  assert.equal(requests, 1, 'Changing position should reuse the same daily quote');
  const originalQuote = quoteButton.textContent;
  for (const locale of ['en', 'ja', 'zh_CN', 'zh_TW']) {
    messages = JSON.parse(fs.readFileSync(path.join(__dirname, '..', '_locales', locale, 'messages.json'), 'utf8'));
    runtime.updateLanguage();
    assert.equal(refs.quoteTitle.textContent, messages.newtab_quote_title.message);
    assert.equal(refs.quoteEnabledToggle.getAttribute('aria-label'), messages.newtab_quote_title.message);
    assert.equal(refs.quoteInfoButton.getAttribute('aria-label'), messages.newtab_quote_provider.message);
    assert.equal(positionSelect.ariaLabel, messages.newtab_quote_position.message);
    assert.equal(refs.quoteCategory.getAttribute('aria-label'), messages.newtab_quote_category.message);
    assert.equal(refs.quoteFontSizeTitle.textContent, messages.newtab_quote_font_size.message);
    assert.equal(refs.quoteFontSizeSlider.getAttribute('aria-label'), messages.newtab_quote_font_size_label.message);
    assert.equal(sizeInput.getAttribute('aria-label'), messages.newtab_quote_font_size_label.message);
    for (const option of positionSelect.options) {
      assert.equal(option.label, messages[`newtab_quote_${option.value}`].message);
    }
    for (const category of ['literature', 'poetry']) {
      assert.equal(refs.quoteCategory.querySelector(`[data-quote-category="${category}"]`).textContent,
        messages[`newtab_quote_${category}`].message);
    }
    assert.equal(quoteButton.textContent, originalQuote, 'Changing the UI language must keep the original quote');
    assert.equal(positionSelect.value, 'bottom');
    assert.equal(requests, 1, 'Changing the UI language must not fetch another quote');
  }
  refs.quoteCategory.querySelector('[data-quote-category="poetry"]').click();
  await tick();
  refs.quoteEnabledToggle.click();
  resolveQuote({ text: 'late poem', author: '', source: '', url: 'https://hitokoto.cn/' });
  await tick();
  assert.equal(runtime.element.hidden, true, 'An in-flight response must not re-enable a hidden quote');
  assert.equal(refs.quoteBody.hidden, true);
  assert.equal(refs.quoteEnabledToggle.checked, false);
  assert.equal(document.body.dataset.quotePosition, 'off');
  assert.deepEqual(prefs, { enabled: false, position: 'bottom', category: 'poetry', fontSize: 24, provider: 'hitokoto' },
    'The switch must preserve category, position and font size');
  refs.quoteEnabledToggle.click();
  await tick();
  resolveQuote({ text: 'restored poem', author: '', source: '', url: 'https://hitokoto.cn/' });
  await tick();
  assert.equal(runtime.element.hidden, false);
  assert.equal(runtime.element.dataset.position, 'bottom');
  assert.equal(runtime.element.style.getPropertyValue('--x-nt-quote-font-size'), '24px');
  assert.equal(refs.quoteCategory.querySelector('[data-quote-category="poetry"]').getAttribute('aria-pressed'), 'true');
  runtime.destroy();

  // The quote exists only for Chinese UI languages; other languages hide it and its settings.
  let locale = 'en';
  let localeRequests = 0;
  const localeRuntime = quotes.createRuntime({ documentObj: document, windowObj: dom.window,
    t: (_key, fallback) => fallback, getLocale: () => locale,
    getSearchRoot: () => document.querySelector('#search'),
    getShortcutSection: () => document.querySelector('#shortcuts'),
    storageArea: {
      get(_keys, callback) { callback({ [settings.NEWTAB_QUOTE_PREFS_STORAGE_KEY]: { enabled: true, position: 'bottom' } }); },
      set(_value, callback) { callback(); }
    },
    client: { getQuote: () => { localeRequests += 1; return Promise.resolve({ text: '海上生明月', author: '', source: '', url: '' }); } }
  });
  const localeRefs = { ...refs, quoteSection: document.createElement('div'), quoteDivider: document.createElement('div') };
  localeRuntime.bindSettings(localeRefs);
  await localeRuntime.mount();
  await tick();
  assert.equal(localeRequests, 0, 'Non-Chinese languages must not contact Hitokoto');
  assert.equal(localeRuntime.element.hidden, true);
  assert.equal(document.body.dataset.quotePosition, 'off');
  assert.equal(localeRefs.quoteSection.hidden, false, 'Custom quote imports are available for every UI language');
  assert.equal(localeRefs.quoteDivider.hidden, false);
  locale = 'zh_TW';
  localeRuntime.updateLanguage();
  await tick();
  await tick();
  assert.equal(localeRequests, 1, 'Switching to Chinese should load the saved quote preference');
  assert.equal(localeRuntime.element.hidden, false);
  assert.equal(document.body.dataset.quotePosition, 'bottom');
  assert.equal(localeRefs.quoteSection.hidden, false);
  assert.equal(localeRefs.quoteDivider.hidden, false);
  locale = 'ja';
  localeRuntime.updateLanguage();
  assert.equal(localeRuntime.element.hidden, true);
  assert.equal(document.body.dataset.quotePosition, 'off');
  assert.equal(localeRefs.quoteSection.hidden, false);
  locale = 'zh_CN';
  localeRuntime.updateLanguage();
  await tick();
  assert.equal(localeRuntime.element.hidden, false, 'Simplified Chinese should show the quote');
  localeRuntime.destroy();

  // Mounting waits for the cached quote so the page reveals with it in place, never for the network.
  const remote = globalThis.LumnoNewtabRemoteContent;
  let cacheCallback = null;
  let storageListener = null;
  const cachedRuntime = quotes.createRuntime({ documentObj: document, windowObj: dom.window,
    t: (_key, fallback) => fallback,
    chromeObj: { storage: { onChanged: { addListener(fn) { storageListener = fn; }, removeListener() {} } } },
    getSearchRoot: () => document.querySelector('#search'),
    storageArea: {
      get(_keys, callback) { callback({ [settings.NEWTAB_QUOTE_PREFS_STORAGE_KEY]: { enabled: true, position: 'top' } }); },
      set(_value, callback) { callback(); }
    },
    localStorageArea: { get(_keys, callback) { cacheCallback = callback; } },
    client: { getQuote: () => new Promise(() => {}) }
  });
  let mounted = false;
  const mountTask = cachedRuntime.mount().then(() => { mounted = true; });
  await tick();
  assert.equal(mounted, false, 'Mount must wait for the cached quote read');
  cacheCallback({ [remote.QUOTE_CACHE_KEY]: { literature: { quote: { text: '缓存', author: '', source: '', url: '' } } } });
  await mountTask;
  assert.equal(cachedRuntime.element.hidden, false, 'The cached quote is painted before mount settles');
  assert.equal(cachedRuntime.element.nextElementSibling.id, 'search');
  const parent = cachedRuntime.element.parentNode;
  const observer = new dom.window.MutationObserver(() => {});
  observer.observe(parent, { childList: true });
  storageListener({ [settings.NEWTAB_QUOTE_PREFS_STORAGE_KEY]: {
    newValue: { enabled: true, position: 'top', fontSize: 18 } } }, 'sync');
  assert.equal(cachedRuntime.element.style.getPropertyValue('--x-nt-quote-font-size'), '18px');
  assert.equal(observer.takeRecords().length, 0, 'Re-rendering in place must not re-insert the quote');
  observer.disconnect();
  cachedRuntime.destroy();

  // Hovering reveals a shuffle button that swaps in another quote without leaving the page.
  const rerollCalls = [];
  let rerollResult = null;
  const toasts = [];
  const shuffleRuntime = quotes.createRuntime({ documentObj: document, windowObj: dom.window,
    t: (_key, fallback) => fallback, showToast: (message, isError) => toasts.push([message, isError]),
    getSearchRoot: () => document.querySelector('#search'),
    storageArea: {
      get(_keys, callback) { callback({ [settings.NEWTAB_QUOTE_PREFS_STORAGE_KEY]: { enabled: true, position: 'input', category: 'poetry' } }); },
      set(_value, callback) { callback(); }
    },
    client: { getQuote: (category, options) => {
      rerollCalls.push([category, Boolean(options && options.reroll)]);
      if (!options || !options.reroll) return Promise.resolve({ text: '今日', author: '', source: '', url: '' });
      return rerollResult;
    } }
  });
  await shuffleRuntime.mount();
  await tick();
  const shuffleButton = shuffleRuntime.element.querySelector('button.x-nt-quote-shuffle');
  assert(shuffleButton, 'The quote row carries a shuffle button');
  assert.equal(shuffleButton.closest('a'), null, 'The shuffle button must not sit inside the quote link');
  assert.equal(shuffleButton.getAttribute('aria-label'), 'Show another quote');
  rerollResult = Promise.resolve({ text: '换一句', author: '', source: '', url: '' });
  shuffleButton.click();
  assert.equal(shuffleButton.dataset.loading, 'true');
  shuffleButton.click();
  await tick();
  assert.deepEqual(rerollCalls, [['poetry', false], ['poetry', true]], 'A shuffle rerolls the current category once');
  assert.equal(shuffleRuntime.textElement.textContent, '换一句');
  assert.equal(shuffleRuntime.textElement.querySelector('.x-nt-quote-tail'), null);
  assert.equal(shuffleRuntime.textElement.dataset.swap, 'true', 'A shuffled quote fades in');
  assert.equal(shuffleButton.dataset.loading, undefined);
  rerollResult = Promise.resolve({ text: '海棠未雨，梨花先雪，一半春休。」', author: '', source: '', url: '' });
  shuffleButton.click();
  await tick();
  assert.equal(shuffleRuntime.textElement.textContent, '海棠未雨，梨花先雪，一半春休。」');
  assert.equal(shuffleRuntime.textElement.querySelector('.x-nt-quote-tail').textContent, '。」',
    'Trailing full-width punctuation is set apart so it can render half-width');
  rerollResult = Promise.reject(new Error('offline'));
  shuffleButton.click();
  await tick();
  await tick();
  assert.equal(shuffleRuntime.textElement.textContent, '海棠未雨，梨花先雪，一半春休。」', 'A failed shuffle keeps the current quote');
  assert.deepEqual(toasts, [['Could not load another quote', true]]);
  shuffleRuntime.destroy();
  dom.window.close();
  console.log('newtab quote UI tests passed');
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
