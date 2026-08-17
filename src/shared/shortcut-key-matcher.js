(function(root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) {
    module.exports = api;
  }
  root.LumnoShortcutKeyMatcher = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function() {
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
    comma: ',',
    period: '.',
    slash: '/',
    semicolon: ';',
    quote: '\'',
    minus: '-',
    plus: '+',
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
    const value = String(shortcut || '').trim();
    if (!value || value.includes('%')) {
      return null;
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
      if (normalized === 'ctrl' || normalized === 'control' || normalized === 'macctrl') {
        spec.ctrl = true;
      } else if (normalized === 'alt' || normalized === 'option') {
        spec.alt = true;
      } else if (normalized === 'shift') {
        spec.shift = true;
      } else if (normalized === 'command' || normalized === 'cmd' ||
          normalized === 'meta' || normalized === 'super') {
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

  function canBeChromeCommandShortcut(descriptor) {
    if (!descriptor || !String(descriptor.key || '')) {
      return false;
    }
    return Boolean(descriptor.ctrlKey || descriptor.altKey || descriptor.metaKey) ||
      /^F\d{1,2}$/.test(String(descriptor.key));
  }

  return Object.freeze({
    parseShortcut,
    getKeyFromCode,
    describeKeyboardEvent,
    descriptorMatchesShortcut,
    canBeChromeCommandShortcut
  });
});
