import { describe, expect, it, vi } from 'vitest';
import { getElementById, getTag } from '../../tests/fakes/dom';
import {
  HOST_ID,
  ICON_SET_KEY,
  LANGUAGE_KEY,
  TRIGGER_STYLE_KEY,
  bootSelectionToolbar,
  flush
} from '../../tests/fakes/selection-toolbar-page';
import type { SelectionToolbarPage } from '../../tests/fakes/selection-toolbar-page';

function visibleHost(page: SelectionToolbarPage): HTMLElement {
  const host = page.host();
  if (!(host instanceof HTMLElement)) {
    throw new Error('Expected the toolbar host.');
  }
  return host;
}

function addForeignHost(): HTMLDivElement {
  const foreign = document.createElement('div');
  foreign.id = HOST_ID;
  foreign.dataset.selectionMark = 'lumno';
  document.documentElement.appendChild(foreign);
  return foreign;
}

function hostCount(): number {
  return document.querySelectorAll(`[id="${HOST_ID}"]`).length;
}

describe('selection toolbar entry', () => {
  it('shows the entry for a selection, guarded against page styles and translators', async () => {
    const page = await bootSelectionToolbar({ local: { [TRIGGER_STYLE_KEY]: 'lumno' } });
    await page.selectText(getElementById('copy'));
    const host = visibleHost(page);

    expect(host.hidden).toBe(false);
    expect(host.dataset.visible).toBe('true');
    expect([host.getAttribute('translate'), host.getAttribute('lang'), host.getAttribute('notranslate'), host.getAttribute('data-no-translate')])
      .toEqual(['no', 'zxx', '', 'true']);
    expect(host.classList.contains('notranslate')).toBe(true);
    expect(host.dataset.runtimeRevision).toBe('selection-toolbar-v32');
    expect(host.dataset.runtimeId).toBe(page.browser.runtime.id);
    expect(host.dataset.entryContrast).toBe('light');
    expect(host.style.colorScheme).toBe('light');
    expect(host.style.getPropertyValue('all')).toBe('initial');
    const computed = window.getComputedStyle(host);
    expect({
      display: computed.display,
      position: computed.position,
      zIndex: computed.zIndex,
      opacity: computed.opacity,
      visibility: computed.visibility,
      pointerEvents: computed.pointerEvents,
      transform: computed.transform,
      filter: computed.filter
    }).toEqual({
      display: 'block',
      position: 'fixed',
      zIndex: '2147483647',
      opacity: '1',
      visibility: 'visible',
      pointerEvents: 'auto',
      transform: 'none',
      filter: 'none'
    });
  });

  it('always draws the Lumno mark, whatever the obsolete style and icon settings say', async () => {
    const page = await bootSelectionToolbar({
      sync: { [ICON_SET_KEY]: 'hugeicons', [TRIGGER_STYLE_KEY]: 'butterfly' },
      local: { [TRIGGER_STYLE_KEY]: 'lumno' }
    });
    await page.selectText(getElementById('copy'));
    const host = visibleHost(page);
    expect(host.dataset.iconSet).toBe('remix');
    expect(host.dataset.selectionMark).toBe('lumno');
    expect(host.dataset.triggerStyle).toBeUndefined();
    expect(host.dataset.triggerStyleSource).toBeUndefined();
    const logo = getTag(page.shadow(), '.lumno-selection-logo', 'img');
    expect(logo.hidden).toBe(false);
    expect(logo.src.endsWith('/assets/images/lumno-selection-mark.svg')).toBe(true);
    expect(page.shadow().querySelector('.lumno-selection-butterfly-stage')).toBeNull();
    expect(page.shadow().querySelector('.lumno-selection-more')).toBeNull();

    expect(page.browser.storage.local.values[TRIGGER_STYLE_KEY]).toBe('lumno');
    const localWrites = vi.spyOn(page.browser.storage.local, 'set');
    page.storageChange({ [LANGUAGE_KEY]: 'zh-CN' });
    await flush();
    expect(host.dataset.selectionMark).toBe('lumno');
    for (const area of ['sync', 'local'] as const) {
      page.storageChange({ [TRIGGER_STYLE_KEY]: 'lumno' }, area);
      expect(host.dataset.selectionMark).toBe('lumno');
      page.storageChange({ [TRIGGER_STYLE_KEY]: 'butterfly' }, area);
      expect(host.dataset.selectionMark).toBe('lumno');
    }
    expect(localWrites).not.toHaveBeenCalled();
    expect(hostCount()).toBe(1);
  });

  it('removes a host another Lumno copy put on the page before its own', async () => {
    await bootSelectionToolbar();
    const early = addForeignHost();
    await flush();
    expect(early.isConnected).toBe(false);
  });

  it('removes a host another Lumno copy put on the page after its own', async () => {
    const page = await bootSelectionToolbar();
    await page.selectText(getElementById('copy'));
    const late = addForeignHost();
    await flush();
    expect(late.isConnected).toBe(false);
    expect(hostCount()).toBe(1);
    expect(visibleHost(page).hidden).toBe(false);
  });

  it('puts the entry tightly at the end of the selected text', async () => {
    const page = await bootSelectionToolbar();
    await page.selectText(getElementById('generic'));
    const host = visibleHost(page);
    expect(host.hidden).toBe(false);
    expect(host.dataset.selectionMark).toBe('lumno');
    expect(host.style.left).toBe('72px');
    expect(host.style.top).toBe('66px');
  });

  it('matches a dark page surface without flashing a light toolbar', async () => {
    const page = await bootSelectionToolbar();
    await page.selectText(getElementById('dark-copy'));
    const host = visibleHost(page);
    expect(host.dataset.entryContrast).toBe('dark');
    expect(host.style.colorScheme).toBe('dark');
  });

  it('dismisses the entry on copy and releases the page when turned off', async () => {
    const page = await bootSelectionToolbar();
    await page.selectText(getElementById('copy'));
    const host = visibleHost(page);
    document.dispatchEvent(new Event('copy', { bubbles: true }));
    expect(host.hidden).toBe(true);

    await page.selectText(getElementById('copy'));
    expect(host.hidden).toBe(false);
    page.storageChange({ _x_extension_selection_quick_actions_enabled_2026_unique_: false });
    expect(host.isConnected).toBe(false);
  });
});

