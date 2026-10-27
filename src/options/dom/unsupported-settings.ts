// Settings this browser cannot honor stay visible but disabled, with the
// reason in a tooltip that follows the cursor: <div
// data-browser-unsupported="firefox" data-unsupported-reason-key="...">.
// The views that draw such rows disable their controls themselves.
import { isHtmlElement } from '../../shared/dom-guards';
import * as LumnoCursorTooltip from '../../shared/ui/cursor-tooltip';
import type { CursorTooltipController } from '../../shared/ui/cursor-tooltip-model';
import type { GetMessage } from '../options-types';

function markBrowserUnsupportedSettings(getMessage: GetMessage): void {
  const family = document.documentElement.getAttribute('data-browser-family');
  let reasonTooltip: CursorTooltipController | null = null;
  document.querySelectorAll('[data-browser-unsupported]').forEach((row) => {
    if (row.getAttribute('data-browser-unsupported') !== family) {
      return;
    }
    row.setAttribute('data-unsupported', 'true');
    row.setAttribute('aria-disabled', 'true');
    reasonTooltip = reasonTooltip || LumnoCursorTooltip.createController({
      documentObj: document,
      windowObj: window,
      id: '_x_extension_options_unsupported_cursor_tooltip_2026_unique_',
      appendTo: document.body,
      maxWidth: 360,
      offsetX: 14,
      offsetY: 16
    });
    const reasonKey = row.getAttribute('data-unsupported-reason-key') || '';
    if (isHtmlElement(row)) {
      reasonTooltip.bind(row, () => getMessage(reasonKey, ''));
    }
  });
}

export { markBrowserUnsupportedSettings };
