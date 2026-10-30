import { describe, expect, it } from 'vitest';
import { expectElement, getElementById } from '../../../tests/fakes/dom';
import { bootSelectionToolbar, flush, patchProperty } from '../../../tests/fakes/selection-toolbar-page';
import type { AnimationRecord, SelectionToolbarPage } from '../../../tests/fakes/selection-toolbar-page';

function part(page: SelectionToolbarPage, name: string): HTMLElement {
  return expectElement(page.query(`.lumno-selection-${name}`), name);
}

function animationOf(page: SelectionToolbarPage, name: string): AnimationRecord | undefined {
  const target = part(page, name);
  return page.animations.find((record) => record.target === target);
}

function required(record: AnimationRecord | undefined, name: string): AnimationRecord {
  if (!record) {
    throw new Error(`Expected the ${name} to animate.`);
  }
  return record;
}

async function openToolbar(page: SelectionToolbarPage, expandedLeft?: number): Promise<void> {
  await page.selectText(getElementById('selectable-link'));
  page.stubToolbarGeometry(expandedLeft);
  page.openToolbar();
}

describe('selection toolbar entrance', () => {
  it('grows the material and reveals the contents from the entry point toward the right', async () => {
    const page = await bootSelectionToolbar();
    await openToolbar(page);
    await flush(30);

    const material = required(animationOf(page, 'material'), 'material');
    expect(material.options.duration).toBe(240);
    expect(material.options.easing).toBe('cubic-bezier(0.22, 1, 0.36, 1)');
    expect(material.keyframes.map((frame) => frame.width)).toEqual(['0px', '240px']);

    const content = required(animationOf(page, 'content'), 'content');
    expect(content.keyframes.map((frame) => frame.width)).toEqual(['0px', '232px']);
    expect([content.options.duration, content.options.delay]).toEqual([260, 20]);

    const toolbar = required(animationOf(page, 'toolbar'), 'toolbar');
    expect([toolbar.options.duration, toolbar.options.delay]).toEqual([280, 30]);
    expect(toolbar.keyframes[0].transform).toMatch(/translateX\(-\d+(?:\.\d+)?px\)/);
    expect(toolbar.keyframes[1].transform).toBe('translateX(0px)');
  });

  it('moves the shell, divider, entry, actions viewport and labels with the shared content instead of animating them', async () => {
    const page = await bootSelectionToolbar();
    await openToolbar(page);
    await flush(30);
    ['surface', 'main', 'primary-divider', 'actions-viewport'].forEach((name) => {
      expect(animationOf(page, name)).toBeUndefined();
    });
    expect(page.animations.filter((record) => record.target.classList.contains('lumno-selection-action-label'))).toEqual([]);
  });

  it('keeps the finished entrance until the toolbar closes, then cancels it', async () => {
    const page = await bootSelectionToolbar();
    await openToolbar(page);
    await flush(30);
    await flush(430);
    const entrance = ['material', 'content', 'toolbar'].map((name) => required(animationOf(page, name), name));
    expect(entrance.map((record) => record.cancelled)).toEqual([false, false, false]);

    part(page, 'main').click();
    expect(entrance[0].cancelled).toBe(true);
  });

  it('stages the reveal through CSS state where the engine has no Web Animations', async () => {
    const page = await bootSelectionToolbar({ webAnimations: false });
    expect(typeof document.body.animate).toBe('undefined');
    getElementById('selectable-link').focus();
    patchProperty(HTMLElement.prototype, 'focus', { value: () => {} });
    await openToolbar(page, 78);
    const surface = part(page, 'surface');
    expect(surface.dataset.iconOnly).toBe('false');
    expect(surface.getBoundingClientRect().width).toBe(240);
    for (let attempt = 0; attempt < 20 && surface.dataset.toolbarEntranceState !== 'to'; attempt += 1) {
      await flush(10);
    }
    const host = expectElement(page.host(), 'toolbar host');
    expect(host.hidden).toBe(false);
    expect(host.dataset.visible).toBe('true');
    expect(surface.dataset.toolbarEntranceMode).toBe('fallback');
    expect(surface.dataset.toolbarEntranceState).toBe('to');

    await flush(430);
    expect(surface.dataset.toolbarEntranceState).toBe('to');
    expect(surface.style.getPropertyValue('--lumno-toolbar-expanded-width')).toBe('240px');

    document.dispatchEvent(new Event('copy', { bubbles: true }));
    expect(surface.dataset.toolbarEntranceState).toBeUndefined();
  });

  it('opens without motion when the reader prefers reduced motion', async () => {
    const page = await bootSelectionToolbar();
    await page.selectText(getElementById('selectable-link'));
    page.stubToolbarGeometry();
    page.setReducedMotion(true);
    page.openToolbar();
    await flush(30);
    expect(page.animations).toEqual([]);
    expect(part(page, 'surface').style.transition).toBe('');
  });
});