describe('selections the toolbar answers', () => {
  it('puts Summarize first for a whole article paragraph', async () => {
    const page = await bootSelectionToolbar();
    await page.selectText(getElementById('article-paragraph'));
    expect(visibleHost(page).hidden).toBe(false);
    expect(page.openToolbar().map((action) => action.dataset.intent)[0]).toBe('summarize');
  });

  it('puts Answer first for a question, without making it a fallback', async () => {
    const page = await bootSelectionToolbar();
    await page.selectText(getElementById('question'));
    expect(page.openToolbar().map((action) => action.dataset.intent)).toEqual(['ask', 'explain', 'search']);
  });

  it('keeps a button selection after the click that clears it, without blocking the click', async () => {
    const page = await bootSelectionToolbar();
    const button = getElementById('selectable-button');
    let clicks = 0;
    button.addEventListener('click', () => {
      clicks += 1;
      window.getSelection()?.removeAllRanges();
    });
    await page.selectText(button, { clickAfterPointerUp: true });
    expect(clicks).toBe(1);
    expect(visibleHost(page).hidden).toBe(false);
    expect(page.openToolbar()[0].dataset.intent).toBe('ask');
  });

  it.each(['selectable-link', 'selectable-role-button', 'selectable-custom', 'selectable-editable'])(
    'answers text selected inside an interactive element: %s', async (id) => {
      const page = await bootSelectionToolbar();
      const element = getElementById(id);
      element.addEventListener('click', () => {});
      await page.selectText(element);
      expect(visibleHost(page).hidden).toBe(false);
    });

  it('answers selections in text inputs and text areas', async () => {
    const page = await bootSelectionToolbar();
    const input = getTag(document, '#selectable-input', 'input');
    await page.selectControl(input, 0, input.value.length);
    expect(visibleHost(page).hidden).toBe(false);
    expect(page.openToolbar()[0].dataset.intent).toBe('translate');

    const textarea = getTag(document, '#selectable-textarea', 'textarea');
    await page.selectControl(textarea, 0, textarea.value.length);
    expect(visibleHost(page).hidden).toBe(false);
  });

  it('stays hidden for password and payment fields, without reading the card number', async () => {
    const page = await bootSelectionToolbar();
    await page.selectText(getElementById('copy'));
    const host = visibleHost(page);

    const password = getTag(document, '#sensitive-password', 'input');
    await page.selectControl(password, 0, password.value.length);
    expect(host.hidden).toBe(true);

    const payment = getTag(document, '#sensitive-payment', 'input');
    const valueDescriptor = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value');
    let reads = 0;
    Object.defineProperty(payment, 'value', {
      configurable: true,
      get() {
        reads += 1;
        return valueDescriptor?.get?.call(this);
      }
    });
    await page.selectControl(payment, 0, 16, () => { reads = 0; });
    expect(host.hidden).toBe(true);
    expect(reads).toBe(0);
  });

  it('stays hidden for a generic Chinese statement', async () => {
    const page = await bootSelectionToolbar();
    await page.selectText(getElementById('copy'));
    const host = visibleHost(page);
    await page.selectText(getElementById('cjk'));
    expect(host.hidden).toBe(true);
  });
});

