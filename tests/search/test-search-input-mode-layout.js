const assert = require('assert');
const path = require('path');

class FakeStyle {
  constructor() {
    this.values = new Map();
  }

  set cssText(value) {
    String(value || '').split(';').forEach((declaration) => {
      const separator = declaration.indexOf(':');
      if (separator < 0) {
        return;
      }
      const property = declaration.slice(0, separator).trim();
      const propertyValue = declaration.slice(separator + 1).replace(/\s*!important\s*$/, '').trim();
      if (property) {
        this.values.set(property, propertyValue);
      }
    });
  }

  get cssText() {
    return Array.from(this.values.entries())
      .map(([property, value]) => `${property}: ${value};`)
      .join(' ');
  }

  setProperty(property, value) {
    this.values.set(property, String(value));
  }

  getPropertyValue(property) {
    return this.values.get(property) || '';
  }

  removeProperty(property) {
    const value = this.getPropertyValue(property);
    this.values.delete(property);
    return value;
  }
}

class FakeElement {
  constructor(tagName) {
    this.tagName = String(tagName || '').toUpperCase();
    this.style = new FakeStyle();
    this.children = [];
    this.parentNode = null;
    this.attributes = new Map();
    this.placeholder = '';
    this._textContent = '';
    this._layoutWidth = 0;
  }

  set textContent(value) {
    this._textContent = String(value || '');
    this.children = [];
  }

  get textContent() {
    return this._textContent;
  }

  get offsetWidth() {
    return this._layoutWidth;
  }

  // Reads and writes className, as the DOM's classList does.
  get classList() {
    const element = this;
    const names = () => String(element.className || '').split(/\s+/).filter(Boolean);
    return {
      add(...added) {
        element.className = [...new Set([...names(), ...added])].join(' ');
      },
      remove(...removed) {
        element.className = names().filter((name) => !removed.includes(name)).join(' ');
      },
      contains(name) {
        return names().includes(name);
      }
    };
  }

  appendChild(child) {
    child.parentNode = this;
    this.children.push(child);
    return child;
  }

  insertBefore(child, reference) {
    if (child.parentNode) {
      child.parentNode.removeChild(child);
    }
    child.parentNode = this;
    const index = this.children.indexOf(reference);
    if (index < 0) {
      this.children.push(child);
    } else {
      this.children.splice(index, 0, child);
    }
    return child;
  }

  querySelector() {
    return null;
  }

  removeChild(child) {
    this.children = this.children.filter((candidate) => candidate !== child);
    child.parentNode = null;
  }

  remove() {
    if (this.parentNode) {
      this.parentNode.removeChild(this);
    }
  }

  setAttribute(name, value) {
    this.attributes.set(name, String(value));
  }

  getAttribute(name) {
    return this.attributes.has(name) ? this.attributes.get(name) : null;
  }

  removeAttribute(name) {
    this.attributes.delete(name);
  }

  addEventListener() {}

  removeEventListener() {}

  getRootNode() {
    return documentObj;
  }

  getBoundingClientRect() {
    return {
      width: this._layoutWidth,
      height: 26,
      top: 0,
      right: this._layoutWidth,
      bottom: 26,
      left: 0
    };
  }
}

const resizeObservers = [];
class FakeResizeObserver {
  constructor(callback) {
    this.callback = callback;
    this.targets = [];
    this.disconnected = false;
    resizeObservers.push(this);
  }

  observe(target) {
    this.targets.push(target);
  }

  disconnect() {
    this.disconnected = true;
    this.targets = [];
  }

  trigger(target) {
    this.callback([{ target }]);
  }
}

const documentObj = {
  createElement(tagName) {
    return new FakeElement(tagName);
  },
  createElementNS(_namespace, tagName) {
    return new FakeElement(tagName);
  },
  addEventListener() {},
  removeEventListener() {}
};
const windowObj = {
  ResizeObserver: FakeResizeObserver,
  addEventListener() {},
  removeEventListener() {},
  getComputedStyle(element) {
    return {
      paddingLeft: element.style.getPropertyValue('padding-left') || '44px'
    };
  },
  matchMedia() {
    return { matches: false };
  }
};

