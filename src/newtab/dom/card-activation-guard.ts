// A press made while a card context menu is open belongs to the menu:
// choosing an item, or dismissing it. So do presses shortly after it, the
// rest of a double-click or one through the fading menu. Cards ignore the
// press and the click it ends in, so none opens the card underneath.

const CONTEXT_MENU_CLICK_THROUGH_GUARD_MS = 500;
const CONTEXT_MENU_PRESS_CLICK_MAX_MS = 1000;
const OPEN_CONTEXT_MENU_SELECTOR = '.x-nt-shortcut-context-menu-portal[data-open="true"]';

interface CardActivationGuardOptions {
  documentObj: Pick<Document, 'addEventListener' | 'querySelector'>;
  now?: () => number;
}

function createCardActivationGuard(options: CardActivationGuardOptions) {
  const { documentObj } = options;
  const now = options.now || Date.now;
  let contextMenuPressedAt = 0;
  let lastPressAt = 0;
  let lastPressBelongsToMenu = false;

  documentObj.addEventListener('pointerdown', () => {
    const pressedAt = now();
    lastPressAt = pressedAt;
    lastPressBelongsToMenu = pressedAt - contextMenuPressedAt < CONTEXT_MENU_CLICK_THROUGH_GUARD_MS;
    if (documentObj.querySelector(OPEN_CONTEXT_MENU_SELECTOR)) {
      contextMenuPressedAt = pressedAt;
      lastPressBelongsToMenu = true;
    }
  }, true);

  // Whether the latest press, and the click that ends it, belong to a menu.
  function isCardActivationSuppressed(): boolean {
    return lastPressBelongsToMenu && now() - lastPressAt < CONTEXT_MENU_PRESS_CLICK_MAX_MS;
  }

  return { isCardActivationSuppressed };
}

export {
  CONTEXT_MENU_CLICK_THROUGH_GUARD_MS,
  CONTEXT_MENU_PRESS_CLICK_MAX_MS,
  createCardActivationGuard
};
