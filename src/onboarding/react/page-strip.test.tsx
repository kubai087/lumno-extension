import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { PageStrip, type PageStripRenderModel } from './page-strip';
import { getElement, getTags } from '../../../tests/fakes/dom';

let roots: Root[] = [];

interface Fixture {
  render(model: PageStripRenderModel): void;
}

// Draws the strip hidden, as on the intro page, so its element is in place.
function createFixture() {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  roots.push(root);
  const onNavigate = vi.fn();
  const controller: Fixture = {
    render(model) {
      root.render(<PageStrip handlers={{ onNavigate }} model={model} />);
    }
  };
  act(() => controller.render({ pageCount: 1, currentPageIndex: 0, hidden: true, entering: false, ariaLabel: '', segmentAriaLabels: [] }));
  return { controller, host: getElement(container, '#onboarding-page-strip'), onNavigate };
}

function renderPage(
  controller: Fixture,
  overrides: Partial<PageStripRenderModel> = {}
): void {
  act(() => {
    controller.render({
      pageCount: 4,
      currentPageIndex: 1,
      hidden: false,
      entering: false,
      ariaLabel: 'Page 2 of 4',
      segmentAriaLabels: ['Page 1', 'Page 2', 'Page 3', 'Page 4'],
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

describe('Onboarding page strip', () => {
  it('renders the current step with the legacy class and ARIA contract', () => {
    const { controller, host } = createFixture();
    renderPage(controller);

    const segments = Array.from(
      getTags(host, '.page-strip-segment', 'button')
    );
    expect(host.hidden).toBe(false);
    expect(host.style.getPropertyValue('--page-strip-count')).toBe('4');
    expect(host.getAttribute('aria-label')).toBe('Page 2 of 4');
    expect(segments).toHaveLength(4);
    expect(segments[1].dataset.active).toBe('true');
    expect(segments[1].getAttribute('aria-current')).toBe('step');
    expect(
      segments[3].style.getPropertyValue('--page-strip-segment-index')
    ).toBe('3');
  });

  it('removes segments while the intro page keeps the strip hidden', () => {
    const { controller, host } = createFixture();
    renderPage(controller);
    renderPage(controller, { hidden: true });

    expect(host.hidden).toBe(true);
    expect(host.childElementCount).toBe(0);
  });

  it('preserves the one-render entrance marker', () => {
    const { controller, host } = createFixture();
    renderPage(controller, { entering: true });
    expect(host.dataset.entering).toBe('true');

    renderPage(controller, { entering: false });
    expect(host.dataset.entering).toBe('false');
  });

  it('navigates once without reaching the legacy document delegate', () => {
    const { controller, host, onNavigate } = createFixture();
    const documentClick = vi.fn();
    document.addEventListener('click', documentClick);
    renderPage(controller);

    act(() => {
      getTags(host, 'button', 'button')[2].click();
    });

    expect(onNavigate).toHaveBeenCalledTimes(1);
    expect(onNavigate).toHaveBeenCalledWith(3);
    expect(documentClick).not.toHaveBeenCalled();
    document.removeEventListener('click', documentClick);
  });
});
