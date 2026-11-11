import { expect } from 'vitest';
import { defineFlows, delay, focusTab, NEWTAB_INPUT_ID } from './flow';

const flow = defineFlows();
flow('does not temporarily combine old and new query rows on backspacing', async ({ browser }) => {
  const page = await browser.openPage(browser.extensionUrl('newtab.html'));
  await focusTab(browser, page);
  await page.waitFor(`Boolean(document.getElementById('${NEWTAB_INPUT_ID}'))`);
  await page.evaluate(`(() => {
    const original = chrome.runtime.sendMessage.bind(chrome.runtime);
    window.__searchRepro = { received: [], changes: [] };
    const local = query => query === '你好' ? [1, 2, 3, 4].map(i => ({ type:'history', title:'你好 本地' + i, url:'https://fixture.example/' + i })) : [];
    const engine = query => query === '你好啊' ? [1, 2, 3].map(i => ({type:'googleSuggest', title:'你好啊建议' + i, url:'https://search.example/' + i})) : [{type:'googleSuggest', title:'你好建议', url:'https://search.example/new'}];
    chrome.runtime.sendMessage = function(message, callback) {
      if (message && message.action === 'getSearchSuggestions') { setTimeout(() => callback({ suggestions: local(message.query) }), 10); return; }
      if (message && message.action === 'getSearchEngineSuggestions') {
        setTimeout(() => { window.__searchRepro.received.push(message.query); callback({ suggestions:[...local(message.query), ...engine(message.query)], hasRemoteSuggestions:true }); }, 350);
        return;
      }
      return original(...arguments);
    };
    const container = document.getElementById('_x_extension_newtab_suggestions_container_2024_unique_');
    new MutationObserver(() => window.__searchRepro.changes.push({ query:document.getElementById('${NEWTAB_INPUT_ID}').value,
      rows:Array.from(container.querySelectorAll('.x-nt-suggestion-item'), n => n.textContent || ''), height:container.offsetHeight }))
      .observe(container, { childList:true, subtree:true, characterData:true });
  })()`);
  await page.evaluate(`document.getElementById('${NEWTAB_INPUT_ID}').focus()`);
  await page.type('你好');
  await page.waitFor(`window.__searchRepro.received.includes('你好')`, { timeout:10000 });
  await page.type('啊');
  await page.waitFor(`window.__searchRepro.received.includes('你好啊')`, { timeout:10000 });
  await delay(150);
  const previousHeight = Number(await page.evaluate(`document.getElementById('_x_extension_newtab_suggestions_container_2024_unique_').offsetHeight`));
  await page.evaluate(`window.__searchRepro.changes = []`);
  await page.press('Backspace');
  await page.waitFor(`window.__searchRepro.received.filter(q => q === '你好').length === 2`, { timeout:10000 });
  await delay(150);
  const history = await page.evaluate(`window.__searchRepro.changes.filter(x => x.query === '你好')`);
  if (!Array.isArray(history) || !history.length) throw new Error('missing updates');
  const states = history.filter((entry): entry is { rows: string[]; height: number } => entry !== null && typeof entry === 'object' && 'rows' in entry && 'height' in entry && Array.isArray(entry.rows) && typeof entry.height === 'number');
  const maxRows = Math.max(...states.map(x => x.rows.length));
  const finalRows = states[states.length - 1].rows.length;
  expect(maxRows, JSON.stringify(states)).toBeLessThanOrEqual(finalRows);
  expect(Math.max(...states.map(state => state.height))).toBeLessThanOrEqual(Math.max(previousHeight, states[states.length - 1].height) + 1);
  expect(states.some(state => state.rows.some(row => row.includes('你好啊建议')))).toBe(false);
});
flow('keeps existing rows bounded while the next query gains local results', async ({ browser }) => {
  const page = await browser.openPage(browser.extensionUrl('newtab.html'));
  await focusTab(browser, page);
  await page.waitFor(`Boolean(document.getElementById('${NEWTAB_INPUT_ID}'))`);
  await page.evaluate(`(() => {
    const original = chrome.runtime.sendMessage.bind(chrome.runtime);
    window.__searchRepro = { received: [], changes: [] };
    const local = query => query === '早餐店' ? [1, 2, 3, 4].map(i => ({ type:'history', title:'早餐店 本地' + i, url:'https://fixture.example/' + i })) : [];
    const engine = query => query === '早餐' ? [1, 2, 3, 4].map(i => ({type:'googleSuggest', title:'早餐店建议' + i, url:'https://search.example/' + i})) : [{type:'googleSuggest', title:'早餐店建议新', url:'https://search.example/new'}];
    chrome.runtime.sendMessage = function(message, callback) {
      if (message && message.action === 'getSearchSuggestions') { setTimeout(() => callback({ suggestions: local(message.query) }), 10); return; }
      if (message && message.action === 'getSearchEngineSuggestions') {
        setTimeout(() => { window.__searchRepro.received.push(message.query); callback({ suggestions:[...local(message.query), ...engine(message.query)], hasRemoteSuggestions:true }); }, 350);
        return;
      }
      return original(...arguments);
    };
    const container = document.getElementById('_x_extension_newtab_suggestions_container_2024_unique_');
    new MutationObserver(() => window.__searchRepro.changes.push({ query:document.getElementById('${NEWTAB_INPUT_ID}').value,
      rows:Array.from(container.querySelectorAll('.x-nt-suggestion-item'), n => n.textContent || '') }))
      .observe(container, { childList:true, subtree:true, characterData:true });
  })()`);
  await page.evaluate(`document.getElementById('${NEWTAB_INPUT_ID}').focus()`);
  await page.type('早餐');
  await page.waitFor(`window.__searchRepro.received.includes('早餐')`, { timeout:10000 });
  await delay(150);
  const previousCount = Number(await page.evaluate(`document.querySelectorAll('.x-nt-suggestion-item').length`));
  await page.evaluate(`window.__searchRepro.changes = []`);
  await page.type('店');
  await page.waitFor(`window.__searchRepro.received.includes('早餐店')`, { timeout:10000 });
  await delay(150);
  const history = await page.evaluate(`window.__searchRepro.changes.filter(x => x.query === '早餐店')`);
  if (!Array.isArray(history) || !history.length) throw new Error('missing updates');
  const states = history.filter((entry): entry is { rows: string[] } => entry !== null && typeof entry === 'object' && 'rows' in entry && Array.isArray(entry.rows));
  const finalCount = states[states.length - 1].rows.length;
  expect(Math.max(...states.map(state => state.rows.length)), JSON.stringify(states)).toBeLessThanOrEqual(Math.max(previousCount, finalCount));
  expect(states.some(state => state.rows.some(row => row.includes('早餐店 本地1')))).toBe(true);
  expect(states[states.length - 1].rows.some(row => row.includes('早餐店建议新'))).toBe(true);
});
