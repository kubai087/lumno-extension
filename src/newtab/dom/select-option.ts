// The option of a select menu that an event in the menu started on.
import { isElementNode } from '../../shared/dom-guards';

function getSelectOptionFromTarget(target: EventTarget | null): Element | null {
  return isElementNode(target) ? target.closest('._x_extension_select_option_2024_unique_') : null;
}

export { getSelectOptionFromTarget };
