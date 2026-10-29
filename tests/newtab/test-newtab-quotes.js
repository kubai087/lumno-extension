const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { JSDOM } = require('jsdom');

// Stands in for the React line view: each runtime draws through the line made
// last before it. Its markup is covered by src/newtab/react/quote-line.test.tsx.
let currentLine = null;
globalThis.__lumnoTestModuleStubs = Object.assign(globalThis.__lumnoTestModuleStubs || {}, {
  'src/newtab/react/quote-line.tsx': {
    createQuoteLineView: (host, handlers) => currentLine.api.createQuoteLineView(host, handlers)
  }
});
const settings = require('../../src/domain/settings/index.ts');
const quotes = require('../../src/newtab/top-content/quotes.ts');
const quoteSettings = require('../../src/domain/settings/newtab-quote.ts');
const { createMemorySettings } = require('../helpers/memory-settings');
const tick = () => new Promise((resolve) => setImmediate(resolve));

// A line view that keeps the last model it was handed and the handlers the
// runtime gave it; the next runtime draws through it.
function createLineView() {
  const record = { model: null, handlers: null, destroyed: false };
  const api = {
    createQuoteLineView(_host, handlers) {
      record.handlers = handlers;
      return {
        render(model) { record.model = model; },
        getTextElement: () => null,
        destroy() { record.destroyed = true; }
      };
    }
  };
  currentLine = { record, api };
  return currentLine;
}

// Stands in for the appearance panel: keeps the last quote section model.
function createSettingsView() {
  const record = { model: null };
  return { record, view: { renderQuoteSettings(model) { record.model = model; } } };
}

const drag = { dragging: true, final: false };
const settle = { dragging: false, final: true };

