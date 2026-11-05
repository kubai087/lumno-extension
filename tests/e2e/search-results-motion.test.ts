import { expect } from 'vitest';
import { writeFileSync } from 'node:fs';
import { stringAt } from './driver/cdp';
import { motionEffectsEnabled } from '../../src/domain/settings/appearance';
import { defineFlows, delay, focusTab, NEWTAB_INPUT_ID } from './flow';

const flow = defineFlows();
const surface = '_x_extension_newtab_suggestions_surface_2026_unique_';
const outline = '_x_extension_newtab_suggestions_outline_2026_unique_';
const list = '_x_extension_newtab_suggestions_container_2024_unique_';

flow('opens the search result layers together without replaying during typing', async ({ browser }) => {
  await browser.worker.waitFor(`typeof chrome !== 'undefined' && Boolean(chrome.storage)`);
  await browser.worker.evaluate(`chrome.storage.sync.set(${JSON.stringify({ [motionEffectsEnabled.key]: true })})`);
  const page = await browser.openPage(browser.extensionUrl('newtab.html'));
  await focusTab(browser, page);
  await page.waitFor(`Boolean(document.getElementById('${NEWTAB_INPUT_ID}'))`);
  await page.evaluate(`document.getElementById('${NEWTAB_INPUT_ID}').focus()`);
  await page.type('l');
  await page.waitFor(`document.getElementById('${surface}').getAnimations().length > 0`, { timeout: 10000, interval: 10 });
  const opening = await page.evaluate(`(() => {
    const parts = ['${surface}', '${outline}', '${list}'].map(id => document.getElementById(id));
    const animations = parts.map(element => element.getAnimations()[0]);
    if (animations.some(animation => !animation)) return null;
    animations.forEach(animation => { animation.pause(); animation.currentTime = 80; });
    window.__searchMotion = animations;
    const heights = parts.slice(0, 2).map(element => element.getBoundingClientRect().height);
    return { heights, contentOpacity: Number(getComputedStyle(parts[2]).opacity) };
  })()`);
  if (process.env.LUMNO_SEARCH_MOTION_PREVIEW) {
    const shot = await browser.cdp.send('Page.captureScreenshot', { format: 'png' }, page.sessionId);
    writeFileSync(process.env.LUMNO_SEARCH_MOTION_PREVIEW, Buffer.from(stringAt(shot, 'data'), 'base64'));
  }
  expect(opening).toMatchObject({ heights: [expect.any(Number), expect.any(Number)], contentOpacity: expect.any(Number) });
  if (!opening || typeof opening !== 'object' || !('heights' in opening) || !Array.isArray(opening.heights)) throw new Error('missing motion');
  expect(Math.abs(Number(opening.heights[0]) - Number(opening.heights[1]))).toBeLessThan(1);
  expect(await page.evaluate(`document.getElementById('${NEWTAB_INPUT_ID}') === document.activeElement`)).toBe(true);
  await page.type('umno');
  await page.waitFor(`document.getElementById('${NEWTAB_INPUT_ID}').value === 'lumno'`);
  expect(await page.evaluate(`window.__searchMotion.every((animation, index) => ['${surface}', '${outline}', '${list}'].map(id => document.getElementById(id))[index].getAnimations().includes(animation))`)).toBe(true);
  await page.evaluate(`window.__searchMotion.forEach(animation => animation.play())`);
  await page.waitFor(`document.getElementById('${list}').dataset.visible === 'true' && getComputedStyle(document.getElementById('${list}')).opacity === '1'`);
  await page.waitFor(`document.getElementById('${surface}').getAnimations().length === 0`);
  const aligned = await page.evaluate(`(() => {
    const plate = document.getElementById('${surface}').getBoundingClientRect();
    const rows = document.getElementById('${list}').getBoundingClientRect();
    return Math.abs(plate.bottom - rows.bottom);
  })()`);
  expect(Number(aligned)).toBeLessThanOrEqual(1);
  await page.evaluate(`(() => {
    const list = document.getElementById('${list}');
    const added = document.createElement('div');
    added.style.height = '80px';
    added.dataset.testResize = 'true';
    list.append(added);
    window.dispatchEvent(new Event('resize'));
  })()`);
  await page.waitFor(`document.getElementById('${surface}').getAnimations().length > 0`, { timeout: 4000, interval: 10 });
  expect(await page.evaluate(`getComputedStyle(document.getElementById('${list}')).opacity`)).toBe('1');
  expect(await page.evaluate(`document.getElementById('${surface}').getAnimations()[0].effect.getKeyframes().length`)).toBe(2);
  await page.evaluate(`document.querySelector('[data-test-resize]').remove()`);
  await page.click(35, 35);
  await page.waitFor(`document.getElementById('${list}').dataset.visible === 'false'`);
  const closingHeight = await page.evaluate(`(() => {
    const parts = ['${surface}', '${outline}', '${list}'].map(id => document.getElementById(id));
    const animations = parts.map(element => element.getAnimations()[0]);
    if (animations.some(animation => !animation)) return null;
    animations.forEach(animation => { animation.pause(); animation.currentTime = 70; });
    return parts[0].getBoundingClientRect().height;
  })()`);
  expect(typeof closingHeight).toBe('number');
  expect(await page.evaluate(`getComputedStyle(document.getElementById('${list}')).pointerEvents`)).toBe('none');
  await page.evaluate(`document.getElementById('${NEWTAB_INPUT_ID}').focus()`);
  await page.type('x');
  await page.waitFor(`document.getElementById('${list}').dataset.visible === 'true' && document.getElementById('${surface}').getAnimations().length > 0`, { interval: 10 });
  const resumedHeight = await page.evaluate(`parseFloat(document.getElementById('${surface}').getAnimations()[0].effect.getKeyframes()[0].height)`);
  expect(Math.abs(Number(resumedHeight) - Number(closingHeight))).toBeLessThan(2);
  await page.click(35, 35);
  await page.waitFor(`document.getElementById('${list}').dataset.visible === 'false'`);
  await browser.cdp.send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] }, page.sessionId);
  await page.evaluate(`document.getElementById('${NEWTAB_INPUT_ID}').focus()`);
  await page.type('a');
  await page.waitFor(`document.getElementById('${list}').dataset.visible === 'true'`);
  expect(await page.evaluate(`['${surface}', '${outline}', '${list}'].map(id => document.getElementById(id).getAnimations().length)`)).toEqual([0, 0, 0]);
  await page.click(35, 35);
  await page.waitFor(`document.getElementById('${list}').dataset.visible === 'false'`);
  await browser.cdp.send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'no-preference' }] }, page.sessionId);
  await browser.worker.evaluate(`chrome.storage.sync.set(${JSON.stringify({ [motionEffectsEnabled.key]: false })})`);
  await page.waitFor(`document.documentElement.dataset.lumnoMotionEffects === 'off'`);
  await page.evaluate(`document.getElementById('${NEWTAB_INPUT_ID}').focus()`);
  await page.type('b');
  await page.waitFor(`document.getElementById('${list}').dataset.visible === 'true'`);
  expect(await page.evaluate(`['${surface}', '${outline}', '${list}'].map(id => document.getElementById(id).getAnimations().length)`)).toEqual([0, 0, 0]);
});

