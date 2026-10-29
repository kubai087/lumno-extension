// The parts of the page's select menus: the native select and trigger in a
// menu's host, and the menu surfaces portaled to the body.
import { queryHtmlElement, queryHtmlElements, queryHtmlTag } from '../../shared/dom-lookup';

function getSelectElement(host: HTMLElement): HTMLSelectElement | null {
  return queryHtmlTag(host, 'select', 'select');
}

// The button that opens the menu drawn in `host`.
function getSelectTrigger(host: HTMLElement | null): HTMLButtonElement | null {
  return host ? queryHtmlTag(host, 'button', 'button') : null;
}

// The menu surface a select with this id owns.
function getSelectMenuByOwner(doc: Document, id: string): HTMLElement | null {
  return queryHtmlElement(doc, `[data-react-select-owner="${id}"]`);
}

// A menu surface in the body that no select has claimed yet.
function getUnclaimedSelectMenu(doc: Document): HTMLElement | null {
  return queryHtmlElements(doc, 'body > ._x_extension_select_menu_2024_unique_')
    .find((candidate) => !candidate.dataset.reactSelectClaimed) || null;
}

export { getSelectElement, getSelectMenuByOwner, getSelectTrigger, getUnclaimedSelectMenu };
