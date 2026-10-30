import { describe, expect, it } from 'vitest';
import { expectElement, getElementById, getTag } from '../../../tests/fakes/dom';
import { bootSelectionToolbar, flush } from '../../../tests/fakes/selection-toolbar-page';
import type { SelectionToolbarPage } from '../../../tests/fakes/selection-toolbar-page';

const SENDING = '正在后台打开…';
const FAILED = '发送失败，请重试。';

function toast(page: SelectionToolbarPage): HTMLElement {
  return expectElement(page.toastShadow().querySelector('.x-lumno-toast'), 'toast');
}

function host(page: SelectionToolbarPage): HTMLElement {
  return expectElement(page.host(), 'toolbar host');
}

async function openOnLink(page: SelectionToolbarPage): Promise<HTMLElement[]> {
  await page.selectText(getElementById('selectable-link'));
  page.stubToolbarGeometry();
  return page.openToolbar();
}

function reply(page: SelectionToolbarPage, response: unknown): void {
  const callback = page.pendingReplies.shift();
  if (!callback) {
    throw new Error('Expected a pending action reply.');
  }
  callback(response);
}

describe('selection toolbar actions', () => {
  it('keeps the toolbar open when one of its own nodes loses focus', async () => {
    const page = await bootSelectionToolbar();
    await openOnLink(page);
    page.query('.lumno-selection-toolbar').dispatchEvent(new FocusEvent('blur', { bubbles: false, composed: true }));
    expect(host(page).hidden).toBe(false);
  });

  it('sends one request with the action and the captured text, then closes into a toast', async () => {
    const page = await bootSelectionToolbar();
    const [first] = await openOnLink(page);
    await flush(30);
    const material = page.query('.lumno-selection-material');
    const entrance = page.animations.filter((record) => record.target === material).at(-1);
    const sent = page.messages().length;
    page.replyToActions('defer');
    first.click();

    expect(page.messages()).toHaveLength(sent + 1);
    expect(page.messages().at(-1)).toEqual({
      action: 'runSelectionQuickAction',
      intent: first.dataset.intent,
      locale: 'zh-CN',
      text: 'React components'
    });
    expect(host(page).hidden).toBe(true);
    expect(toast(page).dataset.show).toBe('true');
    expect(toast(page).textContent).toBe(SENDING);
    expect(entrance?.cancelled).toBe(true);
    expect(page.pendingReplies).toHaveLength(1);
  });

  it('lets a newer selection outlive an older action and its late failure', async () => {
    const page = await bootSelectionToolbar();
    const [first] = await openOnLink(page);
    page.replyToActions('defer');
    first.click();
    document.dispatchEvent(new Event('copy', { bubbles: true }));

    const input = getTag(document, '#selectable-input', 'input');
    await page.selectControl(input, 0, input.value.length);
    expect(host(page).hidden).toBe(false);
    await flush(700);
    expect(host(page).hidden).toBe(false);

    reply(page, { ok: false });
    await flush();
    expect(host(page).hidden).toBe(false);
    expect(toast(page).dataset.show).toBe('false');
    expect(toast(page).textContent).not.toBe(FAILED);
    expect(page.openToolbar()[0].dataset.intent).toBe('translate');
  });

  it('reports a failed action in an error toast and keeps the toolbar closed', async () => {
    const page = await bootSelectionToolbar();
    const input = getTag(document, '#selectable-input', 'input');
    await page.selectControl(input, 0, input.value.length);
    const [first] = page.openToolbar();
    page.replyToActions({ ok: false });
    first.click();
    await flush();

    expect(host(page).hidden).toBe(true);
    expect(toast(page).dataset.show).toBe('true');
    expect(toast(page).textContent).toBe(FAILED);
    expect(toast(page).dataset.tone).toBe('error');
    await flush(1100);
    expect(host(page).hidden).toBe(true);
    expect(toast(page).dataset.show).toBe('true');
  });

  it('gives the toast to the latest of two overlapping actions', async () => {
    const page = await bootSelectionToolbar();
    const textarea = getTag(document, '#selectable-textarea', 'textarea');
    await page.selectControl(textarea, 0, textarea.value.length);
    expect(host(page).hidden).toBe(false);
    const [action] = page.openToolbar();
    page.replyToActions('defer', 'defer');
    action.click();
    await flush(100);
    action.click();
    expect(page.pendingReplies).toHaveLength(2);
    const [older, latest] = page.pendingReplies.splice(0, 2);

    await flush(850);
    latest({ ok: false });
    await flush(250);
    expect(host(page).hidden).toBe(true);
    expect(toast(page).dataset.show).toBe('true');
    expect(toast(page).textContent).toBe(FAILED);
    older({ ok: false });
  });
});
