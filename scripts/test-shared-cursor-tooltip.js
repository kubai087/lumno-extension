const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { readNewtabRuntimeSource } = require('./helpers/newtab-source');

const repoRoot = path.resolve(__dirname, '..');
const tooltipJsPath = path.join(repoRoot, 'src/shared/tooltip.js');
const cursorTooltipJsPath = path.join(repoRoot, 'src/shared/cursor-tooltip.js');
const cursorTooltipCssPath = path.join(repoRoot, 'src/shared/cursor-tooltip.css');
const newtabHtmlPath = path.join(repoRoot, 'newtab.html');

global.LumnoTooltipView = {
  implementation: 'react-test-double',
  createTooltipElement(options) {
    const element = options.documentObj.createElement('div');
    element.id = options.id || '';
    element.classList.add('_x_extension_tooltip_2026_unique_');
    if (options.className) {
      String(options.className).split(/\s+/).filter(Boolean)
        .forEach((name) => element.classList.add(name));
    }
    element.setAttribute('data-react-island', 'tooltip');
    element.setAttribute('data-visible', 'false');
    element.setAttribute('aria-hidden', 'true');
    element.setAttribute('data-tooltip-position', options.positionMode === 'absolute' ? 'absolute' : 'fixed');
    if (options.kind) {
      element.setAttribute('data-tooltip-kind', options.kind);
    }
    return element;
  },
  destroyTooltipElement() {},
  renderTooltipText(element, text) {
    element.replaceChildren();
    const child = element.ownerDocument.createElement('span');
    child.classList.add('_x_extension_tooltip_line_2026_unique_');
    child.textContent = String(text || '');
    element.appendChild(child);
    return element;
  },
  renderCursorTag(element, model) {
    element.replaceChildren();
    const key = element.ownerDocument.createElement('span');
    key.classList.add('_x_extension_cursor_tooltip_tag_key_2026_unique_');
    key.setAttribute('data-cursor-tooltip-tag-key', model.keyText);
    if (model.windowsLogo) {
      const logo = element.ownerDocument.createElement('span');
      logo.classList.add('_x_extension_cursor_tooltip_windows_logo_2026_unique_');
      for (let index = 0; index < 4; index += 1) {
        const pane = element.ownerDocument.createElement('span');
        pane.classList.add('_x_extension_cursor_tooltip_windows_logo_pane_2026_unique_');
        logo.appendChild(pane);
      }
      key.appendChild(logo);
    } else {
      key.textContent = model.keyText;
    }
    const label = element.ownerDocument.createElement('span');
    label.classList.add('_x_extension_cursor_tooltip_tag_label_2026_unique_');
    label.textContent = model.label;
    element.appendChild(key);
    element.appendChild(label);
    return element;
  }
};

assert.ok(fs.existsSync(cursorTooltipJsPath), 'cursor-following tooltip should live in src/shared/cursor-tooltip.js');
assert.ok(fs.existsSync(cursorTooltipCssPath), 'cursor-following tooltip styling should live in src/shared/cursor-tooltip.css');

require(tooltipJsPath);
const cursorTooltip = require(cursorTooltipJsPath);
const cursorTooltipCss = fs.readFileSync(cursorTooltipCssPath, 'utf8');

