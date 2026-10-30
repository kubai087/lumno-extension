import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it } from 'vitest';
import { BodyCopy, type BodyCopyRenderModel } from './body-copy';
import { getElement, getElements } from '../../../tests/fakes/dom';
import { queryHtmlElement } from '../../shared/dom-lookup';

let roots: Root[] = [];

interface Fixture {
  render(model: BodyCopyRenderModel): void;
}

// Draws an empty body first, so its element is in place.
function createFixture() {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  roots.push(root);
  const controller: Fixture = {
    render(model) {
      root.render(<BodyCopy model={model} />);
    }
  };
  act(() => controller.render({
    note: '', shortcutLabel: '', shortcutPlaceholder: '', shortcutTokens: [], shortcutValue: '', value: ''
  }));
  return { controller, host: getElement(container, '#onboarding-body') };
}

function render(
  controller: Fixture,
  overrides: Partial<BodyCopyRenderModel> = {}
): void {
  act(() => {
    controller.render({
      note: '',
      shortcutLabel: '⌘⇧K',
      shortcutPlaceholder: '{shortcut}',
      shortcutTokens: ['⌘', '⇧', 'K'],
      shortcutValue: 'Command+Shift+K',
      value: '',
      ...overrides
    });
  });
}

afterEach(() => {
  act(() => {
    roots.forEach((root) => root.unmount());
  });
  roots = [];
  document.body.textContent = '';
});

describe('Onboarding body copy', () => {
  it('renders plain body and note copy while preserving stable child targets', () => {
    const { controller, host } = createFixture();
    render(controller, {
      note: 'You can change this later.',
      value: 'Search from any page.'
    });

    expect(host.dataset.empty).toBe('false');
    expect(host.querySelector('#onboarding-body-prefix')?.textContent).toBe(
      'Search from any page.'
    );
    expect(
      queryHtmlElement(host, '#onboarding-shortcut-label')?.hidden
    ).toBe(true);
    expect(host.querySelector('#onboarding-body-suffix')?.textContent).toBe('');
    expect(host.querySelector('#onboarding-body-note')?.textContent).toBe(
      'You can change this later.'
    );
  });

  it('splits shortcut copy into accessible keycaps with legacy sizing', () => {
    const { controller, host } = createFixture();
    render(controller, {
      shortcutLabel: 'CTRL+SHIFT+SPACE',
      shortcutTokens: ['CTRL', 'SHIFT', 'SPACE'],
      shortcutValue: 'Ctrl+Shift+Space',
      value: 'Press {shortcut} to open Lumno.'
    });

    const shortcut = queryHtmlElement(host, '#onboarding-shortcut-label');
    const keycaps = Array.from(
      getElements(host, '.shortcut-keycap')
    );

    expect(shortcut?.hidden).toBe(false);
    expect(shortcut?.getAttribute('aria-label')).toBe('Ctrl+Shift+Space');
    expect(keycaps.map((keycap) => keycap.textContent)).toEqual([
      'CTRL',
      'SHIFT',
      'SPACE'
    ]);
    expect(keycaps.map((keycap) => keycap.style.minWidth)).toEqual([
      '44px',
      '52px',
      '52px'
    ]);
    expect(host.querySelector('#onboarding-body-prefix')?.textContent).toBe(
      'Press '
    );
    expect(host.querySelector('#onboarding-body-suffix')?.textContent).toBe(
      ' to open Lumno.'
    );
  });

  it('updates shortcut tokens in place after the browser command resolves', () => {
    const { controller, host } = createFixture();
    render(controller, {
      shortcutLabel: '⌘⇧K',
      shortcutTokens: ['⌘', '⇧', 'K'],
      value: 'Press {shortcut}.'
    });
    render(controller, {
      shortcutLabel: '⌘K',
      shortcutTokens: ['⌘', 'K'],
      shortcutValue: 'Command+K',
      value: 'Press {shortcut}.'
    });

    expect(
      Array.from(host.querySelectorAll('.shortcut-keycap')).map(
        (keycap) => keycap.textContent
      )
    ).toEqual(['⌘', 'K']);
    expect(
      host.querySelector('#onboarding-shortcut-label')
        ?.getAttribute('aria-label')
    ).toBe('Command+K');
  });

  it('keeps the empty-state skeleton contract when body and note are absent', () => {
    const { controller, host } = createFixture();
    render(controller);

    expect(host.dataset.empty).toBe('true');
    expect(host.querySelector('#onboarding-body-note')?.textContent).toBe('');
    expect(host.querySelectorAll('.shortcut-keycap')).toHaveLength(0);
  });
});
