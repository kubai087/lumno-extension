import { describe, expect } from 'vitest';
import { isRecord } from './driver/cdp';
import { defineFlows } from './flow';

const flow = defineFlows();

describe('modules the worker registers and loads', () => {
  // The worker registers the picture-in-picture page bridge in the page's
  // main world on the automatic picture-in-picture sites, and the bridge
  // answers the isolated-world script's request there. The flow points the
  // registration at the fixture page, since the real sites need the network.
  flow('registers the picture-in-picture page bridge in the main world, where it answers', async ({ browser, fixtures }) => {
    const registered = await browser.worker.waitFor(`chrome.scripting.getRegisteredContentScripts({ ids: ['lumno-pip-page-bridge'] })
      .then(([script]) => script || null)`, { message: 'the page bridge was not registered' });
    const script = isRecord(registered) ? registered : {};
    const matches = Array.isArray(script.matches) ? script.matches : [];
    expect(script.world).toBe('MAIN');
    expect(script.runAt).toBe('document_start');
    expect(script.js).toEqual(['build/pip-page-bridge.js']);
    expect(matches).toContain('*://*.youtube.com/*');
    expect(matches).not.toContain('<all_urls>');

    const fixtureMatch = fixtures.url('/*').replace(/:\d+\//, '/');
    await browser.worker.evaluate(`chrome.scripting.updateContentScripts([
      { id: 'lumno-pip-page-bridge', matches: [${JSON.stringify(fixtureMatch)}] }
    ])`);
    const page = await browser.openPage(fixtures.url('/fixture.html'));
    // CDP evaluates in the page's main world, the same world as the bridge.
    const response = await page.evaluate(`new Promise((resolve) => {
      window.addEventListener('__lumno_yt_force_exit_pip_res_2026__', (event) => resolve(event.detail), { once: true });
      window.dispatchEvent(new CustomEvent('__lumno_yt_force_exit_pip_req_2026__', { detail: { requestId: 42 } }));
      setTimeout(() => resolve(null), 2000);
    })`);
    expect(response, 'the bridge should answer in the page world').toEqual({ requestId: 42, attempted: false, before: false, after: false, error: '' });
  });

  // Code loaded on first use leaves no global behind: pages import the
  // traditional-to-simplified table and pinyin-pro by URL as ES modules, and
  // the worker, which imports pinyin-pro while installing, reads it from its
  // lazy module registry.
  flow('loads the Han variant table and pinyin-pro on first use without leaving globals', async ({ browser }) => {
    const newtab = await browser.openPage(browser.extensionUrl('newtab.html'));
    const page = await newtab.evaluate(`Promise.all([
      import(chrome.runtime.getURL('build/han-variants.js')),
      import(chrome.runtime.getURL('build/pinyin.js'))
    ]).then(([han, pinyin]) => ({
      pairs: han.HAN_VARIANT_PAIRS.length,
      readings: pinyin.pinyin('重', { toneType: 'none', type: 'array', multiple: true, v: true }),
      globals: ['LumnoSearchHanVariants', 'pinyinPro'].filter((name) => name in globalThis)
    }))`);
    const loaded = isRecord(page) ? page : {};
    expect(loaded.pairs).toBe(2903 * 2);
    expect(loaded.readings, 'pinyin-pro should read 重 both ways').toEqual(expect.arrayContaining(['zhong', 'chong']));
    expect(loaded.globals).toEqual([]);

    const worker = await browser.worker.evaluate(`({
      pinyin: typeof (globalThis.__lumnoWorkerLazy && globalThis.__lumnoWorkerLazy.pinyin
        && globalThis.__lumnoWorkerLazy.pinyin.pinyin),
      vendorGlobal: 'pinyinPro' in globalThis
    })`);
    expect(worker).toEqual({ pinyin: 'function', vendorGlobal: false });
  });
});
