const assert = require('assert');
const fs = require('fs');
const path = require('path');

require(path.join('..', 'src', 'newtab', 'bookmarks-view.js'));

const newtabJs = fs.readFileSync(
  path.join(__dirname, '..', 'src', 'newtab', 'newtab.js'),
  'utf8'
).replace(/\r\n/g, '\n');

assert.ok(
  newtabJs.includes(
    "if (bookmarkSection && (target === bookmarkSection || bookmarkSection.contains(target))) {\n      return false;\n    }"
  ),
  'bookmark interactions should not trigger background search focus'
);

const { createBookmarksView } = globalThis.LumnoNewtabBookmarksView;

function createFakeEvent(type, values) {
  return {
    type,
    ...(values || {})
  };
}

function createFakeElement(tagName) {
  const children = [];
  const listeners = new Map();
  const attributes = new Map();
  const classes = new Set();
  const styleValues = new Map();
  let classNameValue = '';
  let textContentValue = '';
  const element = {
    tagName: String(tagName || '').toUpperCase(),
    children,
    childNodes: children,
    parentNode: null,
    innerHTML: '',
    title: '',
    type: '',
    tabIndex: 0,
    scrollWidth: 0,
    clientWidth: 0,
    get className() {
      return classNameValue;
    },
    set className(value) {
      classNameValue = String(value || '');
      classes.clear();
      classNameValue.split(/\s+/).filter(Boolean).forEach((part) => classes.add(part));
    },
    get textContent() {
      return textContentValue || children.map((child) => child.textContent || '').join('');
    },
    set textContent(value) {
      textContentValue = String(value || '');
    },
    get isConnected() {
      return true;
    },
    classList: {
      add: (...names) => {
        names.forEach((name) => classes.add(String(name)));
        classNameValue = Array.from(classes).join(' ');
      },
      remove: (...names) => {
        names.forEach((name) => classes.delete(String(name)));
        classNameValue = Array.from(classes).join(' ');
      },
      contains: (name) => classes.has(String(name)),
      toggle: (name, force) => {
        const className = String(name);
        const shouldAdd = force === undefined ? !classes.has(className) : Boolean(force);
        if (shouldAdd) {
          classes.add(className);
        } else {
          classes.delete(className);
        }
        classNameValue = Array.from(classes).join(' ');
        return shouldAdd;
      }
    },
    style: {
      setProperty: (name, value) => styleValues.set(name, String(value)),
      removeProperty: (name) => styleValues.delete(name),
      getPropertyValue: (name) => styleValues.get(name) || ''
    },
    appendChild(child) {
      child.parentNode = element;
      children.push(child);
      return child;
    },
    setAttribute(name, value) {
      attributes.set(String(name), String(value));
    },
    getAttribute(name) {
      return attributes.get(String(name)) || '';
    },
    addEventListener(type, listener) {
      const eventName = String(type || '');
      listeners.set(eventName, [...(listeners.get(eventName) || []), listener]);
    },
    dispatchEvent(event) {
      const nextEvent = event || createFakeEvent('');
      nextEvent.target = nextEvent.target || element;
      (listeners.get(nextEvent.type) || []).forEach((listener) => listener(nextEvent));
      return true;
    },
    querySelector() {
      return null;
    }
  };
  return element;
}

const documentObj = {
  createElement: createFakeElement
};
const windowObj = {
  setTimeout,
  clearTimeout
};
const openedFolders = [];
const morphStates = [];
const view = createBookmarksView({
  documentObj,
  windowObj,
  grid: createFakeElement('div'),
  cards: [],
  cardElementCache: new Map(),
  t: (_key, fallback) => fallback || '',
  formatMessage: (_key, fallback, values) => fallback.replace('{title}', values.title),
  sanitizeDisplayText: (value) => String(value || ''),
  getHostFromUrl: () => '',
  getSiteDisplayName: (_host, title) => title || '',
  getUrlDisplay: (url) => url,
  getRiSvg: () => '',
  getFigmaFolderSvg: () => '',
  initFolderPathMorph() {},
  playFolderPathMorph: (_folderIcon, active) => {
    morphStates.push(Boolean(active));
  },
  stableHashCode: () => 0,
  normalizeHost: (host) => host,
  attachFaviconWithFallbacks() {},
  getImmediateThemeForSuggestion: () => null,
  queueThemeForTarget() {},
  applyCardTheme() {},
  shouldDelayHoverFromRecent: () => false,
  bindCursorTooltip() {},
  hideCursorTooltip() {},
  openFolder() {},
  openFolderMenu: (item, card) => {
    openedFolders.push({ item, card });
  },
  navigateToUrl() {}
});

const card = view.buildCard(
  { id: 'design', title: 'Design', type: 'folder', previewUrls: [] },
  0,
  { viewMode: 'list', menuMode: true }
);

card.dispatchEvent(createFakeEvent('click'));
assert.strictEqual(openedFolders.length, 1, 'clicking a list-mode folder should open its cascade menu');
assert.strictEqual(
  card.classList.contains('x-nt-bookmark-card--hover'),
  true,
  'clicking a folder menu trigger should immediately set the active visual state'
);

card.setAttribute('aria-expanded', 'true');
card.dispatchEvent(createFakeEvent('pointerleave'));
assert.strictEqual(
  card.classList.contains('x-nt-bookmark-card--hover'),
  true,
  'folder trigger should keep its active visual state while the cascade menu remains expanded'
);

card.dispatchEvent(createFakeEvent('blur'));
assert.strictEqual(
  card.classList.contains('x-nt-bookmark-card--hover'),
  true,
  'folder trigger should keep its active visual state when focus moves into the cascade menu'
);

assert.strictEqual(
  typeof card._xSetBookmarkMenuVisualActive,
  'function',
  'bookmark folder cards should expose a cascade-menu visual-state hook'
);
card.setAttribute('aria-expanded', 'false');
card._xSetBookmarkMenuVisualActive(false);
assert.strictEqual(
  card.classList.contains('x-nt-bookmark-card--hover'),
  false,
  'folder trigger should release its active visual state when the cascade menu closes'
);
assert.deepStrictEqual(
  morphStates,
  [true, false],
  'folder icon morph should follow the locked active state and release on close'
);

console.log('newtab bookmark folder menu state tests passed');
