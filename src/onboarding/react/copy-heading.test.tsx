import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { CopyHeading, type CopyHeadingRenderModel } from './copy-heading';
import { getElement } from '../../../tests/fakes/dom';
import { queryHtmlElement, queryHtmlTag } from '../../shared/dom-lookup';

let roots: Root[] = [];

interface Fixture {
  render(model: CopyHeadingRenderModel): void;
}

// Draws an empty heading first, so its elements are in place.
function createFixture() {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  roots.push(root);
  const options = {
    onTitleFitNeeded: vi.fn()
  };
  const controller: Fixture = {
    render(model) {
      root.render(<CopyHeading handlers={options} model={model} />);
    }
  };
  act(() => controller.render({
    cycleFirstDelayMs: 0, cycleIntervalMs: 1, eyebrow: '', reducedMotion: true, swapDurationMs: 0, title: '', titleLines: []
  }));
  return {
    controller,
    eyebrow: getElement(container, '#onboarding-eyebrow'),
    options,
    title: getElement(container, '#onboarding-title')
  };
}

function render(
  controller: Fixture,
  overrides: Partial<CopyHeadingRenderModel> = {}
): void {
  act(() => {
    controller.render({
      cycleFirstDelayMs: 520,
      cycleIntervalMs: 1900,
      eyebrow: 'Welcome',
      reducedMotion: false,
      swapDurationMs: 200,
      title: 'Search your bookmarks',
      titleCycle: null,
      titleLines: [],
      titleLogo: null,
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
  vi.useRealTimers();
});

describe('Onboarding copy heading', () => {
  it('renders eyebrow and plain title copy', () => {
    const { controller, eyebrow, title } = createFixture();
    render(controller);

    expect(eyebrow.dataset.empty).toBe('false');
    expect(eyebrow.textContent).toBe('Welcome');
    expect(title.dataset.empty).toBe('false');
    expect(title.textContent).toBe('Search your bookmarks');
    expect(title.hasAttribute('aria-label')).toBe(false);
  });

  it('renders multiline title copy and the optional logo contract', () => {
    const { controller, title } = createFixture();
    render(controller, {
      title: 'Meet Lumno',
      titleLines: ['Meet', 'Lumno'],
      titleLogo: {
        label: 'Lumno',
        src: '/assets/lumno.svg'
      }
    });

    expect(title.getAttribute('aria-label')).toBe('Meet Lumno');
    expect(title.querySelectorAll('.title-line')).toHaveLength(2);
    expect(title.querySelector('.title-break')).not.toBeNull();
    const logo = queryHtmlTag(title, '.title-logo-mark', 'img');
    expect(logo?.getAttribute('src')).toBe('/assets/lumno.svg');
    expect(logo?.title).toBe('Lumno');
    expect(logo?.getAttribute('aria-hidden')).toBe('true');
  });

  it('cycles title labels with the existing exit and enter timing', () => {
    vi.useFakeTimers();
    const { controller, options, title } = createFixture();
    render(controller, {
      title: 'Search bookmarks and history',
      titleCycle: {
        prefix: 'Search ',
        items: [
          { label: 'bookmarks', tone: 'bookmark' },
          { label: 'history', tone: 'history' }
        ]
      },
      titleLines: ['Search bookmarks', 'from anywhere']
    });
    const getText = () => queryHtmlElement(title, '[data-title-rotator-text]');
    const getRotator = () => queryHtmlElement(title, '[data-title-rotator]');

    expect(getText()?.textContent).toBe('bookmarks');
    expect(getRotator()?.dataset.tone).toBe('bookmark');

    act(() => {
      vi.advanceTimersByTime(520);
    });
    expect(getText()?.classList.contains('is-exit')).toBe(true);

    act(() => {
      vi.advanceTimersByTime(200);
    });
    expect(getText()?.textContent).toBe('history');
    expect(getText()?.classList.contains('is-enter-start')).toBe(true);
    expect(getRotator()?.dataset.tone).toBe('history');

    act(() => {
      vi.advanceTimersByTime(16);
    });
    expect(getText()?.classList.contains('is-enter-start')).toBe(false);
    expect(options.onTitleFitNeeded).toHaveBeenCalled();
  });

  it('keeps the first title item static when reduced motion is preferred', () => {
    vi.useFakeTimers();
    const { controller, title } = createFixture();
    render(controller, {
      reducedMotion: true,
      titleCycle: {
        prefix: 'Search ',
        items: [
          { label: 'bookmarks', tone: 'bookmark' },
          { label: 'history', tone: 'history' }
        ]
      },
      titleLines: ['Search bookmarks', 'from anywhere']
    });

    act(() => {
      vi.advanceTimersByTime(5000);
    });

    expect(
      title.querySelector('[data-title-rotator-text]')?.textContent
    ).toBe('bookmarks');
    expect(
      title.querySelector('[data-title-rotator]')?.getAttribute('data-tone')
    ).toBe('bookmark');
  });
});