async function main() {
  const dom = new JSDOM('<body><div id="search"></div><div id="shortcuts"></div><div id="recent"></div></body>', { url: 'https://lumno.test/' });
  const document = dom.window.document;
  const memory = createMemorySettings({
    sync: { [settings.newtabQuotePrefs.key]: { position: 'off', category: 'literature' } }
  });
  const savedPrefs = () => memory.store.getStored(settings.newtabQuotePrefs);
  let requests = 0;
  let resolveQuote;
  let messages = {};
  const tooltipCalls = [];
  const tooltipController = {
    show(_target, text, options) { tooltipCalls.push(['show', text, options.placement]); },
    hide() { tooltipCalls.push(['hide']); }
  };
  const line = createLineView();
  const runtime = quotes.createRuntime({ documentObj: document, windowObj: dom.window,
    locale: { store: { getSnapshot: () => ({ locale: 'zh_CN' }), subscribe: () => () => {} } },
    t: (key, fallback) => messages[key] ? messages[key].message : fallback,
    getSearchRoot: () => document.querySelector('#search'),
    getShortcutSection: () => document.querySelector('#shortcuts'),
    getTooltipController: () => tooltipController,
    settings: memory.store,
    client: { getQuote: () => { requests += 1; return new Promise((resolve) => { resolveQuote = resolve; }); } }
  });
  const panel = createSettingsView();
  const section = () => panel.record.model.quote;
  const act = () => panel.record.model.actions;
  const bodyOpen = () => section().enabled && section().expanded;
  const choosePosition = (value) => {
    assert(section().positionSelect.options.some((option) => option.value === value));
    section().positionSelect.onChange(value);
  };
  runtime.bindSettings(panel.view);
  await runtime.mount();
  assert.equal(requests, 0, 'Disabled quotes must not contact an external API');
  assert.equal(bodyOpen(), false);
  assert.equal(section().enabled, false);
  assert.equal(section().fontSize.value, 15, 'Older saved preferences should use the default font size');
  act().setEnabled(true);
  assert.equal(savedPrefs().enabled, true);
  await tick();
  resolveQuote({ text: '<img src=x onerror=alert(1)>', source: 'book', author: 'author', url: 'javascript:alert(1)' });
  await tick();
  assert.equal(runtime.element.previousElementSibling.id, 'shortcuts');
  assert.equal(runtime.element.nextElementSibling.id, 'recent');
  assert.equal(runtime.element.hidden, false);
  assert.equal(line.record.model.text, '<img src=x onerror=alert(1)>', 'The quote reaches the view as text');
  assert.equal(line.record.model.href, 'https://hitokoto.cn/', 'Only Hitokoto URLs may be opened from the quote');
  assert(line.record.model.ariaLabel.includes('author'));
  assert.equal(tooltipCalls.length, 0);
  line.record.handlers.onShowOrigin(runtime.element);
  assert.deepEqual(tooltipCalls.pop(), ['show', 'author · 《book》', 'bottom'],
    'Hovering shows the origin in the shared tooltip, away from the search box');
  line.record.handlers.onHideTooltip();
  assert.deepEqual(tooltipCalls.pop(), ['hide']);
  assert.equal(bodyOpen(), true);
  act().setFontSize(20, drag);
  assert.equal(runtime.element.style.getPropertyValue('--x-nt-quote-font-size'), '20px');
  assert.equal(section().fontSize.value, 20);
  assert.equal(savedPrefs().fontSize, 15, 'Dragging should preview before writing preferences');
  act().setFontSize(20, settle);
  assert.equal(savedPrefs().fontSize, 20, 'Completing the drag should save the chosen font size');
  act().setFontSize(30, settle);
  assert.equal(savedPrefs().fontSize, 24, 'A typed value is saved within the supported size range');
  assert.equal(section().fontSize.value, 24);
  assert.equal(requests, 1, 'Adjusting font size should reuse the current daily quote');
  const fontSelect = () => section().fontSelect;
  assert.deepEqual(fontSelect().options.map((option) => option.value), ['wenkai', 'xiaowei', 'sans']);
  assert.equal(fontSelect().value, 'wenkai', 'Older saved preferences keep WenKai');
  assert(runtime.element.style.getPropertyValue('--x-nt-quote-font-family').startsWith('"LXGW WenKai"'));
  fontSelect().onChange('xiaowei');
  assert.equal(savedPrefs().font, 'xiaowei');
  assert.equal(fontSelect().value, 'xiaowei');
  assert(runtime.element.style.getPropertyValue('--x-nt-quote-font-family').startsWith('"Lumno Quote XiaoWei"'));
  fontSelect().onChange('sans');
  assert(runtime.element.style.getPropertyValue('--x-nt-quote-font-family').startsWith('"PingFang SC"'));
  assert.equal(requests, 1, 'Changing the font should reuse the current daily quote');
  assert.deepEqual(section().positionSelect.options.map((option) => option.value), ['top', 'input', 'search', 'bottom'],
    'Positions are listed in on-page order');
  assert.equal(section().positionSelect.value, 'search');
  choosePosition('top');
  assert.equal(runtime.element.nextElementSibling.id, 'search', 'The top placement sits right above the search box');
  assert.equal(document.body.dataset.quotePosition, 'top');
  assert.equal(section().positionSelect.value, 'top');
  assert.equal(settings.newtabQuotePrefs.parse({ position: 'top' }).position, 'top');
  choosePosition('input');
  assert.equal(runtime.element.previousElementSibling.id, 'search', 'The input placement sits right under the search box');
  assert.equal(runtime.element.nextElementSibling.id, 'shortcuts');
  assert.equal(document.body.dataset.quotePosition, 'input');
  assert.equal(settings.newtabQuotePrefs.parse({ position: 'input' }).position, 'input');
  for (const saved of [null, undefined, {}, { position: 'search' }, { position: 'bottom', category: 'poetry' }, { enabled: 'true' }]) {
    assert.equal(settings.newtabQuotePrefs.parse(saved).enabled, false, 'Quotes stay off unless the user enabled them');
  }
  assert.equal(settings.newtabQuotePrefs.parse({ position: 'nope' }).position, 'search');
  choosePosition('bottom');
  assert.equal(document.body.dataset.quotePosition, 'bottom');
  assert.equal(runtime.element.dataset.position, 'bottom');
  assert.equal(requests, 1, 'Changing position should reuse the same daily quote');
  const originalQuote = line.record.model.text;
  for (const locale of ['en', 'ja', 'zh_CN', 'zh_TW']) {
    messages = JSON.parse(fs.readFileSync(path.join(__dirname, '..', '..', '_locales', locale, 'messages.json'), 'utf8'));
    runtime.updateLanguage();
    assert.equal(section().title, messages.newtab_quote_title.message);
    assert.equal(section().infoTooltip, messages.newtab_quote_provider.message);
    assert.equal(section().positionSelect.ariaLabel, messages.newtab_quote_position.message);
    assert.equal(section().category.label, messages.newtab_quote_category.message);
    assert.equal(section().fontSize.label, messages.newtab_quote_font_size.message);
    assert.equal(section().fontSize.ariaLabel, messages.newtab_quote_font_size_label.message);
    for (const option of section().positionSelect.options) {
      assert.equal(option.label, messages[`newtab_quote_${option.value}`].message);
    }
    for (const option of section().category.options) {
      assert.equal(option.label, messages[`newtab_quote_${option.value}`].message);
    }
    assert.equal(line.record.model.text, originalQuote, 'Changing the UI language must keep the original quote');
    assert.equal(section().positionSelect.value, 'bottom');
    assert.equal(requests, 1, 'Changing the UI language must not fetch another quote');
  }
  act().setCategory('poetry');
  await tick();
  act().setEnabled(false);
  resolveQuote({ text: 'late poem', author: '', source: '', url: 'https://hitokoto.cn/' });
  await tick();
  assert.equal(runtime.element.hidden, true, 'An in-flight response must not re-enable a hidden quote');
  assert.equal(bodyOpen(), false);
  assert.equal(section().enabled, false);
  assert.equal(document.body.dataset.quotePosition, 'off');
  assert.deepEqual(savedPrefs(), { enabled: false, position: 'bottom', category: 'poetry', fontSize: 24, provider: 'hitokoto', font: 'sans' },
    'The switch must preserve category, position, font and font size');
  act().setEnabled(true);
  await tick();
  resolveQuote({ text: 'restored poem', author: '', source: '', url: 'https://hitokoto.cn/' });
  await tick();
  assert.equal(runtime.element.hidden, false);
  assert.equal(runtime.element.dataset.position, 'bottom');
  assert.equal(runtime.element.style.getPropertyValue('--x-nt-quote-font-size'), '24px');
  assert.equal(section().category.active, 'poetry');
  runtime.destroy();
  assert.equal(line.record.destroyed, true, 'Destroying the runtime unmounts its line view');

  // The quote exists only for Chinese UI languages; other languages hide it but keep its settings.
  let locale = 'en';
  let localeRequests = 0;
  createLineView();
  const localeRuntime = quotes.createRuntime({ documentObj: document, windowObj: dom.window,
    t: (_key, fallback) => fallback, locale: { store: { getSnapshot: () => ({ locale }), subscribe: () => () => {} } },
    getSearchRoot: () => document.querySelector('#search'),
    getShortcutSection: () => document.querySelector('#shortcuts'),
    settings: createMemorySettings({
      sync: { [settings.newtabQuotePrefs.key]: { enabled: true, position: 'bottom' } }
    }).store,
    client: { getQuote: () => { localeRequests += 1; return Promise.resolve({ text: '海上生明月', author: '', source: '', url: '' }); } }
  });
  const localePanel = createSettingsView();
  localeRuntime.bindSettings(localePanel.view);
  await localeRuntime.mount();
  await tick();
  assert.equal(localeRequests, 0, 'Non-Chinese languages must not contact Hitokoto');
  assert.equal(localeRuntime.element.hidden, true);
  assert.equal(document.body.dataset.quotePosition, 'off');
  assert(localePanel.record.model, 'Custom quote imports are available for every UI language');
  locale = 'zh_TW';
  localeRuntime.updateLanguage();
  await tick();
  await tick();
  assert.equal(localeRequests, 1, 'Switching to Chinese should load the saved quote preference');
  assert.equal(localeRuntime.element.hidden, false);
  assert.equal(document.body.dataset.quotePosition, 'bottom');
  locale = 'ja';
  localeRuntime.updateLanguage();
  assert.equal(localeRuntime.element.hidden, true);
  assert.equal(document.body.dataset.quotePosition, 'off');
  locale = 'zh_CN';
  localeRuntime.updateLanguage();
  await tick();
  assert.equal(localeRuntime.element.hidden, false, 'Simplified Chinese should show the quote');
  localeRuntime.destroy();

  // Mounting waits for the cached quote so the page reveals with it in place, never for the network.
  const cachedMemory = createMemorySettings({
    sync: { [settings.newtabQuotePrefs.key]: { enabled: true, position: 'top' } },
    local: { [quoteSettings.quoteCache.key]: { literature: { quote: { text: '缓存', author: '', source: '', url: '' } } } }
  });
  createLineView();
  const cachedRuntime = quotes.createRuntime({ documentObj: document, windowObj: dom.window,
    locale: { store: { getSnapshot: () => ({ locale: 'zh_CN' }), subscribe: () => () => {} } },
    t: (_key, fallback) => fallback,
    getSearchRoot: () => document.querySelector('#search'),
    settings: cachedMemory.store,
    client: { getQuote: () => new Promise(() => {}) }
  });
  await cachedRuntime.mount();
  assert.equal(cachedRuntime.element.hidden, false, 'The cached quote is painted before mount settles');
  assert.equal(cachedRuntime.element.nextElementSibling.id, 'search');
  const parent = cachedRuntime.element.parentNode;
  const observer = new dom.window.MutationObserver(() => {});
  observer.observe(parent, { childList: true });
  cachedMemory.receive('sync', settings.newtabQuotePrefs.key, { enabled: true, position: 'top', fontSize: 18 });
  assert.equal(cachedRuntime.element.style.getPropertyValue('--x-nt-quote-font-size'), '18px');
  assert.equal(observer.takeRecords().length, 0, 'Re-rendering in place must not re-insert the quote');
  observer.disconnect();
  cachedRuntime.destroy();

  // The shuffle button swaps in another quote without leaving the page.
  const rerollCalls = [];
  let rerollResult = null;
  const toasts = [];
  const shuffleLine = createLineView();
  const shuffleRuntime = quotes.createRuntime({ documentObj: document, windowObj: dom.window,
    locale: { store: { getSnapshot: () => ({ locale: 'zh_CN' }), subscribe: () => () => {} } },
    t: (_key, fallback) => fallback, showToast: (message, isError) => toasts.push([message, isError]),
    getSearchRoot: () => document.querySelector('#search'),
    settings: createMemorySettings({
      sync: { [settings.newtabQuotePrefs.key]: { enabled: true, position: 'input', category: 'poetry' } }
    }).store,
    client: { getQuote: (category, options) => {
      rerollCalls.push([category, Boolean(options && options.reroll)]);
      if (!options || !options.reroll) return Promise.resolve({ text: '今日', author: '', source: '', url: '' });
      return rerollResult;
    } }
  });
  await shuffleRuntime.mount();
  await tick();
  assert.equal(shuffleLine.record.model.shuffleLabel, 'Show another quote');
  assert.equal(shuffleLine.record.model.swapCount, 0);
  rerollResult = Promise.resolve({ text: '换一句', author: '', source: '', url: '' });
  shuffleLine.record.handlers.onShuffle();
  assert.equal(shuffleLine.record.model.shuffling, true);
  shuffleLine.record.handlers.onShuffle();
  await tick();
  assert.deepEqual(rerollCalls, [['poetry', false], ['poetry', true]], 'A shuffle rerolls the current category once');
  assert.equal(shuffleLine.record.model.text, '换一句');
  assert.equal(shuffleLine.record.model.swapCount, 1, 'A shuffled quote fades in');
  assert.equal(shuffleLine.record.model.shuffling, false);
  rerollResult = Promise.reject(new Error('offline'));
  shuffleLine.record.handlers.onShuffle();
  await tick();
  await tick();
  assert.equal(shuffleLine.record.model.text, '换一句', 'A failed shuffle keeps the current quote');
  assert.equal(shuffleLine.record.model.swapCount, 1);
  assert.deepEqual(toasts, [['Could not load another quote', true]]);
  shuffleRuntime.destroy();
  dom.window.close();
  console.log('newtab quote UI tests passed');
}
main().catch((error) => { console.error(error); process.exit(1); });
