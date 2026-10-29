const assert = require('assert');
const fs = require('fs');
const path = require('path');

const repoRoot = path.resolve(__dirname, '..', '..');
const tooltipJsPath = path.join(repoRoot, 'src/shared/ui/tooltip.ts');
const tooltipCssPath = path.join(repoRoot, 'src/shared/ui/tooltip.css');
const newtabHtmlPath = path.join(repoRoot, 'newtab.html');
const optionsHtmlPath = path.join(repoRoot, 'src/options/options.html');
const overlayPanelPath = path.join(repoRoot, 'src/overlay/search-panel.ts');

const tooltipView = {
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
    String(text || '').split('\n').forEach((line) => {
      const child = element.ownerDocument.createElement('span');
      child.classList.add(
        line === '────────'
          ? '_x_extension_tooltip_divider_2026_unique_'
          : '_x_extension_tooltip_line_2026_unique_'
      );
      child.textContent = line === '────────' ? '' : line;
      element.appendChild(child);
    });
    return element;
  }
};

// The shared tooltip draws through this stand-in for its React view.
global.__lumnoTestModuleStubs = {
  'src/shared/react/tooltip-view.tsx': tooltipView
};

assert.ok(fs.existsSync(tooltipJsPath), 'shared tooltip behavior should live in src/shared/ui/tooltip.ts');
assert.ok(fs.existsSync(tooltipCssPath), 'shared tooltip styling should live in src/shared/ui/tooltip.css');

const tooltipCss = fs.readFileSync(tooltipCssPath, 'utf8');
const tooltip = require(tooltipJsPath);
const { getInjectedScripts, getPageScripts, runsBefore } = require('../helpers/runtime-scripts');

assert.strictEqual(
  tooltip.className,
  '_x_extension_tooltip_2026_unique_',
  'shared tooltip should expose a stable tooltip CSS class'
);
assert.strictEqual(
  tooltip.hostClassName,
  '_x_extension_tooltip_host_2026_unique_',
  'shared tooltip should expose a stable tooltip host CSS class'
);
assert.strictEqual(typeof tooltip.createController, 'function', 'shared tooltip should expose createController()');
assert.strictEqual(typeof tooltip.renderText, 'function', 'shared tooltip should expose renderText()');
assert.strictEqual(typeof tooltip.position, 'function', 'shared tooltip should expose position()');

assert.ok(
  tooltipCss.includes('._x_extension_tooltip_2026_unique_'),
  'shared tooltip CSS should style the stable tooltip class'
);
assert.ok(
  tooltipCss.includes('--x-extension-tooltip-bg-top: #ffffff;'),
  'shared tooltip CSS should expose a light gradient top token'
);
assert.ok(
  tooltipCss.includes('--x-extension-tooltip-bg-bottom: #f7f9fc;'),
  'shared tooltip CSS should mirror the feature hint light gradient bottom token'
);
assert.ok(
  tooltipCss.includes('background: linear-gradient('),
  'shared tooltip CSS should use a light gradient surface'
);
assert.ok(
  tooltipCss.includes('color: var(--x-extension-tooltip-text, #556070);'),
  'shared tooltip CSS should default to feature-hint style text for light mode'
);
assert.ok(
  tooltipCss.includes('[data-theme="dark"] ._x_extension_tooltip_2026_unique_'),
  'shared tooltip CSS should still provide a dark theme override'
);
assert.ok(
  tooltipCss.includes('._x_extension_tooltip_divider_2026_unique_'),
  'shared tooltip CSS should own multiline divider styling'
);
assert.match(
  tooltipCss,
  /\._x_extension_tooltip_line_2026_unique_\s*\+\s*\._x_extension_tooltip_line_2026_unique_\s*\{[\s\S]*?margin-top:\s*6px;[\s\S]*?\}/,
  'shared tooltip CSS should add default spacing between multiline text paragraphs'
);

function createFakeElement(tagName) {
  const children = [];
  const attributes = new Map();
  const classes = new Set();
  const properties = new Map();
  const listeners = new Map();
  return {
    tagName,
    children,
    listeners,
    isConnected: true,
    ownerDocument: null,
    className: '',
    textContent: '',
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
      children.push(child);
      return child;
    },
    replaceChildren: (...nodes) => {
      children.length = 0;
      nodes.forEach((node) => children.push(node));
    },
    setAttribute: (name, value) => attributes.set(name, String(value)),
    getAttribute: (name) => attributes.get(name) || '',
    removeAttribute: (name) => attributes.delete(name),
    addEventListener: (eventName, listener) => {
      const existing = listeners.get(eventName) || [];
      existing.push(listener);
      listeners.set(eventName, existing);
    },
    matches: () => true,
    getBoundingClientRect: () => ({ top: 80, left: 120, right: 152, bottom: 112, width: 32, height: 32 })
  };
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

