import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { CopyPanel, type CopyPanelModel } from './copy-panel';
import { getElement } from '../../../tests/fakes/dom';

let roots: Root[] = [];

function model(overrides: Partial<CopyPanelModel> = {}): CopyPanelModel {
  return {
    slideId: 'setup',
    pageStrip: { pageCount: 4, currentPageIndex: 0, hidden: false, entering: false, ariaLabel: 'Page 1 of 4', segmentAriaLabels: [] },
    heading: {
      cycleFirstDelayMs: 0, cycleIntervalMs: 1, eyebrow: 'Step 1', reducedMotion: true, swapDurationMs: 0,
      title: 'Set the shortcut', titleLines: []
    },
    body: { note: '', shortcutLabel: '', shortcutPlaceholder: '', shortcutTokens: [], shortcutValue: '', value: 'Press it anywhere.' },
    interactions: { expandedAccordionId: '', slots: [] },
    actions: { primary: { actionId: 'next', label: 'Next' } },
    copySwap: null,
    ...overrides
  };
}

function setUp() {
  const host = document.createElement('section');
  document.body.appendChild(host);
  const handlers = {
    onNavigate: vi.fn(),
    onTitleFitNeeded: vi.fn(),
    onAction: vi.fn(),
    onShowTooltip: vi.fn(),
    onHideTooltip: vi.fn(),
    onToggleAccordion: vi.fn(),
    onShowInfoTooltip: vi.fn(),
    onHideInfoTooltip: vi.fn()
  };
  const root = createRoot(host);
  roots.push(root);
  const controller = {
    render(next: CopyPanelModel) {
      root.render(<CopyPanel handlers={handlers} model={next} />);
    }
  };
  return { host, handlers, controller };
}

afterEach(() => {
  act(() => roots.forEach((root) => root.unmount()));
  roots = [];
  document.body.textContent = '';
});

describe('Onboarding copy panel', () => {
  it('draws the strip, heading, body and buttons in order', () => {
    const { host, controller } = setUp();
    act(() => controller.render(model()));
    const order = ['#onboarding-page-strip', '#onboarding-eyebrow', '#onboarding-title', '#onboarding-body', '.onboarding-copy-actions']
      .map((selector) => getElement(host, selector));
    order.slice(1).forEach((element, index) => {
      expect(order[index]?.compareDocumentPosition(element) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    });
    expect(getElement(host, '#onboarding-title').textContent).toBe('Set the shortcut');
  });

  it('moves the title and body through a slide change together', () => {
    const { host, controller } = setUp();
    const classes = () => ['#onboarding-title', '#onboarding-body'].map((selector) => getElement(host, selector).className);
    act(() => controller.render(model({ copySwap: 'exit' })));
    expect(classes()).toEqual(['title t-copy-swap is-exit', 'body-copy t-copy-swap is-exit']);
    act(() => controller.render(model({ copySwap: 'enter-start' })));
    expect(classes()).toEqual(['title t-copy-swap is-enter-start', 'body-copy t-copy-swap is-enter-start']);
    act(() => controller.render(model({ copySwap: 'enter' })));
    expect(classes()).toEqual(['title t-copy-swap', 'body-copy t-copy-swap']);
    act(() => controller.render(model()));
    expect(classes()).toEqual(['title', 'body-copy']);
  });

  it('reports a step and an action', () => {
    const { host, handlers, controller } = setUp();
    act(() => controller.render(model({ pageStrip: { ...model().pageStrip, segmentAriaLabels: ['1', '2', '3', '4'] } })));
    act(() => getElement(host, '[data-slide-target="2"]').click());
    act(() => getElement(host, '[data-action="next"]').click());
    expect(handlers.onNavigate).toHaveBeenCalledWith(2);
    expect(handlers.onAction).toHaveBeenCalledWith('next', expect.any(MouseEvent));
  });
});