flow('finishes an active reveal when reduced motion is enabled', async ({ browser }) => {
  await browser.worker.waitFor(`typeof chrome !== 'undefined' && Boolean(chrome.storage)`);
  const page = await browser.openPage(browser.extensionUrl('newtab.html'));
  await focusTab(browser, page);
  await page.waitFor(`Boolean(document.getElementById('${NEWTAB_INPUT_ID}'))`);
  await page.evaluate(`document.getElementById('${NEWTAB_INPUT_ID}').focus()`);
  await page.type('motion');
  await page.waitFor(`document.getElementById('${surface}').getAnimations().length > 0`, { timeout: 10000, interval: 10 });
  await page.evaluate(`['${surface}', '${outline}', '${list}'].forEach(id => document.getElementById(id).getAnimations().forEach(a => a.pause()))`);
  await browser.cdp.send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] }, page.sessionId);
  await page.waitFor(`['${surface}', '${outline}', '${list}'].every(id => document.getElementById(id).getAnimations().length === 0)`);
  expect(await page.evaluate(`getComputedStyle(document.getElementById('${list}')).opacity`)).toBe('1');
});
flow('keeps the revealed content edge continuous during consecutive height increases', async ({ browser }) => {
  const page = await browser.openPage(browser.extensionUrl('newtab.html'));
  await focusTab(browser, page);
  await page.waitFor(`Boolean(document.getElementById('${NEWTAB_INPUT_ID}'))`);
  await page.evaluate(`document.getElementById('${NEWTAB_INPUT_ID}').focus()`);
  await page.type('qwzx987');
  await delay(1600);
  await page.waitFor(`document.getElementById('${list}').dataset.visible === 'true'`);
  await page.waitFor(`document.getElementById('${surface}').getAnimations().length === 0`);
  await page.evaluate(`(() => {
    const list = document.getElementById('${list}');
    const added = document.createElement('div'); added.id = 'motion-resize-probe'; added.style.height = '80px';
    list.append(added); window.dispatchEvent(new Event('resize'));
  })()`);
  await page.waitFor(`document.getElementById('${list}').getAnimations().length > 0`, { timeout: 4000, interval: 10 });
  const previous = await page.evaluate(`(() => {
    const panel = document.getElementById('${surface}'); const content = document.getElementById('${list}');
    [panel, document.getElementById('${outline}'), content].forEach(el => el.getAnimations().forEach(a => { a.pause(); a.currentTime = 65; }));
    const rect = content.getBoundingClientRect(); const clip = getComputedStyle(content).clipPath;
    const match = clip.match(/([0-9.]+)(px|%)[)]/); const hidden = match ? Number(match[1]) * (match[2] === '%' ? rect.height / 100 : 1) : 0;
    return { panel: panel.getBoundingClientRect().bottom, edge: rect.bottom - hidden, clip };
  })()`);
  await page.evaluate(`(() => { document.getElementById('motion-resize-probe').style.height = '160px'; window.dispatchEvent(new Event('resize')); })()`);
  await page.waitFor(`document.getElementById('${list}').getAnimations().some(a => a.playState === 'running')`, { timeout: 4000, interval: 10 });
  const next = await page.evaluate(`(() => {
    const panel = document.getElementById('${surface}'); const content = document.getElementById('${list}');
    [panel, document.getElementById('${outline}'), content].forEach(el => el.getAnimations().forEach(a => { a.pause(); a.currentTime = 0; }));
    const rect = content.getBoundingClientRect(); const clip = getComputedStyle(content).clipPath;
    const match = clip.match(/([0-9.]+)(px|%)[)]/); const hidden = match ? Number(match[1]) * (match[2] === '%' ? rect.height / 100 : 1) : 0;
    return { panel: panel.getBoundingClientRect().bottom, edge: rect.bottom - hidden, clip };
  })()`);
  if (!previous || !next || typeof previous !== 'object' || typeof next !== 'object' || !('edge' in previous) || !('edge' in next) || !('panel' in previous) || !('panel' in next)) throw new Error('Missing frame measurements');
  expect(Math.abs(Number(next.edge) - Number(previous.edge)), `before: ${JSON.stringify(previous)}, after: ${JSON.stringify(next)}`).toBeLessThan(3);
  expect(Math.abs(Number(next.panel) - Number(previous.panel))).toBeLessThan(3);
  expect(Math.abs(Number(next.panel) - Number(next.edge))).toBeLessThan(3);
  const atRest = await page.evaluate(`(() => {
    const plate = document.getElementById('${surface}');
    [plate, document.getElementById('${outline}'), document.getElementById('${list}')].forEach(el => el.getAnimations().forEach(a => { a.pause(); a.currentTime = 70; }));
    const height = plate.getBoundingClientRect().height;
    const base = parseFloat(plate.style.getPropertyValue('--x-nt-suggestions-motion-height')) - 160;
    document.getElementById('motion-resize-probe').style.height = Math.max(0, height - base) + 'px';
    window.dispatchEvent(new Event('resize'));
    return { height, target: plate.style.getPropertyValue('--x-nt-suggestions-motion-height') };
  })()`);
  if (!atRest || typeof atRest !== 'object' || !('height' in atRest) || !('target' in atRest)) throw new Error('Missing paused height');
  await page.waitFor(`document.getElementById('${surface}').style.getPropertyValue('--x-nt-suggestions-motion-height') !== ${JSON.stringify(atRest.target)}`, { timeout: 4000, interval: 10 });
  const laterHeight = await page.evaluate(`(() => {
    const plate = document.getElementById('${surface}');
    plate.getAnimations().forEach(a => { a.pause(); a.currentTime = 120; });
    return plate.getBoundingClientRect().height;
  })()`);
  expect(Math.abs(Number(laterHeight) - Number(atRest.height))).toBeLessThan(3);
});



