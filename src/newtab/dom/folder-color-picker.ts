// The folder color dialog's parts the picker moves focus to and animates.
import { queryHtmlElement, queryHtmlTags } from '../../shared/dom-lookup';

function getFolderColorBackdrop(host: HTMLElement): HTMLElement | null {
  return queryHtmlElement(host, '.x-nt-folder-color-backdrop');
}

function getFolderColorDialog(host: HTMLElement): HTMLElement | null {
  return queryHtmlElement(host, '.x-nt-folder-color-dialog');
}

// Where focus rests when the dialog opens: the chosen swatch, or the
// saturation area for a custom color.
function getCurrentColorControl(editor: HTMLElement): HTMLElement | null {
  return queryHtmlElement(editor, '.x-nt-folder-color-swatch[aria-pressed="true"]') ||
    queryHtmlElement(editor, '.react-colorful__saturation .react-colorful__interactive');
}

function getSavedColorSwatches(savedColors: HTMLElement): HTMLButtonElement[] {
  return queryHtmlTags(savedColors, '.x-nt-folder-color-saved-item .x-nt-folder-color-swatch', 'button');
}

export { getCurrentColorControl, getFolderColorBackdrop, getFolderColorDialog, getSavedColorSwatches };