describe('selection gestures', () => {
  async function bootWithHost(): Promise<{ page: SelectionToolbarPage; host: HTMLElement; xPost: HTMLElement }> {
    const page = await bootSelectionToolbar();
    await page.selectText(getElementById('copy'));
    const host = visibleHost(page);
    document.dispatchEvent(new Event('copy', { bubbles: true }));
    return { page, host, xPost: getElementById('x-post') };
  }

  function selectContents(element: Element): void {
    const selection = window.getSelection();
    if (!selection) throw new Error('Expected a selection.');
    selection.removeAllRanges();
    const range = document.createRange();
    range.selectNodeContents(element);
    selection.addRange(range);
  }

  it('answers a selection that settles after the pointer is released', async () => {
    const { page, host, xPost } = await bootWithHost();
    window.getSelection()?.removeAllRanges();
    xPost.dispatchEvent(page.pointer('pointerdown', 20, 130));
    xPost.dispatchEvent(page.pointer('pointerup', 120, 130));
    selectContents(xPost);
    document.dispatchEvent(new Event('selectionchange'));
    await flush(520);
    expect(host.hidden).toBe(false);
  });

  it('answers a selection started without a pointer release', async () => {
    const { host, xPost } = await bootWithHost();
    window.getSelection()?.removeAllRanges();
    xPost.dispatchEvent(new Event('selectstart', { bubbles: true }));
    selectContents(xPost);
    document.dispatchEvent(new Event('selectionchange'));
    await flush(520);
    expect(host.hidden).toBe(false);
  });

  it('keeps a selection whose pointer was cancelled', async () => {
    const { page, host, xPost } = await bootWithHost();
    window.getSelection()?.removeAllRanges();
    xPost.dispatchEvent(page.pointer('pointerdown', 20, 130));
    selectContents(xPost);
    xPost.dispatchEvent(page.pointer('pointercancel', 120, 130));
    await flush(520);
    expect(host.hidden).toBe(false);
  });

  it('ignores an existing selection without a new pointer gesture', async () => {
    const { page, host } = await bootWithHost();
    const paragraph = getElementById('copy');
    selectContents(paragraph);
    paragraph.dispatchEvent(page.pointer('pointerup', 70, 40));
    await flush(520);
    expect(host.hidden).toBe(true);
  });
});
