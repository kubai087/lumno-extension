import * as OverlayLifecycle from '../lifecycle';

// The anti-translate guard from lifecycle.ts, as far as the panel drives it.
interface AntiTranslateGuardControls {
  start(root: Element): void;
  stop(): void;
  pauseForScroll(): void;
  pauseForMutationBurst(): void;
}

interface PageGuardsDeps {
  window: Window & typeof globalThis;
}

// Keeps the host page out of the panel: no page translation inside it,
// and no other extension decorating its input.
function createPageGuards(deps: PageGuardsDeps) {
  const { window } = deps;

  function applyOverlayInputExtensionIsolation(input: Element | null): void {
    if (!input) {
      return;
    }
    const exclusionAttributes = {
      'data-1p-ignore': 'true',
      'data-op-ignore': 'true',
      'data-lpignore': 'true',
      'data-bwignore': 'true',
      'data-form-type': 'other',
      'data-gramm': 'false',
      'data-lt-active': 'false',
      'spellcheck': 'false',
      'writingsuggestions': 'false'
    };
    Object.entries(exclusionAttributes).forEach(([name, value]) => {
      input.setAttribute(name, value);
    });
  }

  // Tolerates a missing element, which some callers may still pass.
  function applyNoTranslate<T extends Element | null>(element: T): T {
    if (!element) {
      return element;
    }
    element.setAttribute('translate', 'no');
    element.setAttribute('lang', 'zxx');
    element.setAttribute('notranslate', '');
    element.setAttribute('data-no-translate', 'true');
    element.classList.add('notranslate');
    return element;
  }

  // Marks root and every element under it.
  function applyNoTranslateDeep<T extends Element | null>(root: T): T {
    if (!root) {
      return root;
    }
    applyNoTranslate(root);
    root.querySelectorAll('*').forEach((element) => {
      applyNoTranslate(element);
    });
    return root;
  }

  // The guard's hooks for nodes a translator rewrote; the panel has none to
  // put back.
  function restoreProtectedNode(node: Node): boolean {
    return false;
  }

  function restoreProtectedAncestors(node: Node, root: Node): boolean {
    return false;
  }

  function stopOverlayAntiTranslateObserver(): void {
    overlayAntiTranslateGuard.stop();
  }

  function pauseOverlayAntiTranslateObserverForScroll(): void {
    overlayAntiTranslateGuard.pauseForScroll();
  }

  function pauseOverlayAntiTranslateObserverForMutationBurst(): void {
    overlayAntiTranslateGuard.pauseForMutationBurst();
  }

  function startOverlayAntiTranslateObserver(root: Element): void {
    overlayAntiTranslateGuard.start(root);
  }

  // Puts back what a page's translator changed inside the panel.
  const overlayAntiTranslateGuard: AntiTranslateGuardControls = OverlayLifecycle.createAntiTranslateGuard(window, {
    applyNoTranslateDeep,
    restoreProtectedNode,
    restoreProtectedAncestors
  });

  return {
    applyOverlayInputExtensionIsolation,
    applyNoTranslate,
    applyNoTranslateDeep,
    restoreProtectedNode,
    restoreProtectedAncestors,
    stopOverlayAntiTranslateObserver,
    pauseOverlayAntiTranslateObserverForScroll,
    pauseOverlayAntiTranslateObserverForMutationBurst,
    startOverlayAntiTranslateObserver
  };
}

export { createPageGuards };
export type { AntiTranslateGuardControls, PageGuardsDeps };