const controller = tooltip.createController({
  documentObj: fakeDocument,
  windowObj: {
    innerWidth: 320,
    innerHeight: 240,
    requestAnimationFrame: (callback) => callback(),
    setTimeout: (callback) => {
      callback();
      return 1;
    },
    clearTimeout: () => {}
  },
  id: '_x_extension_test_tooltip_2026_unique_'
});

const target = createFakeElement('button');
target.ownerDocument = fakeDocument;
fakeDocument.activeElement = target;
controller.show(target, '第一行\n────────\n第二行');

const element = controller.element;
assert.ok(element.classList.contains(tooltip.className), 'controller should create the shared tooltip element');
assert.strictEqual(element.getAttribute('data-visible'), 'true', 'show() should mark tooltip visible');
assert.strictEqual(element.children.length, 3, 'renderText() should preserve multiline tooltip content');
assert.ok(
  element.children[1].classList.contains('_x_extension_tooltip_divider_2026_unique_'),
  'renderText() should convert the divider marker into the shared divider element'
);

controller.hide();
assert.strictEqual(element.getAttribute('data-visible'), 'false', 'hide() should mark tooltip hidden');

let dynamicSpacingTarget = null;
tooltip.position(element, target, {
  windowObj: {
    innerWidth: 320,
    innerHeight: 240
  },
  placement: 'bottom',
  spacing: (positionTarget) => {
    dynamicSpacingTarget = positionTarget;
    return 4;
  }
});
assert.strictEqual(
  dynamicSpacingTarget,
  target,
  'position() should resolve dynamic spacing against the current tooltip target'
);
assert.strictEqual(
  element.style.getPropertyValue('top'),
  '116px',
  'position() should apply the dynamically resolved spacing value'
);

const focusTarget = createFakeElement('button');
controller.bind(focusTarget, () => 'Focus tooltip');
assert.strictEqual(
  focusTarget.listeners.get('focus').length,
  1,
  'bind() should keep focus tooltips enabled by default'
);

const hoverOnlyTarget = createFakeElement('button');
controller.bind(hoverOnlyTarget, () => 'Hover only tooltip', { showOnFocus: false });
assert.strictEqual(
  hoverOnlyTarget.listeners.get('mouseenter').length,
  1,
  'bind() should still attach hover listeners when focus tooltips are disabled'
);
assert.strictEqual(
  hoverOnlyTarget.listeners.get('focus'),
  undefined,
  'bind() should skip focus listeners when showOnFocus is false'
);

const newtabHtml = fs.readFileSync(newtabHtmlPath, 'utf8');
const optionsHtml = fs.readFileSync(optionsHtmlPath, 'utf8');
const overlayPanel = fs.readFileSync(overlayPanelPath, 'utf8');

assert.ok(newtabHtml.includes('../shared/ui/tooltip.css'), 'newtab should load the shared tooltip stylesheet');
assert.ok(getPageScripts('newtab.html').includes('src/shared/ui/tooltip.ts'), 'newtab should load the shared tooltip component');
assert.ok(optionsHtml.includes('../shared/ui/tooltip.css'), 'options should load the shared tooltip stylesheet');
assert.ok(getPageScripts('src/options/options.html').includes('src/shared/ui/tooltip.ts'), 'options should load the shared tooltip component');
assert.ok(
  runsBefore(getInjectedScripts('overlay'), 'src/shared/ui/tooltip.ts', 'src/overlay/search-panel.ts'),
  'overlay injection should load the shared tooltip component before search-panel'
);
assert.ok(
  overlayPanel.includes("LumnoOverlayRuntime.getRuntimeUrl(chrome, 'src/shared/ui/tooltip.css')"),
  'overlay should resolve the shared tooltip stylesheet URL'
);
assert.ok(
  overlayPanel.includes('LumnoTooltip.createController'),
  'overlay should use the shared tooltip controller'
);

console.log('shared tooltip tests passed');
