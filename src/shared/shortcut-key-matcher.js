const KEY_ALIASES = Object.freeze({
  tab: 'Tab',
  enter: 'Enter',
  return: 'Enter',
  esc: 'Escape',
  escape: 'Escape',
  space: ' ',
  spacebar: ' ',
  up: 'ArrowUp',
  down: 'ArrowDown',
  left: 'ArrowLeft',
  right: 'ArrowRight',
  arrowup: 'ArrowUp',
  arrowdown: 'ArrowDown',
  arrowleft: 'ArrowLeft',
  arrowright: 'ArrowRight',
  comma: ',',
  period: '.',
  slash: '/',
  semicolon: ';',
  quote: '\'',
  minus: '-',
  plus: '+',
  equal: '+',
  backslash: '\\',
  backquote: '`',
  bracketleft: '[',
  bracketright: ']'
});

const CODE_ALIASES = Object.freeze({
  Backquote: '`',
  Minus: '-',
  Equal: '+',
  BracketLeft: '[',
  BracketRight: ']',
  Backslash: '\\',
  Semicolon: ';',
  Quote: '\'',
  Comma: ',',
  Period: '.',
  Slash: '/',
  Space: ' ',
  Tab: 'Tab',
  Enter: 'Enter',
  Escape: 'Escape',
  ArrowUp: 'ArrowUp',
  ArrowDown: 'ArrowDown',
  ArrowLeft: 'ArrowLeft',
  ArrowRight: 'ArrowRight'
});

function parseShortcut(shortcut) {
  let value = String(shortcut || '').trim().replace(/\s*\+\s*/g, '+');
  if (!value || value.includes('%')) {
    return null;
  }
  const compactMacMatch = value.match(/^([⌘⇧⌃⌥]+)(.+)$/);
  if (compactMacMatch) {
    value = `${Array.from(compactMacMatch[1]).join('+')}+${compactMacMatch[2]}`;
  }
  const parts = value
    .split('+')
    .map((item) => String(item || '').trim())
    .filter(Boolean);
  if (parts.length === 0) {
    return null;
  }
  const keyToken = parts.pop();
  const spec = {
    ctrl: false,
    alt: false,
    shift: false,
    meta: false,
    key: ''
  };
  for (const token of parts) {
    const normalized = token.toLowerCase();
    if (normalized === 'ctrl' || normalized === 'control' || normalized === 'macctrl' || token === '⌃') {
      spec.ctrl = true;
    } else if (normalized === 'alt' || normalized === 'option' || token === '⌥') {
      spec.alt = true;
    } else if (normalized === 'shift' || token === '⇧') {
      spec.shift = true;
    } else if (normalized === 'command' || normalized === 'cmd' ||
        normalized === 'meta' || normalized === 'super' || token === '⌘') {
      spec.meta = true;
    } else {
      return null;
    }
  }
  const normalizedKey = keyToken.toLowerCase();
  if (KEY_ALIASES[normalizedKey]) {
    spec.key = KEY_ALIASES[normalizedKey];
  } else if (/^f\d{1,2}$/.test(normalizedKey)) {
    spec.key = normalizedKey.toUpperCase();
  } else {
    spec.key = normalizedKey.length === 1 ? normalizedKey : keyToken;
  }
  return spec.key ? spec : null;
}

function getKeyFromCode(rawCode) {
  const code = String(rawCode || '').trim();
  if (/^Key[A-Z]$/.test(code)) {
    return code.slice(3).toLowerCase();
  }
  if (/^Digit\d$/.test(code)) {
    return code.slice(5);
  }
  if (CODE_ALIASES[code]) {
    return CODE_ALIASES[code];
  }
  return /^F\d{1,2}$/.test(code) ? code.toUpperCase() : '';
}

function describeKeyboardEvent(event) {
  if (!event) {
    return null;
  }
  const key = getKeyFromCode(event.code) || String(event.key || '');
  if (!key) {
    return null;
  }
  return {
    ctrlKey: Boolean(event.ctrlKey),
    altKey: Boolean(event.altKey),
    shiftKey: Boolean(event.shiftKey),
    metaKey: Boolean(event.metaKey),
    key
  };
}

function descriptorMatchesShortcut(descriptor, shortcutOrSpec) {
  const spec = typeof shortcutOrSpec === 'string'
    ? parseShortcut(shortcutOrSpec)
    : shortcutOrSpec;
  if (!descriptor || !spec ||
      Boolean(descriptor.ctrlKey) !== spec.ctrl ||
      Boolean(descriptor.altKey) !== spec.alt ||
      Boolean(descriptor.shiftKey) !== spec.shift ||
      Boolean(descriptor.metaKey) !== spec.meta) {
    return false;
  }
  const eventKey = String(descriptor.key || '');
  if (spec.key.length === 1) {
    return eventKey.toLowerCase() === spec.key;
  }
  if (spec.key.startsWith('F')) {
    return eventKey.toUpperCase() === spec.key;
  }
  return eventKey === spec.key;
}

function eventMatchesShortcut(event, shortcutOrSpec) {
  return descriptorMatchesShortcut(describeKeyboardEvent(event), shortcutOrSpec);
}

function canBeChromeCommandShortcut(descriptor) {
  if (!descriptor || !String(descriptor.key || '')) {
    return false;
  }
  return Boolean(descriptor.ctrlKey || descriptor.altKey || descriptor.metaKey) ||
    /^F\d{1,2}$/.test(String(descriptor.key));
}

// Ctrl+Tab is a page shortcut: keep form navigation and editor shortcuts.
// composedPath also checks controls and editor hosts in shadow DOM.
function isTabSwitcherCtrlTabEvent(event, options) {
  // Pawgic maps the browser-reserved Ctrl+Tab to Ctrl+Q on macOS.
  const mappedTab = event && String(event.key).toLowerCase() === 'q';
  if (!event || event.isTrusted !== true || event.isComposing || event.repeat ||
      (event.key !== 'Tab' && !mappedTab) || !event.ctrlKey || event.altKey || event.metaKey) {
    return false;
  }
  if (mappedTab) return true;
  const path = typeof event.composedPath === 'function' ? event.composedPath() : [event.target];
  return !path.some((element) => element &&
    !(options && options.allowNewtabSearch === true && element.id === '_x_extension_newtab_search_input_2024_unique_') &&
    (element.id === '_x_extension_overlay_host_2026_unique_' ||
      element.isContentEditable || (typeof element.closest === 'function' &&
      element.closest('input, textarea, select, [contenteditable]:not([contenteditable="false"]), [role="textbox"], [role="combobox"]'))));
}

export {
  parseShortcut,
  getKeyFromCode,
  describeKeyboardEvent,
  descriptorMatchesShortcut,
  eventMatchesShortcut,
  canBeChromeCommandShortcut,
  isTabSwitcherCtrlTabEvent
};
