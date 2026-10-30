import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it } from 'vitest';
import { VisualPanel, type VisualPanelModel } from './visual-panel';
import { getElement } from '../../../tests/fakes/dom';

let roots: Root[] = [];

function model(overrides: Partial<VisualPanelModel> = {}): VisualPanelModel {
  return {
    slideId: 'intro',
    kind: 'lumno-web-wordmark-surface',
    surface: {
      ariaLabel: 'Lumno',
      butterflyDValues: 'flutter;rest;flutter',
      butterflyRestPath: 'M4 17 L10 20 Z',
      kind: 'lumno-web-wordmark-surface',
      wordmarkSrc: '/assets/lumno-web-textlogo.svg'
    },
    cursor: { enabled: true, mode: 'intro' },
    exiting: false,
    ...overrides
  };
}

function setUp() {
  const host = document.createElement('div');
  document.body.appendChild(host);
  const root = createRoot(host);
  roots.push(root);
  const controller = {
    render(next: VisualPanelModel) {
      root.render(<VisualPanel model={next} />);
    }
  };
  return { host, controller };
}

afterEach(() => {
  act(() => roots.forEach((root) => root.unmount()));
  roots = [];
  document.body.textContent = '';
});

describe('Onboarding visual panel', () => {
  it('draws the slide demo in the stage and the cursor over it', () => {
    const { host, controller } = setUp();
    act(() => controller.render(model()));
    const stage = getElement(host, '#onboarding-visual-stage');
    expect(stage.dataset.visualKind).toBe('lumno-web-wordmark-surface');
    expect(getElement(stage, '[data-visual-surface]').dataset.visualSurface).toBe('onboarding-lumno-wordmark-surface');
    expect(getElement(host, '#onboarding-cursor-layer').dataset.cursorMode).toBe('intro');
  });

  it('blurs the demo and cursor out, and keeps the demo until the slide changes', () => {
    const { host, controller } = setUp();
    act(() => controller.render(model()));
    const surface = getElement(host, '[data-visual-surface]');
    act(() => controller.render(model({ exiting: true })));
    expect(getElement(host, '#onboarding-visual-stage').classList.contains('is-visual-exit')).toBe(true);
    expect(getElement(host, '#onboarding-cursor-layer').classList.contains('is-visual-exit')).toBe(true);
    expect(getElement(host, '[data-visual-surface]')).toBe(surface);
    act(() => controller.render(model({ slideId: 'finish' })));
    expect(getElement(host, '[data-visual-surface]')).not.toBe(surface);
    expect(getElement(host, '#onboarding-visual-stage').classList.contains('is-visual-exit')).toBe(false);
  });

  it('leaves the stage empty when the slide shows no visual', () => {
    const { host, controller } = setUp();
    act(() => controller.render(model({ surface: null, cursor: { enabled: false, mode: '' } })));
    expect(getElement(host, '#onboarding-visual-stage').childElementCount).toBe(0);
    expect(getElement(host, '#onboarding-cursor-layer').dataset.cursorEnabled).toBe('false');
  });
});