assert.strictEqual(
  cursorTooltip.hostClassName,
  '_x_extension_cursor_tooltip_host_2026_unique_',
  'cursor tooltip should expose a stable host CSS class'
);
assert.strictEqual(typeof cursorTooltip.createController, 'function', 'cursor tooltip should expose createController()');
assert.strictEqual(typeof cursorTooltip.positionAtPoint, 'function', 'cursor tooltip should expose positionAtPoint()');
assert.strictEqual(
  cursorTooltip.isElementTextTruncated({ clientWidth: 48, scrollWidth: 49 }),
  true,
  'a one-pixel horizontal overflow should still count as truncated'
);
assert.strictEqual(
  cursorTooltip.isElementTextTruncated({ clientWidth: 48, scrollWidth: 48 }),
  false,
  'equal horizontal dimensions should not count as truncated'
);
assert.strictEqual(
  cursorTooltip.isElementTextTruncated(
    { clientWidth: 48, scrollWidth: 48, clientHeight: 20, scrollHeight: 21 },
    { vertical: true }
  ),
  true,
  'callers can opt into vertical truncation checks for clamped text'
);
assert.ok(
  cursorTooltipCss.includes('._x_extension_cursor_tooltip_host_2026_unique_[data-cursor-tooltip]'),
  'cursor tooltip CSS should suppress native pseudo tips for cursor tooltip hosts'
);
assert.ok(
  cursorTooltipCss.includes('[data-tooltip-kind="cursor"]'),
  'cursor tooltip CSS should identify cursor-following tooltip instances'
);
assert.ok(
  cursorTooltipCss.includes('._x_extension_cursor_tooltip_tag_2026_unique_'),
  'cursor tooltip CSS should style separate action tag bubbles'
);
assert.ok(
  cursorTooltipCss.includes('[data-tooltip-kind="cursor-tag"]'),
  'cursor tooltip CSS should identify separate cursor action tag bubbles'
);
assert.ok(
  cursorTooltipCss.includes('._x_extension_cursor_tooltip_tag_key_2026_unique_'),
  'cursor tooltip CSS should style the action tag keycap'
);
assert.ok(
  /flex:\s*0 0 var\(--x-extension-cursor-tooltip-key-size/.test(cursorTooltipCss) &&
    /width:\s*var\(--x-extension-cursor-tooltip-key-size/.test(cursorTooltipCss) &&
    /height:\s*var\(--x-extension-cursor-tooltip-key-size/.test(cursorTooltipCss),
  'cursor tooltip keycap should keep a fixed square footprint'
);
assert.ok(
  cursorTooltipCss.includes('._x_extension_cursor_tooltip_windows_logo_2026_unique_') &&
    cursorTooltipCss.includes('._x_extension_cursor_tooltip_windows_logo_pane_2026_unique_') &&
    cursorTooltipCss.includes('position: relative') &&
    cursorTooltipCss.includes('position: absolute') &&
    cursorTooltipCss.includes('clip-path: polygon('),
  'cursor tooltip CSS should draw the Windows keycap as shaped perspective panes'
);
assert.ok(
  /padding:\s*6px 12px 6px 7px/.test(cursorTooltipCss) &&
    /gap:\s*8px/.test(cursorTooltipCss) &&
    /transform:\s*translateY\(-1px\)/.test(cursorTooltipCss),
  'cursor tooltip action tag should have looser spacing and a slightly raised keycap'
);

function createFakeElement(tagName) {
  const children = [];
  const attributes = new Map();
  const classes = new Set();
  const properties = new Map();
  const listeners = new Map();
  const setAttributeLog = [];
  const element = {
    tagName,
    children,
    parentNode: null,
    isConnected: true,
    ownerDocument: null,
    className: '',
    textContent: '',
    setAttributeLog,
    classList: {
      add: (...names) => names.forEach((name) => {
        classes.add(name);
      }),
      contains: (name) => classes.has(name)
    },
    style: {
      setProperty: (name, value) => properties.set(name, value),
      getPropertyValue: (name) => properties.get(name) || ''
    },
    appendChild: (child) => {
      if (child && typeof child === 'object') {
        child.parentNode = element;
      }
      children.push(child);
      return child;
    },
    replaceChildren: (...nodes) => {
      children.length = 0;
      nodes.forEach((node) => {
        if (node && typeof node === 'object') {
          node.parentNode = element;
        }
        children.push(node);
      });
    },
    setAttribute: (name, value) => {
      const entry = { name, value: String(value) };
      setAttributeLog.push(entry);
      attributes.set(name, entry.value);
    },
    getAttribute: (name) => attributes.get(name) || '',
    removeAttribute: (name) => attributes.delete(name),
    contains: (node) => node === element || children.includes(node),
    addEventListener: (type, listener) => {
      const current = listeners.get(type) || [];
      current.push(listener);
      listeners.set(type, current);
    },
    dispatchFakeEvent: (type, event) => {
      (listeners.get(type) || []).forEach((listener) => listener(event || {}));
    },
    matches: () => true,
    getBoundingClientRect: () => ({ top: 80, left: 120, right: 152, bottom: 112, width: 32, height: 32 })
  };
  return element;
}

const fakeDocument = {
  activeElement: null,
  body: null,
  createElement(tagName) {
    const element = createFakeElement(tagName);
    element.ownerDocument = fakeDocument;
    return element;
  },
  querySelectorAll: () => []
};
fakeDocument.body = createFakeElement('body');
fakeDocument.body.ownerDocument = fakeDocument;

function getCursorTagElement() {
  return fakeDocument.body.children.find((child) =>
    child &&
    child.classList &&
    child.classList.contains(cursorTooltip.tagClassName)
  ) || null;
}

function getCursorTagKeyElement(tag) {
  return tag && tag.children
    ? tag.children.find((child) =>
      child &&
      child.classList &&
      child.classList.contains('_x_extension_cursor_tooltip_tag_key_2026_unique_')
    ) || null
    : null;
}

function getCursorTagLabelElement(tag) {
  return tag && tag.children
    ? tag.children.find((child) =>
      child &&
      child.classList &&
      child.classList.contains('_x_extension_cursor_tooltip_tag_label_2026_unique_')
    ) || null
    : null;
}

function getWindowsLogoElement(key) {
  return key && key.children
    ? key.children.find((child) =>
      child &&
      child.classList &&
      child.classList.contains('_x_extension_cursor_tooltip_windows_logo_2026_unique_')
    ) || null
    : null;
}

function hasInlineCursorTag(parent) {
  return Boolean(parent && parent.children && parent.children.some((child) =>
    child &&
    child.classList &&
    child.classList.contains(cursorTooltip.tagClassName)
  ));
}

const fakeWindowListeners = new Map();
const fakeWindow = {
  innerWidth: 320,
  innerHeight: 240,
  requestAnimationFrame: (callback) => callback(),
  setTimeout: (callback) => {
    callback();
    return 1;
  },
  clearTimeout: () => {},
  navigator: {
    platform: 'MacIntel',
    userAgent: 'Macintosh'
  },
  addEventListener: (type, listener) => {
    const current = fakeWindowListeners.get(type) || [];
    current.push(listener);
    fakeWindowListeners.set(type, current);
  },
  dispatchFakeEvent: (type, event) => {
    const nextEvent = Object.assign({ type }, event || {});
    (fakeWindowListeners.get(type) || []).forEach((listener) => listener(nextEvent));
  }
};

const controller = cursorTooltip.createController({
  documentObj: fakeDocument,
  windowObj: fakeWindow,
  id: '_x_extension_test_cursor_tooltip_2026_unique_'
});

const target = createFakeElement('button');
target.ownerDocument = fakeDocument;
assert.strictEqual(
  controller.show(target, 'A very long bookmark title', { clientX: 100, clientY: 120 }, {
    checkActive: false,
    shouldShow: () => false
  }),
  null,
  'cursor tooltip should not render when shouldShow returns false'
);

const element = controller.show(target, 'A very long bookmark title', { clientX: 100, clientY: 120 }, {
  checkActive: false,
  shouldShow: () => true
});
assert.ok(element.classList.contains('_x_extension_tooltip_2026_unique_'), 'cursor tooltip should reuse shared tooltip styling');
assert.strictEqual(element.getAttribute('data-tooltip-kind'), 'cursor', 'cursor tooltip should mark the tooltip kind');
assert.strictEqual(element.getAttribute('data-visible'), 'true', 'cursor show() should mark tooltip visible');
assert.strictEqual(element.style.getPropertyValue('left'), '114px', 'cursor tooltip should offset from pointer x');
assert.strictEqual(element.style.getPropertyValue('top'), '136px', 'cursor tooltip should offset from pointer y');
controller.show(target, '我觉得完整标题', { clientX: 100, clientY: 120 }, {
  checkActive: false
});
assert.strictEqual(
  element.children[0].textContent,
  '我觉得完整标题',
  'cursor tooltip text should be rendered by the shared React view'
);
controller.show(target, 'A very long bookmark title', { clientX: 100, clientY: 120 }, {
  checkActive: false,
  tagText: '后台打开'
});
let tagElement = getCursorTagElement();
assert.strictEqual(
  element.getAttribute('data-cursor-tooltip-tag-visible'),
  'true',
  'cursor tooltip should mark tag visibility when a tag is rendered'
);
assert.ok(tagElement, 'cursor tooltip should render the action tag as a separate bubble');
assert.notStrictEqual(tagElement, element, 'cursor tooltip action tag should not reuse the main tooltip bubble');
assert.strictEqual(
  hasInlineCursorTag(element),
  false,
  'cursor tooltip should not append the action tag inside the main tooltip bubble'
);
assert.strictEqual(
  getCursorTagKeyElement(tagElement).textContent,
  '⌘',
  'cursor tooltip should prefix the action tag with a Mac command keycap'
);
assert.strictEqual(
  getCursorTagLabelElement(tagElement).textContent,
  '后台打开',
  'cursor tooltip should render the requested action text after the keycap'
);
assert.strictEqual(
  tagElement.getAttribute('data-visible'),
  'true',
  'cursor tooltip should show the separate tag bubble when tag text is present'
);
assert.ok(
  Number.parseInt(tagElement.style.getPropertyValue('top'), 10) <
    Number.parseInt(element.style.getPropertyValue('top'), 10),
  'cursor tooltip action tag bubble should sit above the main cursor bubble'
);
controller.move({ clientX: 50, clientY: 60 });
assert.strictEqual(element.style.getPropertyValue('left'), '64px', 'cursor tooltip should follow pointer x movement');
assert.strictEqual(element.style.getPropertyValue('top'), '76px', 'cursor tooltip should follow pointer y movement');
assert.strictEqual(
  tagElement.getAttribute('data-visible'),
  'false',
  'cursor tooltip should hide the separate tag bubble when tag text is not present'
);
controller.hide();
assert.strictEqual(element.getAttribute('data-visible'), 'false', 'cursor hide() should mark tooltip hidden');
assert.strictEqual(tagElement.getAttribute('data-visible'), 'false', 'cursor hide() should hide the separate tag bubble');

target.setAttribute('title', 'Native title');
let shouldShowCalls = 0;
controller.bind(target, () => 'Bound title', {
  checkActive: false,
  shouldShow: () => {
    shouldShowCalls += 1;
    return false;
  }
});
assert.strictEqual(target.getAttribute('title'), '', 'cursor tooltip binding should suppress native title duplication');
target.dispatchFakeEvent('pointerenter', { clientX: 140, clientY: 90 });
assert.strictEqual(shouldShowCalls, 1, 'cursor tooltip binding should consult shouldShow before showing');
assert.strictEqual(element.getAttribute('data-visible'), 'false', 'bound cursor tooltip should stay hidden when shouldShow returns false');

const modifierTarget = createFakeElement('button');
modifierTarget.ownerDocument = fakeDocument;
controller.bind(modifierTarget, () => 'Modifier title', {
  checkActive: false,
  shouldShow: (_target, event) => Boolean(event && event.metaKey),
  getTagText: (event) => event && event.metaKey ? '后台打开' : ''
});
modifierTarget.dispatchFakeEvent('pointerenter', { clientX: 140, clientY: 90, metaKey: true });
assert.strictEqual(
  element.getAttribute('data-visible'),
  'true',
  'bound cursor tooltip should pass pointer modifiers into shouldShow'
);
assert.strictEqual(
  element.getAttribute('data-cursor-tooltip-tag-visible'),
  'true',
  'bound cursor tooltip should render a modifier-driven action tag'
);
assert.strictEqual(
  hasInlineCursorTag(element),
  false,
  'bound cursor tooltip should keep modifier tags outside the main tooltip bubble'
);
modifierTarget.dispatchFakeEvent('pointerleave');

const deferredTimers = [];
const switchWindow = Object.assign({}, fakeWindow, {
  setTimeout: (callback) => {
    deferredTimers.push(callback);
    return deferredTimers.length;
  },
  clearTimeout: () => {}
});
const switchController = cursorTooltip.createController({
  documentObj: fakeDocument,
  windowObj: switchWindow,
  id: '_x_extension_test_cursor_switch_tooltip_2026_unique_'
});
const switchRoot = createFakeElement('div');
switchRoot.ownerDocument = fakeDocument;
const switchTitleTarget = createFakeElement('span');
switchTitleTarget.ownerDocument = fakeDocument;
const switchUrlTarget = createFakeElement('span');
switchUrlTarget.ownerDocument = fakeDocument;
const unrelatedTarget = createFakeElement('span');
unrelatedTarget.ownerDocument = fakeDocument;
switchRoot.appendChild(switchTitleTarget);
switchRoot.appendChild(switchUrlTarget);
switchController.bind(switchTitleTarget, () => '完整标题', {
  checkActive: false,
  deferHideVisibility: true,
  preserveVisibleOnTargetSwitch: true
});
switchController.bind(switchUrlTarget, () => 'https://x.com/example/status/1', {
  checkActive: false,
  deferHideVisibility: true,
  preserveVisibleOnTargetSwitch: true
});
switchTitleTarget.dispatchFakeEvent('pointerenter', { clientX: 120, clientY: 100 });
const switchElement = switchController.element;
assert.strictEqual(
  switchElement.getAttribute('data-visible'),
  'true',
  'switching cursor tooltip should appear on the first truncated text target'
);
switchTitleTarget.dispatchFakeEvent('pointerleave', { relatedTarget: switchUrlTarget });
assert.strictEqual(
  switchElement.getAttribute('data-visible'),
  'true',
  'switching cursor tooltip should stay visible during a same-row title-to-URL handoff'
);
switchElement.setAttributeLog.length = 0;
switchUrlTarget.dispatchFakeEvent('pointerenter', { clientX: 180, clientY: 100 });
assert.strictEqual(
  switchElement.getAttribute('data-visible'),
  'true',
  'switching cursor tooltip should stay visible after moving to the next text target'
);
assert.strictEqual(
  switchElement.setAttributeLog.some((entry) => entry.name === 'data-visible' && entry.value === 'false'),
  false,
  'switching cursor tooltip should not replay the hidden state when moving between adjacent text targets'
);
assert.strictEqual(
  switchElement.children.map((child) => child.textContent || '').join(''),
  'https://x.com/example/status/1',
  'switching cursor tooltip should replace the bubble content directly'
);
switchTitleTarget.dispatchFakeEvent('pointermove', { clientX: 121, clientY: 100 });
assert.strictEqual(
  switchElement.children.map((child) => child.textContent || '').join(''),
  'https://x.com/example/status/1',
  'switching cursor tooltip should ignore stale move events from the previous text target'
);

const reversedTimers = [];
const reversedWindow = Object.assign({}, fakeWindow, {
  setTimeout: (callback) => {
    reversedTimers.push(callback);
    return reversedTimers.length;
  },
  clearTimeout: () => {}
});
const reversedController = cursorTooltip.createController({
  documentObj: fakeDocument,
  windowObj: reversedWindow,
  id: '_x_extension_test_cursor_reversed_switch_tooltip_2026_unique_'
});
const reversedRoot = createFakeElement('div');
reversedRoot.ownerDocument = fakeDocument;
const reversedTitleTarget = createFakeElement('span');
reversedTitleTarget.ownerDocument = fakeDocument;
const reversedUrlTarget = createFakeElement('span');
reversedUrlTarget.ownerDocument = fakeDocument;
reversedTitleTarget.getBoundingClientRect = () => ({ top: 80, left: 120, right: 170, bottom: 112, width: 50, height: 32 });
reversedUrlTarget.getBoundingClientRect = () => ({ top: 80, left: 176, right: 260, bottom: 112, width: 84, height: 32 });
reversedRoot.appendChild(reversedTitleTarget);
reversedRoot.appendChild(reversedUrlTarget);
reversedController.bind(reversedTitleTarget, () => '迟到标题', {
  checkActive: false,
  deferHideVisibility: true,
  preserveVisibleOnTargetSwitch: true
});
reversedController.bind(reversedUrlTarget, () => 'https://x.com/reversed/status/1', {
  checkActive: false,
  deferHideVisibility: true,
  preserveVisibleOnTargetSwitch: true
});
reversedTitleTarget.dispatchFakeEvent('pointerenter', { clientX: 120, clientY: 100 });
reversedUrlTarget.dispatchFakeEvent('pointerenter', { clientX: 180, clientY: 100, relatedTarget: reversedTitleTarget });
const reversedElement = reversedController.element;
assert.strictEqual(
  reversedElement.children.map((child) => child.textContent || '').join(''),
  'https://x.com/reversed/status/1',
  'switching cursor tooltip should show URL after URL pointerenter'
);
reversedTitleTarget.dispatchFakeEvent('pointerleave', { relatedTarget: reversedUrlTarget });
assert.strictEqual(
  reversedElement.children.map((child) => child.textContent || '').join(''),
  'https://x.com/reversed/status/1',
  'switching cursor tooltip should ignore a late title leave after URL entered'
);
reversedTitleTarget.dispatchFakeEvent('pointermove', { clientX: 121, clientY: 100 });
assert.strictEqual(
  reversedElement.children.map((child) => child.textContent || '').join(''),
  'https://x.com/reversed/status/1',
  'switching cursor tooltip should keep URL after stale title movement following a late leave'
);
reversedTitleTarget.dispatchFakeEvent('pointerenter', { clientX: 190, clientY: 100, relatedTarget: reversedUrlTarget });
assert.strictEqual(
  reversedElement.children.map((child) => child.textContent || '').join(''),
  'https://x.com/reversed/status/1',
  'switching cursor tooltip should ignore stale title enter events while the pointer is still over URL'
);
reversedTitleTarget.getBoundingClientRect = () => ({ top: 80, left: 120, right: 210, bottom: 112, width: 90, height: 32 });
reversedUrlTarget.getBoundingClientRect = () => ({ top: 80, left: 220, right: 304, bottom: 112, width: 84, height: 32 });
reversedUrlTarget.dispatchFakeEvent('pointerleave', { clientX: 180, clientY: 100, relatedTarget: reversedTitleTarget });
assert.strictEqual(
  reversedElement.children.map((child) => child.textContent || '').join(''),
  'https://x.com/reversed/status/1',
  'switching cursor tooltip should keep URL content during deferred layout-shift leave'
);
reversedTitleTarget.dispatchFakeEvent('pointerenter', { clientX: 180, clientY: 100, relatedTarget: reversedUrlTarget });
assert.strictEqual(
  reversedElement.children.map((child) => child.textContent || '').join(''),
  'https://x.com/reversed/status/1',
  'switching cursor tooltip should ignore layout-shift title enter events at the unchanged pointer point'
);
reversedTimers.forEach((callback) => callback());
assert.strictEqual(
  reversedElement.getAttribute('data-visible'),
  'true',
  'switching cursor tooltip should not schedule a delayed hide from a late previous-target leave'
);

switchUrlTarget.dispatchFakeEvent('pointerleave', { relatedTarget: unrelatedTarget });
assert.strictEqual(
  switchElement.getAttribute('data-visible'),
  'false',
  'switching cursor tooltip should hide immediately when leaving the row text handoff pair'
);

const liveTagTarget = createFakeElement('button');
liveTagTarget.ownerDocument = fakeDocument;
controller.bind(liveTagTarget, () => 'Live modifier title', {
  checkActive: false,
  shouldShow: () => true,
  getTagText: (event) => event && event.metaKey ? '后台打开' : ''
});
liveTagTarget.dispatchFakeEvent('pointerenter', { clientX: 120, clientY: 100 });
assert.strictEqual(
  element.getAttribute('data-cursor-tooltip-tag-visible'),
  'false',
  'bound cursor tooltip should start without a modifier tag'
);
fakeWindow.dispatchFakeEvent('keydown', { key: 'Meta', metaKey: true });
tagElement = getCursorTagElement();
assert.strictEqual(
  element.getAttribute('data-cursor-tooltip-tag-visible'),
  'true',
  'bound cursor tooltip should add the action tag as soon as Command is pressed'
);
assert.strictEqual(
  getCursorTagKeyElement(tagElement).textContent,
  '⌘',
  'bound cursor tooltip should keep the live modifier keycap as Command on Mac'
);
assert.strictEqual(
  getCursorTagLabelElement(tagElement).textContent,
  '后台打开',
  'bound cursor tooltip should refresh the separate tag bubble text from the live modifier state'
);
assert.ok(
  Number.parseInt(tagElement.style.getPropertyValue('top'), 10) <
    Number.parseInt(element.style.getPropertyValue('top'), 10),
  'bound cursor tooltip should keep the live modifier tag above the main cursor bubble'
);
fakeWindow.dispatchFakeEvent('keyup', { key: 'Meta', metaKey: false });
assert.strictEqual(
  element.getAttribute('data-cursor-tooltip-tag-visible'),
  'false',
  'bound cursor tooltip should remove the action tag as soon as Command is released'
);
assert.strictEqual(
  tagElement.getAttribute('data-visible'),
  'false',
  'bound cursor tooltip should hide the separate action tag bubble as soon as Command is released'
);
liveTagTarget.dispatchFakeEvent('pointerleave');

const liveShowTarget = createFakeElement('button');
liveShowTarget.ownerDocument = fakeDocument;
controller.bind(liveShowTarget, () => 'Background-only title', {
  checkActive: false,
  shouldShow: (_target, event) => Boolean(event && event.metaKey),
  getTagText: (event) => event && event.metaKey ? '后台打开' : ''
});
liveShowTarget.dispatchFakeEvent('pointerenter', { clientX: 150, clientY: 110, metaKey: false });
assert.strictEqual(
  element.getAttribute('data-visible'),
  'false',
  'bound cursor tooltip should remain hidden before the modifier condition is satisfied'
);
fakeWindow.dispatchFakeEvent('keydown', { key: 'Meta', metaKey: true });
assert.strictEqual(
  element.getAttribute('data-visible'),
  'true',
  'bound cursor tooltip should appear on an already-hovered target when Command is pressed'
);
assert.strictEqual(
  element.getAttribute('data-cursor-tooltip-tag-visible'),
  'true',
  'bound cursor tooltip should render the background-open tag when it appears from a live modifier'
);
assert.strictEqual(
  getCursorTagElement().getAttribute('data-visible'),
  'true',
  'bound cursor tooltip should show the separate tag bubble when it appears from a live modifier'
);
fakeWindow.dispatchFakeEvent('keyup', { key: 'Meta', metaKey: false });
assert.strictEqual(
  element.getAttribute('data-visible'),
  'false',
  'bound cursor tooltip should hide again when the live modifier no longer satisfies shouldShow'
);
assert.strictEqual(
  getCursorTagElement().getAttribute('data-visible'),
  'false',
  'bound cursor tooltip should hide the separate tag bubble when the main bubble hides'
);

fakeWindow.navigator.platform = 'Win32';
fakeWindow.navigator.userAgent = 'Windows';
controller.show(target, 'A very long bookmark title', { clientX: 100, clientY: 120 }, {
  checkActive: false,
  tagText: '后台打开'
});
assert.strictEqual(
  getCursorTagKeyElement(getCursorTagElement()).textContent,
  '',
  'cursor tooltip should not render the Windows keycap as visible win text'
);
const windowsLogoElement = getWindowsLogoElement(getCursorTagKeyElement(getCursorTagElement()));
assert.ok(
  windowsLogoElement,
  'cursor tooltip should draw a Windows logo inside the keycap on Windows platforms'
);
assert.strictEqual(
  windowsLogoElement.children.length,
  4,
  'cursor tooltip Windows logo should have four panes'
);

const newtabHtml = fs.readFileSync(newtabHtmlPath, 'utf8');
const newtabPanel = readNewtabRuntimeSource();
const background = fs.readFileSync(path.join(repoRoot, 'src/background/background.js'), 'utf8');
const overlayPanel = fs.readFileSync(path.join(repoRoot, 'src/overlay/search-panel.js'), 'utf8');
const searchInputMode = fs.readFileSync(path.join(repoRoot, 'src/shared/search-input-mode.js'), 'utf8');
assert.ok(newtabHtml.includes('../shared/cursor-tooltip.css'), 'newtab should load cursor tooltip stylesheet');
assert.ok(newtabHtml.includes('../shared/cursor-tooltip.js'), 'newtab should load cursor tooltip component');
assert.ok(
  newtabHtml.indexOf('../shared/tooltip.js') < newtabHtml.indexOf('../shared/cursor-tooltip.js'),
  'newtab should load shared tooltip before cursor tooltip'
);
assert.ok(
  background.includes("'src/shared/cursor-tooltip.js'"),
  'overlay injection should load cursor tooltip behavior before search-panel'
);
assert.ok(
  overlayPanel.includes("overlayRuntime.getRuntimeUrl(chrome, 'src/shared/cursor-tooltip.css')"),
  'overlay should resolve cursor tooltip stylesheet URL'
);
assert.ok(
  overlayPanel.includes('LumnoCursorTooltip.createController'),
  'overlay should use the cursor tooltip controller'
);
assert.match(
  overlayPanel,
  /const overlayCursorTooltipController = globalThis\.LumnoCursorTooltip[\s\S]*?id: '_x_extension_overlay_cursor_tooltip_2026_unique_'/,
  'overlay input actions and suggestion text should share the overlay cursor tooltip controller'
);
assert.match(
  overlayPanel,
  /const overlayModeMenuCursorTooltipController = globalThis\.LumnoCursorTooltip[\s\S]*?id: '_x_extension_overlay_mode_menu_cursor_tooltip_2026_unique_'[\s\S]*?appendTo: overlayStyleRoot \|\| document\.body[\s\S]*?positionMode: 'fixed'/,
  'overlay search-scope labels should use a viewport-positioned cursor bubble inside the isolated style root'
);
const overlayModeMenuControllerSource = overlayPanel.match(
  /const overlayModeMenuCursorTooltipController = globalThis\.LumnoCursorTooltip[\s\S]*?\n\s*\}\);/
);
assert.ok(
  overlayModeMenuControllerSource,
  'overlay should create a dedicated search-scope cursor bubble controller'
);
assert.doesNotMatch(
  overlayModeMenuControllerSource[0],
  /boundaryElement:\s*overlay/,
  'overlay search-scope cursor bubbles should not be clamped to the input panel boundary'
);
assert.match(
  overlayPanel,
  /modeMenuCursorTooltipController: overlayModeMenuCursorTooltipController/,
  'overlay search-scope labels should use the dedicated fixed cursor bubble controller'
);
assert.match(
  overlayPanel,
  /storedModeMenuCursorTooltipController[\s\S]*?storedModeMenuCursorTooltipController\.destroy\(\)/,
  'overlay teardown should destroy the dedicated search-scope cursor bubble controller'
);
assert.match(
  newtabPanel,
  /modeMenuCursorTooltipController: bookmarkCursorTooltipController/,
  'new-tab search-scope labels should use the shared cursor tooltip controller'
);
assert.match(
  searchInputMode,
  /const cursorTooltipApi = root\.LumnoCursorTooltip[\s\S]*?typeof cursorTooltipApi\.createController === 'function'/,
  'new-tab search-scope labels should prefer the cursor tooltip controller'
);
assert.match(
  overlayPanel,
  /bindInputActionCursorTooltip\(rightIcon, settingsTooltipText\)/,
  'overlay settings icon should bind its tooltip to the cursor'
);
assert.match(
  overlayPanel,
  /bindInputActionCursorTooltip\(closeOtherTabsButton, closeOtherTooltipText\)/,
  'overlay close-other-tabs icon should bind its tooltip to the cursor'
);
assert.doesNotMatch(
  overlayPanel,
  /rightIcon\.addEventListener\('mouseenter',[\s\S]{0,180}showTopActionTooltip/,
  'overlay settings icon should no longer use the anchored top-action tooltip'
);
assert.doesNotMatch(
  overlayPanel,
  /closeOtherTabsButton\.addEventListener\('mouseenter',[\s\S]{0,180}showTopActionTooltip/,
  'overlay close-other-tabs icon should no longer use the anchored top-action tooltip'
);

console.log('shared cursor tooltip tests passed');
