import { afterEach, describe, expect, it, vi } from 'vitest';
import { createSuggestionsLayout } from './suggestions-layout';

const LIMIT = '--x-nt-suggestions-menu-fit-max-height';

function setUp() {
  const container = document.createElement('div');
  document.body.appendChild(container);
  let limit: number | null = null;
  const layoutController = {
    setSuggestionsVisible: vi.fn(),
    updateSuggestionsFloatingLayout: vi.fn()
  };
  const inputModeController = {
    setModeMenuResultOffset: vi.fn(),
    fitModeMenuWithinViewport: vi.fn(() => limit)
  };
  const layout = createSuggestionsLayout({
    pageState: {
      suggestionsContainer: container,
      inputModeController,
      layoutMotion: null,
      layoutController
    }
  });
  return {
    container,
    layout,
    layoutController,
    inputModeController,
    setLimit: (next: number | null) => { limit = next; }
  };
}

afterEach(() => {
  document.body.textContent = '';
});

describe('New Tab suggestions layout', () => {
  it('redraws the frame whenever the scope menu changes the list height limit (#121)', () => {
    const { container, layout, layoutController, setLimit } = setUp();

    setLimit(59);
    layout.syncSearchModeMenuResultOffset();
    expect(container.style.getPropertyValue(LIMIT)).toBe('59px');
    expect(layoutController.updateSuggestionsFloatingLayout).toHaveBeenCalledTimes(1);

    // The menu closes: the limit goes and the frame follows the taller list.
    setLimit(null);
    layout.syncSearchModeMenuResultOffset();
    expect(container.style.getPropertyValue(LIMIT)).toBe('');
    expect(layoutController.updateSuggestionsFloatingLayout).toHaveBeenCalledTimes(2);
  });

  it('leaves the frame alone when the limit stays the same', () => {
    const { layout, layoutController, setLimit } = setUp();
    setLimit(80);
    layout.syncSearchModeMenuResultOffset();
    layout.syncSearchModeMenuResultOffset();
    expect(layoutController.updateSuggestionsFloatingLayout).toHaveBeenCalledTimes(1);
  });

  it('fits the scope menu below the list at the list\'s own height (#126)', () => {
    const { container, layout, inputModeController, setLimit } = setUp();
    container.setAttribute('data-visible', 'true');
    // The list is 72px tall unless the menu's cap is shorter.
    Object.defineProperty(container, 'offsetHeight', {
      configurable: true,
      get: () => Math.min(72, Number.parseFloat(container.style.getPropertyValue(LIMIT)) || Infinity)
    });
    container.style.setProperty(LIMIT, '20px');
    setLimit(300);
    layout.syncSearchModeMenuResultOffset();
    expect(inputModeController.fitModeMenuWithinViewport).toHaveBeenLastCalledWith({ bottomInset: 24, resultHeight: 72 });
    expect(inputModeController.setModeMenuResultOffset).toHaveBeenLastCalledWith(72);
  });
});
