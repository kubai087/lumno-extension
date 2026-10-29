// Focus inside the page's dialogs: the controls Tab moves between and where
// focus lands.
import { queryHtmlElements, queryHtmlTag, queryHtmlTags } from '../../shared/dom-lookup';

// The enabled controls focus can reach, leaving out what an inert part holds.
function getFocusableControls(root: HTMLElement): HTMLElement[] {
  return queryHtmlElements(root, 'button:not(:disabled), input:not(:disabled), [tabindex="0"]')
    .filter((element) => !element.closest('[inert]'));
}

function getEnabledButtons(root: HTMLElement): HTMLButtonElement[] {
  return queryHtmlTags(root, 'button:not(:disabled)', 'button');
}

// Whether a form part is busy (its fieldset disabled while it saves).
function hasDisabledFieldset(root: HTMLElement): boolean {
  return Boolean(root.querySelector('fieldset:disabled'));
}

// The change history dialog's close button, where focus lands as it opens.
function getHistoryCloseButton(host: HTMLElement): HTMLButtonElement | null {
  return queryHtmlTag(host, '.x-nt-recent-history-close', 'button');
}

export { getEnabledButtons, getFocusableControls, getHistoryCloseButton, hasDisabledFieldset };
