import { describe, expect, it } from 'vitest';
import { readRepoFile } from '../../../tests/fakes/css';
import { expectElement, getElementById } from '../../../tests/fakes/dom';
import { bootSelectionToolbar, flush } from '../../../tests/fakes/selection-toolbar-page';
import type { SelectionToolbarPage } from '../../../tests/fakes/selection-toolbar-page';

async function openToolbarOnCopy(): Promise<{ page: SelectionToolbarPage; host: HTMLElement; actions: HTMLElement[] }> {
  const page = await bootSelectionToolbar();
  await page.selectText(getElementById('copy'));
  page.stubToolbarGeometry();
  const host = expectElement(page.host(), 'toolbar host');
  const actions = page.openToolbar();
  await flush(30);
  return { page, host, actions };
}

function part(page: SelectionToolbarPage, name: string): HTMLElement {
  return expectElement(page.query(`.lumno-selection-${name}`), name);
}

describe('selection toolbar surface', () => {
  it('starts as a compact entry that controls the toolbar', async () => {
    const page = await bootSelectionToolbar();
    await page.selectText(getElementById('copy'));
    const entry = part(page, 'main');
    expect(entry.getAttribute('aria-controls')).toBe('lumno-selection-toolbar');
    expect(entry.hasAttribute('aria-haspopup')).toBe(false);
    expect(entry.dataset.iconOnly).toBe('true');
    expect(part(page, 'surface').dataset.iconOnly).toBe('true');
  });

  it('opens three actions from the entry, the inferred one first, with focus on the toolbar itself', async () => {
    const { page, actions } = await openToolbarOnCopy();
    const toolbar = part(page, 'toolbar');
    expect(toolbar.getAttribute('role')).toBe('toolbar');
    expect(toolbar.getAttribute('tabindex')).toBe('-1');
    expect(actions.map((action) => action.dataset.intent)).toEqual(['translate', 'explain', 'search']);
    expect(page.shadow().activeElement).toBe(toolbar);
    expect(actions.every((action) => action.querySelector('.lumno-selection-action-icon > path'))).toBe(true);
  });

  it('lays the actions, divider and enlarged entry out in one right-aligned content layer', async () => {
    const { page } = await openToolbarOnCopy();
    const material = part(page, 'material');
    const content = part(page, 'content');
    const viewport = part(page, 'actions-viewport');
    const divider = part(page, 'primary-divider');
    const entry = part(page, 'main');
    expect(divider.hidden).toBe(false);
    expect(viewport.hidden).toBe(false);
    expect(part(page, 'toolbar').parentElement).toBe(viewport);
    expect(entry.hidden).toBe(false);
    expect(entry.dataset.iconOnly).toBe('false');
    expect(material.nextElementSibling).toBe(content);
    expect(viewport.parentElement).toBe(content);
    expect(viewport.nextElementSibling).toBe(divider);
    expect(divider.nextElementSibling).toBe(entry);
    expect(content.lastElementChild).toBe(entry);
  });

  it('opens the toolbar from the entry point, growing to the right', async () => {
    const { host } = await openToolbarOnCopy();
    expect(host.style.left).toBe('300px');
    expect(host.style.right).toBe('auto');
    expect(host.style.top).toBe('56px');
  });

  it('marks every toolbar node as not to be translated', async () => {
    const { page } = await openToolbarOnCopy();
    const surface = part(page, 'surface');
    [surface, ...Array.from(surface.querySelectorAll('*'))].forEach((element) => {
      expect(element.getAttribute('translate')).toBe('no');
      expect(element.getAttribute('lang')).toBe('zxx');
      expect(element.hasAttribute('notranslate')).toBe(true);
      expect(element.getAttribute('data-no-translate')).toBe('true');
      expect(element.classList.contains('notranslate')).toBe(true);
    });
  });

  it('keeps the open toolbar inside a 12 px safe area when the viewport shrinks', async () => {
    const { page, host } = await openToolbarOnCopy();
    const surface = part(page, 'surface');
    const width = window.innerWidth;
    const height = window.innerHeight;
    try {
      Object.defineProperty(window, 'innerWidth', { configurable: true, value: 400 });
      Object.defineProperty(window, 'innerHeight', { configurable: true, value: 180 });
      host.style.setProperty('left', '-200px', 'important');
      host.style.setProperty('right', 'auto', 'important');
      host.style.setProperty('top', '160px', 'important');
      window.dispatchEvent(new Event('resize'));
      await flush(30);
      expect(surface.style.maxWidth).toBe('376px');
      expect(page.resizeObserver.target).toBe(surface);
      expect(typeof page.resizeObserver.callback).toBe('function');
      expect(host.style.left).toBe('12px');
      expect(host.style.right).toBe('auto');
      expect(host.style.top).toBe('130px');
    } finally {
      Object.defineProperty(window, 'innerWidth', { configurable: true, value: width });
      Object.defineProperty(window, 'innerHeight', { configurable: true, value: height });
    }
  });

  it('opens the Labs settings from the enlarged entry', async () => {
    const { page, host } = await openToolbarOnCopy();
    part(page, 'main').click();
    expect(page.messages()).toContainEqual({ action: 'openOptionsPage', hash: 'labs' });
    expect(host.hidden).toBe(true);
  });

  it('draws its entry with the two-layer vector Lumno mark', () => {
    const mark = new DOMParser().parseFromString(readRepoFile('assets/images/lumno-selection-mark.svg'), 'image/svg+xml');
    expect(mark.documentElement.getAttribute('shape-rendering')).toBe('geometricPrecision');
    expect(mark.querySelectorAll('path')).toHaveLength(2);
  });
});