flow('keeps the opening edge continuous when results grow during the reveal', async ({ browser }) => {
  const page = await browser.openPage(browser.extensionUrl('newtab.html'));
  await focusTab(browser, page);
  await page.waitFor(`Boolean(document.getElementById('${NEWTAB_INPUT_ID}'))`);
  await page.evaluate(`document.getElementById('${NEWTAB_INPUT_ID}').focus()`);
  await page.type('qwzx987');
  await page.waitFor(`document.getElementById('${surface}').getAnimations().length > 0`, { timeout: 10000, interval: 10 });
  const before = await page.evaluate(`(() => {
    const panel = document.getElementById('${surface}'); const content = document.getElementById('${list}');
    [panel, document.getElementById('${outline}'), content].forEach(el => el.getAnimations().forEach(a => { a.pause(); a.currentTime = 100; }));
    const rect = content.getBoundingClientRect(); const clip = getComputedStyle(content).clipPath;
    const match = clip.match(/([0-9.]+)(px|%)[)]/); const hidden = match ? Number(match[1]) * (match[2] === '%' ? rect.height / 100 : 1) : 0;
    return { panel: panel.getBoundingClientRect().bottom, edge: rect.bottom - hidden, target: panel.style.getPropertyValue('--x-nt-suggestions-motion-height') };
  })()`);
  await page.evaluate(`(() => {
    const added = document.createElement('div'); added.style.height = '80px'; added.id = 'motion-opening-probe';
    document.getElementById('${list}').append(added); window.dispatchEvent(new Event('resize'));
  })()`);
  if (!before || typeof before !== 'object' || !('target' in before) || !('panel' in before) || !('edge' in before)) throw new Error('Missing initial geometry');
  await page.waitFor(`document.getElementById('${surface}').style.getPropertyValue('--x-nt-suggestions-motion-height') !== ${JSON.stringify(before.target)}`, { timeout: 4000, interval: 10 });
  const after = await page.evaluate(`(() => {
    const panel = document.getElementById('${surface}'); const content = document.getElementById('${list}');
    const rect = content.getBoundingClientRect(); const clip = getComputedStyle(content).clipPath;
    const match = clip.match(/([0-9.]+)(px|%)[)]/); const hidden = match ? Number(match[1]) * (match[2] === '%' ? rect.height / 100 : 1) : 0;
    return { panel: panel.getBoundingClientRect().bottom, edge: rect.bottom - hidden };
  })()`);
  if (!after || typeof after !== 'object' || !('panel' in after) || !('edge' in after)) throw new Error('Missing new geometry');
  expect(Math.abs(Number(after.panel) - Number(before.panel)), `before: ${JSON.stringify(before)}, after: ${JSON.stringify(after)}`).toBeLessThan(3);
  expect(Math.abs(Number(after.edge) - Number(before.edge)), `before: ${JSON.stringify(before)}, after: ${JSON.stringify(after)}`).toBeLessThan(3);
});
