// A short shrink of the search box when the user focuses it by hand (a
// click on the field or the background, or the search shortcut). Auto-focus
// and typing on the page do not play it.

const FOCUS_PRESS_ATTRIBUTE = 'data-nt-focus-press';
// Longer than the CSS animation, in case animationend never arrives.
const FOCUS_PRESS_FALLBACK_MS = 600;

interface FocusPressDeps {
  // The search box's outer shell, which the animation scales.
  root: HTMLElement | null;
  getInput(): HTMLInputElement | null;
}

function createSearchFocusPress(deps: FocusPressDeps) {
  const { root, getInput } = deps;
  let clearTimer = 0;

  function clear(): void {
    if (clearTimer) {
      window.clearTimeout(clearTimer);
      clearTimer = 0;
    }
    if (root) {
      root.removeAttribute(FOCUS_PRESS_ATTRIBUTE);
    }
  }

  // The results are placed from the box's measured rect, so the box keeps
  // its size while they are or will be open.
  function canPlay(): boolean {
    if (!root || !document.body) {
      return false;
    }
    if (document.body.getAttribute('data-nt-enter') === 'run' ||
        document.body.getAttribute('data-nt-suggestions-open') === 'true') {
      return false;
    }
    const input = getInput();
    return Boolean(input) && !String(input?.value || '').trim();
  }

  function play(): void {
    if (!root || !canPlay()) {
      return;
    }
    clear();
    // Restart the animation when a press lands while one is still running.
    void root.offsetWidth;
    root.setAttribute(FOCUS_PRESS_ATTRIBUTE, 'run');
    clearTimer = window.setTimeout(clear, FOCUS_PRESS_FALLBACK_MS);
  }

  if (root) {
    root.addEventListener('animationend', (event) => {
      if (event.target === root && root.getAttribute(FOCUS_PRESS_ATTRIBUTE) === 'run') {
        clear();
      }
    });
  }

  // A press on the field itself, when it does not have focus yet.
  function handleInputPointerDown(event: PointerEvent): void {
    if (event.button !== 0 || document.activeElement === event.currentTarget) {
      return;
    }
    play();
  }

  return { play, handleInputPointerDown };
}

type SearchFocusPress = ReturnType<typeof createSearchFocusPress>;

export { createSearchFocusPress, FOCUS_PRESS_ATTRIBUTE };
export type { SearchFocusPress, FocusPressDeps };
