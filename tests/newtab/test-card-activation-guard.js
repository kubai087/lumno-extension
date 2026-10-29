const assert = require('assert');
const { JSDOM } = require('jsdom');
const guardModule = require('../../src/newtab/dom/card-activation-guard.ts');

// Presses that belong to a card context menu (made while it is open, or
// just after, through the fading menu) must not open the card underneath.

const dom = new JSDOM('<!doctype html><body><div class="x-nt-shortcut-context-menu-portal"></div></body>');
const { document } = dom.window;
const menu = document.querySelector('.x-nt-shortcut-context-menu-portal');
let now = 1_000_000;
const guard = guardModule.createCardActivationGuard({ documentObj: document, now: () => now });
const press = () => document.dispatchEvent(new dom.window.Event('pointerdown'));

assert.strictEqual(guard.isCardActivationSuppressed(), false, 'nothing is suppressed before a press');

press();
assert.strictEqual(guard.isCardActivationSuppressed(), false, 'a press with no menu open opens the card');

menu.setAttribute('data-open', 'true');
press();
assert.strictEqual(guard.isCardActivationSuppressed(), true, 'a press while the menu is open belongs to it');
now += guardModule.CONTEXT_MENU_PRESS_CLICK_MAX_MS - 1;
assert.strictEqual(guard.isCardActivationSuppressed(), true, 'so does the click it ends in');
now += 1;
assert.strictEqual(guard.isCardActivationSuppressed(), false, 'a click long after the press is the card\'s own');

// The menu fades out: a press just after it closed still belongs to it.
menu.setAttribute('data-open', 'false');
now += 100;
press();
assert.strictEqual(guard.isCardActivationSuppressed(), false,
  'the guard counts from the last press inside the menu, which is past');

menu.setAttribute('data-open', 'true');
press();
menu.setAttribute('data-open', 'false');
now += guardModule.CONTEXT_MENU_CLICK_THROUGH_GUARD_MS - 1;
press();
assert.strictEqual(guard.isCardActivationSuppressed(), true, 'a press through the fading menu belongs to it');
now += guardModule.CONTEXT_MENU_CLICK_THROUGH_GUARD_MS;
press();
assert.strictEqual(guard.isCardActivationSuppressed(), false, 'a later press opens the card again');

console.log('card activation guard tests passed');