const input = new FakeElement('input');
input.style.setProperty('padding-left', '44px');
input.style.setProperty('padding-right', '64px');
input.style.setProperty('caret-color', '#2563eb');
const container = new FakeElement('div');
const modePrefix = new FakeElement('span');
const modePrefixIcon = new FakeElement('img');
const modePrefixText = new FakeElement('span');
const modeTabHint = new FakeElement('span');
const modeTabHintKey = new FakeElement('span');
const modeTabHintText = new FakeElement('span');
modePrefix.appendChild(modePrefixIcon);
modePrefix.appendChild(modePrefixText);
modeTabHint.appendChild(modeTabHintKey);
modeTabHint.appendChild(modeTabHintText);
container.appendChild(modePrefix);
container.appendChild(modeTabHint);
// The mode menu, which the React view draws; this test only lays out the prefix.
const modeMenu = new FakeElement('div');
const modeMenuContent = new FakeElement('div');
const modeMenuFooter = new FakeElement('div');
modeMenu.appendChild(modeMenuContent);
modeMenu.appendChild(modeMenuFooter);
container.appendChild(modeMenu);
// The menu's, tag's and hint's stores, standing in for React: they show what
// the controller sets, as far as the layout reads it.
const modeMenuStore = { setState() {} };
const modePrefixIconFrame = new FakeElement('span');
const modePrefixGlyph = new FakeElement('i');
const modePrefixLineIcon = new FakeElement('svg');
const modePrefixCurrent = new FakeElement('span');
const modeTagStore = {
  setState({ model }) {
    modePrefix.style.setProperty('display', model.visible ? 'inline-flex' : 'none');
  }
};
const tabHintStore = {
  setState(model) {
    modeTabHint.style.setProperty('display', model.visible ? 'inline-flex' : 'none');
  }
};
const badge = new FakeElement('span');
badge._layoutWidth = 48;
badge.setAttribute('data-visible', 'true');

const LumnoSearchInputMode = require(path.resolve(__dirname, '../../src/shared/search/search-input-mode.ts'));

const controller = LumnoSearchInputMode.createInputModeController(
  {
    container,
    input,
    modePrefix,
    modeTabHint,
    modeMenu,
    modeMenuContent,
    modeMenuFooter,
    modeMenuStore,
    modePrefixIconFrame,
    modePrefixGlyph,
    modePrefixLineIcon,
    modePrefixCurrent,
    modeTagStore,
    tabHintStore
  },
  {
    document: documentObj,
    windowObj,
    baseInputPaddingLeft: 44,
    prefixGap: 8,
    modeBadgeElement: badge
  }
);

assert.strictEqual(resizeObservers.length, 1, 'input mode should create one shared layout observer');
assert.ok(
  resizeObservers[0].targets.includes(controller.prefixElement),
  'layout observer should watch the left mode prefix'
);
assert.ok(
  resizeObservers[0].targets.includes(controller.tabHintElement),
  'layout observer should watch the right Tab hint'
);
assert.ok(
  resizeObservers[0].targets.includes(badge),
  'layout observer should watch the right mode badge'
);

controller.prefixElement._layoutWidth = 69;
controller.setPrefixText('豆包', {}, { isAi: true });
assert.strictEqual(
  input.style.getPropertyValue('padding-left'),
  '121px',
  'initial prefix layout should reserve its measured width plus the configured gap'
);

controller.prefixElement._layoutWidth = 103;
assert.strictEqual(
  input.style.getPropertyValue('padding-left'),
  '121px',
  'prefix width changes should demonstrate the stale-caret regression before observation'
);
resizeObservers[0].trigger(controller.prefixElement);
assert.strictEqual(
  input.style.getPropertyValue('padding-left'),
  '155px',
  'observed async prefix growth should move the caret past the resized prefix'
);

controller.clearProviderPrefix();
assert.strictEqual(
  input.style.getPropertyValue('padding-left'),
  '44px',
  'clearing the mode prefix should restore the base input inset'
);

controller.destroy();
assert.strictEqual(resizeObservers[0].disconnected, true, 'destroy should disconnect the layout observer');
assert.strictEqual(
  modePrefix.parentNode,
  container,
  'destroy should preserve the React-owned mode prefix node'
);
assert.strictEqual(
  modeTabHint.parentNode,
  container,
  'destroy should preserve the React-owned Tab hint node'
);

console.log('search input mode layout tests passed');
