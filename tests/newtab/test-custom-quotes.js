const { createMemorySettings } = require('../helpers/memory-settings');
const assert = require('node:assert/strict');
const { JSDOM } = require('jsdom');

// Stands in for the React line view: keeps the last model and handlers.
let line = null;
globalThis.__lumnoTestModuleStubs = Object.assign(globalThis.__lumnoTestModuleStubs || {}, {
  'src/newtab/react/quote-line.tsx': {
    createQuoteLineView(_host, handlers) {
      line = { model: null, handlers };
      return { render(model) { line.model = model; }, getTextElement: () => null, destroy() {} };
    }
  }
});
const custom = require('../../src/domain/custom-quotes.ts');
const settings = require('../../src/domain/settings/index.ts');
require('../../src/newtab/remote-content.ts');
const quotesApi = require('../../src/newtab/top-content/quotes.ts');
const locale = require('../../_locales/en/messages.json');
const { customQuotePick } = require('../../src/domain/settings/newtab-quote.ts');
const tick = () => new Promise(resolve => setImmediate(resolve));

async function main() {
  const parsed = custom.parseMarkdown('# 我的句库\n\n> **千里之行**，始于足下。\n紧邻的第二行。\n- Keep learning.\n- [Be curious](https://example.com/).\n\n```js\nalert(1)\n```');
  assert.equal(parsed.length, 4, 'Adjacent Markdown lines are separate quotes, not one paragraph');
  assert.equal(parsed[0].text, '千里之行，始于足下。'); assert.equal(parsed[0].author, '');
  assert.equal(parsed[1].text, '紧邻的第二行。');
  assert.equal(parsed[3].text, 'Be curious.');
  assert.deepEqual(custom.parseQuotes('\uFEFF  第一行🙂  \r\n第二行\r\n \r\n第三行\r第四行', 'txt').map(q => q.text), ['第一行🙂', '第二行', '第三行', '第四行']);
  assert.deepEqual(custom.parseQuotes('Same\nSame', 'txt').map(q => q.text), ['Same', 'Same'], 'Each non-empty line is retained, including duplicates');
  assert.equal(custom.parseQuotes('a_b *literal* <b>plain text</b>', 'txt')[0].text, 'a_b *literal* <b>plain text</b>', 'TXT punctuation and markup are preserved as plain text');
  assert.equal(custom.parseQuotes('a'.repeat(300) + '\n' + 'b'.repeat(300), 'md').length, 2, 'Length limits apply to each line, not the whole file');
  assert.deepEqual(custom.parseQuotes('````js\n```\nignored\n````\nVisible', 'md').map(q => q.text), ['Visible']);
  assert.throws(() => custom.parseQuotes(' \r\n\t', 'txt'), /empty/);
  assert.throws(() => custom.parseMarkdown('# Empty\n```\ncode\n```'), /empty/);
  assert.throws(() => custom.parseMarkdown('a'.repeat(501)), /limit/);
  assert.throws(() => custom.parseMarkdown('a'.repeat(custom.MAX_BYTES + 1)), /too-large/);
  assert.throws(() => custom.parseMarkdown(Array.from({ length: 1001 }, (_, i) => `- Quote ${i}`).join('\n')), /limit/);
  const library = { version: 1, filename: 'quotes.md', revision: 7, quotes: parsed };
  const today = new Date(2026, 9, 14);
  const selected = custom.select(library, today, null, false);
  assert.deepEqual(custom.select(library, today, null, false), selected);
  const shuffled = custom.select(library, today, selected.pick, true);
  assert.notEqual(shuffled.pick.index, selected.pick.index);
  assert.deepEqual(custom.select(library, today, shuffled.pick, false), shuffled);
  assert.equal(custom.normalizeLibrary({ version: 1, quotes: [] }), null);

  const dom = new JSDOM('<body><div id="search"></div><div id="shortcuts"></div></body>', { url: 'https://test.invalid/' });
  const document = dom.window.document;
  const memory = createMemorySettings({
    sync: { [settings.newtabQuotePrefs.key]: { enabled: true, position: 'search', provider: 'custom' } }
  });
  const local = memory.data.local;
  let networkCalls = 0;
  // Stands in for the appearance panel: keeps the last model.
  let panelModel = null;
  const makeRuntime = () => quotesApi.createRuntime({ documentObj: document, windowObj: dom.window,
    t: (key, fallback) => locale[key]?.message || fallback, getLocale: () => 'en',
    getSearchRoot: () => document.querySelector('#search'), getShortcutSection: () => document.querySelector('#shortcuts'),
    settings: memory.store,
    client: { getQuote() { networkCalls++; return Promise.resolve({ text: 'Remote', author: '', source: '', url: 'https://hitokoto.cn/' }); } }
  });
  const runtime = makeRuntime(); await runtime.mount(); await tick();
  runtime.bindSettings({ renderQuoteSettings(model) { panelModel = model; } });
  const status = () => panelModel.quote.library.status;
  assert.equal(networkCalls, 0); assert.equal(runtime.element.hidden, true);
  const file = { name: 'my.md', size: 200, text: async () => 'First local quote.\nSecond local quote.' };
  assert.equal(await runtime.importQuoteFile(file), true); await tick();
  assert.equal(local[custom.KEY].quotes.length, 2);
  assert.equal(runtime.element.hidden, false, 'Custom text is available for English UI too');
  assert.ok(line.model.text.includes('local quote'));
  assert.equal(line.model.href, null, 'Custom quotes never link to Hitokoto');
  assert.equal(networkCalls, 0);
  assert.equal(await runtime.importQuoteFile({ ...file, name: 'LINES.TXT', text: async () => '\uFEFF第一句\r\n第二句\r\n\r\n第三句' }), true);
  assert.deepEqual(local[custom.KEY].quotes.map(q => q.text), ['第一句', '第二句', '第三句']);
  assert.equal(local[custom.KEY].filename, 'LINES.TXT');
  const before = JSON.stringify(local[custom.KEY]);
  assert.equal(await runtime.importMarkdown({ ...file, text: async () => '# Empty' }), false);
  assert.equal(JSON.stringify(local[custom.KEY]), before);
  assert.equal(await runtime.importQuoteFile({ ...file, name: 'wrong.pdf' }), false);
  assert.match(status().text, /format or size limits/);
  memory.state.failWrites = true; assert.equal(await runtime.importMarkdown(file), false); memory.state.failWrites = false;
  assert.equal(JSON.stringify(local[custom.KEY]), before, 'Failed save preserves the previous collection');
  assert.match(status().text, /save on this device.*previous collection is kept/);
  assert.doesNotMatch(status().text, /format or size limits/);
  assert.equal(status().error, true);
  line.handlers.onShuffle(); await tick();
  const afterShuffle = line.model.text;
  assert.ok(local[customQuotePick.key]);
  runtime.destroy();
  const restored = makeRuntime(); await restored.mount(); await tick();
  assert.equal(line.model.text, afterShuffle, 'Shuffle selection survives refresh');
  assert.equal(networkCalls, 0); restored.destroy(); dom.window.close();
  // A reroll is random but never repeats the quote on screen.
  const pool = { version: 1, filename: 'pool.txt', revision: 7, quotes: ['a', 'b', 'c', 'd'].map((text) => ({ text, author: '' })) };
  const day = new Date(2026, 9, 18);
  const first = custom.select(pool, day, null, false);
  [0, 0.4, 0.999].forEach((draw) => {
    const next = custom.select(pool, day, first.pick, true, () => draw);
    assert.notEqual(next.pick.index, first.pick.index, 'Shuffle never shows the same quote again');
  });
  assert.notEqual(custom.select(pool, day, first.pick, true, () => 0).pick.index,
    custom.select(pool, day, first.pick, true, () => 0.999).pick.index, 'Shuffle draws from the rest of the collection');
  assert.equal(custom.select(pool, day, null, false).pick.index, first.pick.index, 'The daily quote is stable through the day');
  console.log('Custom TXT / MD quotes: one line per quote, CRLF/BOM, blank lines, limits, safe plain text, import failure, local storage, daily selection, shuffle persistence and no remote requests passed.');
}
main().catch(error => { console.error(error); process.exit(1); });
