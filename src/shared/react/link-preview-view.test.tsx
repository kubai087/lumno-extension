import { act } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createLinkPreviewView, type LinkPreviewViewController, type LinkPreviewViewModel } from './link-preview-view';
import { getElement, getTag } from '../../../tests/react/dom';

let views: LinkPreviewViewController[] = [];

function model(overrides: Partial<LinkPreviewViewModel> = {}): LinkPreviewViewModel {
  return {
    state: 'prewarm',
    motion: null,
    loaded: null,
    blocked: null,
    shot: null,
    shotVisible: false,
    backVisible: false,
    panelColor: '',
    viewport: null,
    veilMargin: null,
    scrollbars: null,
    closing: false,
    frameUrl: 'https://example.com/',
    placeholder: 'example.com',
    labels: { close: 'Close', openInTab: 'Open in new tab', copyLink: 'Copy link', reload: 'Reload', back: 'Back', blocked: 'Blocked' },
    ...overrides
  };
}

function setUp() {
  const host = document.createElement('div');
  document.body.appendChild(host);
  const shadow = host.attachShadow({ mode: 'open' });
  const handlers = {
    onClose: vi.fn(), onOpenInTab: vi.fn(), onCopyLink: vi.fn(), onReload: vi.fn(), onBack: vi.fn(), onFrameLoad: vi.fn()
  };
  const drawnViews: LinkPreviewViewController[] = [];
  act(() => {
    const drawn = createLinkPreviewView(shadow, handlers, model(), {
      styles: '.root { color: red; }',
      toastStylesheetUrl: 'toast.css'
    });
    if (drawn) {
      drawnViews.push(drawn);
    }
  });
  const view = drawnViews[0];
  if (!view) {
    throw new Error('the view did not draw');
  }
  views.push(view);
  return { shadow, handlers, view };
}

afterEach(() => {
  act(() => views.forEach((view) => view.destroy()));
  views = [];
  document.body.textContent = '';
});

describe('Link preview view', () => {
  it('draws the window with its frame address, styles and controls, and hands back its elements', () => {
    const { shadow, view } = setUp();
    const { root, frame, toastElement, toastStylesheet } = view.elements;
    expect([root.dataset.state, root.getAttribute('role'), root.getAttribute('aria-modal')]).toEqual(['prewarm', 'dialog', 'true']);
    expect([frame.getAttribute('src'), frame.name, frame.getAttribute('sandbox')?.includes('allow-scripts')])
      .toEqual(['https://example.com/', 'lumno-link-preview', true]);
    expect(shadow.querySelector('style')?.textContent).toBe('.root { color: red; }');
    expect(toastStylesheet.getAttribute('href')).toBe('toast.css');
    expect(toastElement.getAttribute('data-show')).toBe('false');
    expect(Array.from(shadow.querySelectorAll('.control'), (button) => button.getAttribute('aria-label')))
      .toEqual(['Close', 'Open in new tab', 'Copy link', 'Reload', 'Back']);
    expect(getTag(shadow, '.control[aria-label="Back"]', 'button').hidden).toBe(true);
    expect(shadow.querySelector('.placeholder')?.textContent).toBe('example.com');
  });

  it('shows the model on the root and the receded page', () => {
    const { shadow, view } = setUp();
    act(() => view.render(model({
      state: 'open', motion: 'still', loaded: true, blocked: false, shot: 'image', shotVisible: true,
      backVisible: true, panelColor: 'rgb(1, 2, 3)', viewport: { width: 800, height: 600 }, veilMargin: { x: 26, y: 20 },
      scrollbars: { left: 0, right: 15, bottom: 0 }, closing: true
    })));
    const { root, page, panel } = view.elements;
    expect([root.dataset.state, root.dataset.motion, root.dataset.loaded, root.dataset.blocked, root.dataset.shot])
      .toEqual(['open', 'still', 'true', 'false', 'image']);
    expect([
      root.style.getPropertyValue('--lp-window-width'),
      root.style.getPropertyValue('--lp-veil-margin-x'),
      root.style.getPropertyValue('--lp-scrollbar-right'),
      root.style.pointerEvents
    ]).toEqual(['800px', '26px', '15px', 'none']);
    expect([page.hidden, panel.style.backgroundColor]).toEqual([false, 'rgb(1, 2, 3)']);
    expect(getTag(shadow, '.control[aria-label="Back"]', 'button').hidden).toBe(false);
  });

  it('reports its buttons and a press outside the window', () => {
    const { shadow, handlers } = setUp();
    const press = (selector: string) => act(() => getElement(shadow, selector).click());
    press('.control-close');
    press('.control[aria-label="Copy link"]');
    press('.notice button');
    press('.stage');
    expect([handlers.onClose.mock.calls.length, handlers.onCopyLink.mock.calls.length, handlers.onOpenInTab.mock.calls.length])
      .toEqual([2, 1, 1]);
  });
});
