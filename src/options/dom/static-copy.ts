// The copy of the page's own markup (the tab names, the version badge),
// which names its message in data-i18n attributes. React views draw their
// copy themselves; this fills in the rest whenever the language changes.
import { isHtmlTag } from '../../shared/dom-guards';
import type { FormatTemplate, GetMessage } from '../options-types';

// Values the messages may name, such as {browser}.
type TemplateValues = Record<string, string>;

function applyStaticCopy(
  doc: Document,
  getMessage: GetMessage,
  formatTemplate: FormatTemplate,
  templateValues: TemplateValues
): void {
  doc.querySelectorAll('[data-i18n]').forEach((node) => {
    const key = node.getAttribute('data-i18n');
    if (!key) {
      return;
    }
    const message = formatTemplate(getMessage(key, node.textContent || ''), templateValues);
    node.textContent = message;
    if (isHtmlTag(node, 'option')) {
      node.label = message;
    }
  });
  doc.querySelectorAll('[data-i18n-placeholder]').forEach((node) => {
    const key = node.getAttribute('data-i18n-placeholder');
    if (key) {
      node.setAttribute('placeholder', getMessage(key, node.getAttribute('placeholder') || ''));
    }
  });
  doc.querySelectorAll('[data-i18n-tooltip]').forEach((node) => {
    const key = node.getAttribute('data-i18n-tooltip');
    if (!key) {
      return;
    }
    const message = formatTemplate(getMessage(key, node.getAttribute('data-tooltip') || ''), templateValues);
    node.setAttribute('data-tooltip', message);
    if (node.getAttribute('title')) {
      node.removeAttribute('title');
    }
    if (node.getAttribute('aria-label')) {
      node.setAttribute('aria-label', message);
    }
  });
  doc.querySelectorAll('[data-i18n-aria-label]').forEach((node) => {
    const key = node.getAttribute('data-i18n-aria-label');
    if (key) {
      node.setAttribute('aria-label', getMessage(key, node.getAttribute('aria-label') || ''));
    }
  });
}

export { applyStaticCopy };
