import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it } from 'vitest';
import { CursorLayer, type CursorLayerRenderModel } from './cursor-layer';
import { getElement } from '../../../tests/fakes/dom';

let roots: Root[] = [];

// Draws a disabled cursor first, so its layer is in place.
function createFixture() {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  roots.push(root);
  const controller = {
    render(model: CursorLayerRenderModel) {
      root.render(<CursorLayer model={model} />);
    }
  };
  act(() => controller.render({ enabled: false, mode: '' }));
  return { controller, host: getElement(container, '#onboarding-cursor-layer') };
}

afterEach(() => {
  act(() => {
    roots.forEach((root) => root.unmount());
  });
  roots = [];
  document.body.textContent = '';
});

describe('Onboarding cursor layer', () => {
  it('renders the existing cursor SVG and animation mode contract', () => {
    const { controller, host } = createFixture();
    act(() => {
      controller.render({ enabled: true, mode: 'setup' });
    });

    expect(host.dataset.cursorEnabled).toBe('true');
    expect(host.dataset.cursorMode).toBe('setup');
    expect(host.querySelectorAll('.demo-cursor')).toHaveLength(1);
    expect(
      host.querySelector('.figma-cursor')?.getAttribute('viewBox')
    ).toBe('0 0 48 58');
    const paths = host.querySelectorAll('path');
    expect(paths).toHaveLength(2);
    expect(paths[0]?.getAttribute('d')).toBe(
      'M8.5 6.5 L43.5 28.7 L29.3 33 L20.8 50 Z'
    );
    expect(paths[1]?.getAttribute('stroke-width')).toBe('2');
    expect(paths[1]?.getAttribute('fill')).toBe('#303030');
  });

  it('keeps one cursor node while disabling and changing modes', () => {
    const { controller, host } = createFixture();
    act(() => {
      controller.render({ enabled: true, mode: 'intro' });
      controller.render({ enabled: false, mode: 'finish' });
    });

    expect(host.dataset.cursorEnabled).toBe('false');
    expect(host.dataset.cursorMode).toBe('');
    expect(host.querySelectorAll('.demo-cursor')).toHaveLength(1);

    act(() => {
      controller.render({ enabled: true, mode: 'finish' });
    });
    expect(host.dataset.cursorEnabled).toBe('true');
    expect(host.dataset.cursorMode).toBe('finish');
    expect(host.querySelectorAll('.demo-cursor')).toHaveLength(1);
  });
});
