const assert = require('assert');
const fs = require('fs');
const vm = require('vm');
const { JSDOM } = require('jsdom');
const { parsePageCss } = require('../helpers/css-rules');
const { readPageSource } = require('../helpers/page-source');
const {
  WALLPAPER_DEPENDENCY_GLOBALS,
  readWallpaperRuntimeSource
} = require('../helpers/wallpaper-source');
const { getBundleFiles } = require('../helpers/runtime-scripts');

// Real page dependencies, loaded the way newtab.html loads them before wallpaper.ts.
const LumnoSettings = require('../../src/domain/settings/index.ts');
const LumnoNewtabWallpaperAdaptiveTone = require('../../src/newtab/wallpaper/wallpaper-adaptive-tone.ts');
const LumnoNewtabWallpaperEffects = require('../../src/newtab/wallpaper/wallpaper-effects.ts');
const LumnoNewtabWallpaperLocalStore = require('../../src/shared/wallpaper-local-store.ts');
const LumnoNewtabRemoteContent = require('../../src/newtab/remote-content.ts');
const { moduleScript } = require('../helpers/module-script');
const REAL_WALLPAPER_DEPENDENCIES = {
  LumnoSettings: LumnoSettings,
  LumnoNewtabRemoteContent: LumnoNewtabRemoteContent,
  LumnoNewtabWallpaperAdaptiveTone: LumnoNewtabWallpaperAdaptiveTone,
  LumnoNewtabWallpaperEffects: LumnoNewtabWallpaperEffects,
  LumnoNewtabWallpaperLocalStore: LumnoNewtabWallpaperLocalStore,
  // No React views unless a test hands one in.
  LumnoNewtabWallpaperViewModule: { getWallpaperViewApi: () => null },
  LumnoFeatureHintViewModule: { createFeatureHintView: () => null }
};

const WALLPAPER_STORAGE_KEY = '_x_extension_newtab_wallpaper_2026_unique_';
const LOCAL_WALLPAPER_STORAGE_KEY = '_x_extension_newtab_local_wallpaper_2026_unique_';
const ONLINE_WALLPAPER_STORAGE_KEY = '_x_extension_newtab_online_wallpaper_2026_unique_';
const LINK_WALLPAPERS_STORAGE_KEY = '_x_extension_newtab_link_wallpapers_2026_unique_';
const DAILY_WALLPAPER_PICKS_STORAGE_KEY = '_x_extension_newtab_daily_wallpaper_picks_2026_unique_';
const CURATED_MIX_EXCLUDED_STORAGE_KEY = '_x_extension_newtab_curated_mix_excluded_2026_unique_';
const WALLPAPER_OVERLAY_STORAGE_KEY = '_x_extension_newtab_wallpaper_overlay_2026_unique_';
const WALLPAPER_EFFECT_STORAGE_KEY = '_x_extension_newtab_wallpaper_effect_2026_unique_';
const NEWTAB_FAVICON_STORAGE_KEY = '_x_extension_newtab_favicon_2026_unique_';
const NEWTAB_FAVICON_PRELOAD_STORAGE_KEY = '_x_extension_newtab_favicon_preload_2026_unique_';
const WALLPAPER_PRELOAD_STORAGE_KEY = '_x_extension_newtab_wallpaper_preload_2026_unique_';
const WALLPAPER_PRELOAD_STORAGE_VERSION = 4;
const DEFAULT_WALLPAPER_ID = 'monet-coastal-white';
const WALLPAPER_PREFS_STORAGE_VERSION = 2;
const CUSTOM_WALLPAPER_ID_PREFIX = 'custom-wallpaper-';
const LOCAL_WALLPAPER_DISABLED_VALUE = '__lumno_local_wallpaper_disabled__';


// The page's settings as the runtime reads them, held in memory: a write
// shows at once, as the page's settings store does.
function createTestSettings() {
  const values = new Map();
  const listeners = [];
  const notify = () => listeners.forEach((listener) => listener());
  return {
    get: (setting) => (values.has(setting.key) ? values.get(setting.key) : setting.parse(undefined)),
    set(setting, value) {
      values.set(setting.key, setting.parse(value));
      notify();
      return Promise.resolve();
    },
    setMany(entries) {
      entries.forEach(([setting, value]) => values.set(setting.key, setting.parse(value)));
      notify();
      return Promise.resolve();
    },
    subscribe(_settings, listener) {
      listeners.push(listener);
      return () => {};
    }
  };
}

// A wallpaper runtime over the given options, with the page's settings and
// the clock preview the runtime reads.
function createRuntimeWithSettings(sandbox, options) {
  const settings = options.settings || createTestSettings();
  const preview = {};
  const timePreview = {
    get fontSize() {
      return preview.fontSize === undefined ? settings.get(REAL_WALLPAPER_DEPENDENCIES.LumnoSettings.newtabTimeFontSize) : preview.fontSize;
    },
    get opacity() {
      return preview.opacity === undefined ? settings.get(REAL_WALLPAPER_DEPENDENCIES.LumnoSettings.newtabTimeOpacity) : preview.opacity;
    },
    show: (value) => Object.assign(preview, value)
  };
  return sandbox.LumnoNewtabWallpaper.createWallpaperRuntime({ ...options, settings, timePreview });
}

function createFakeStyle() {
  const values = new Map();
  return {
    setProperty(name, value) {
      values.set(String(name), String(value));
    },
    getPropertyValue(name) {
      return values.get(String(name)) || '';
    },
    removeProperty(name) {
      values.delete(String(name));
    }
  };
}

function createFakeClassList(element) {
  const getClasses = () => new Set(
    String(element.className || '').split(/\s+/).filter(Boolean)
  );
  const writeClasses = (classes) => {
    element.className = Array.from(classes).join(' ');
  };
  return {
    add(...items) {
      const classes = getClasses();
      items.forEach((item) => {
        if (item) {
          classes.add(String(item));
        }
      });
      writeClasses(classes);
    },
    remove(...items) {
      const classes = getClasses();
      items.forEach((item) => classes.delete(String(item)));
      writeClasses(classes);
    },
    contains(item) {
      return getClasses().has(String(item));
    },
    toggle(item, force) {
      const classes = getClasses();
      const name = String(item);
      const shouldAdd = force === undefined ? !classes.has(name) : Boolean(force);
      if (shouldAdd) {
        classes.add(name);
      } else {
        classes.delete(name);
      }
      writeClasses(classes);
      return shouldAdd;
    }
  };
}

function createFakeElement(tagName, documentObj) {
  const attributes = new Map();
  const element = {
    tagName: String(tagName || '').toUpperCase(),
    children: [],
    parentNode: null,
    parentElement: null,
    className: '',
    id: '',
    textContent: '',
    innerHTML: '',
    type: '',
    value: '',
    disabled: false,
    checked: false,
    tabIndex: 0,
    dataset: {},
    _listeners: Object.create(null),
    style: createFakeStyle(),
    classList: null,
    setAttribute(name, value) {
      const key = String(name);
      const text = String(value);
      attributes.set(key, text);
      if (key === 'class') {
        this.className = text;
      } else if (key === 'id') {
        this.id = text;
      } else if (['type', 'min', 'max', 'step', 'value'].includes(key)) {
        this[key] = text;
      } else if (key === 'src' || key === 'href') {
        this[key] = text;
      }
      if (key.startsWith('data-')) {
        const datasetKey = key.slice(5).replace(/-([a-z])/g, (_match, letter) => letter.toUpperCase());
        this.dataset[datasetKey] = text;
      }
    },
    getAttribute(name) {
      return attributes.has(String(name)) ? attributes.get(String(name)) : null;
    },
    removeAttribute(name) {
      const key = String(name);
      attributes.delete(key);
      if (key.startsWith('data-')) {
        const datasetKey = key.slice(5).replace(/-([a-z])/g, (_match, letter) => letter.toUpperCase());
        delete this.dataset[datasetKey];
      }
    },
    appendChild(child) {
      this.children.push(child);
      child.parentNode = this;
      child.parentElement = this;
      return child;
    },
    insertBefore(child, referenceChild) {
      const index = this.children.indexOf(referenceChild);
      if (index === -1) {
        return this.appendChild(child);
      }
      this.children.splice(index, 0, child);
      child.parentNode = this;
      child.parentElement = this;
      return child;
    },
    removeChild(child) {
      const index = this.children.indexOf(child);
      if (index !== -1) {
        this.children.splice(index, 1);
        child.parentNode = null;
        child.parentElement = null;
      }
      return child;
    },
    contains(target) {
      if (!target) {
        return false;
      }
      if (target === this) {
        return true;
      }
      return this.children.some((child) => child && typeof child.contains === 'function' && child.contains(target));
    },
    closest(selector) {
      const source = String(selector || '').trim();
      if (!source.startsWith('.')) {
        return null;
      }
      const className = source.slice(1);
      let current = this;
      while (current) {
        if (current.classList && current.classList.contains(className)) {
          return current;
        }
        current = current.parentElement;
      }
      return null;
    },
    addEventListener(type, listener) {
      const key = String(type);
      if (!this._listeners[key]) {
        this._listeners[key] = [];
      }
      this._listeners[key].push(listener);
    },
    removeEventListener(type, listener) {
      const key = String(type);
      if (!this._listeners[key]) {
        return;
      }
      this._listeners[key] = this._listeners[key].filter((item) => item !== listener);
    },
    dispatchEvent(event) {
      const nextEvent = event || { type: '' };
      if (!nextEvent.target) {
        nextEvent.target = this;
      }
      nextEvent.currentTarget = this;
      (this._listeners[String(nextEvent.type)] || []).slice().forEach((listener) => {
        listener(nextEvent);
      });
      return !nextEvent.defaultPrevented;
    },
    click() {
      (this._listeners.click || []).forEach((listener) => {
        listener({
          target: this,
          preventDefault() {},
          stopPropagation() {}
        });
      });
    },
    querySelector(selector) {
      return this.querySelectorAll(selector)[0] || null;
    },
    querySelectorAll(selector) {
      const source = String(selector || '').trim();
      const matches = [];
      const matchesSelector = (node) => {
        if (!node || !source) {
          return false;
        }
        const tagMatch = source.match(/^[a-z][a-z0-9-]*/i);
        if (tagMatch && node.tagName !== tagMatch[0].toUpperCase()) {
          return false;
        }
        const classMatches = Array.from(source.matchAll(/\.([A-Za-z0-9_-]+)/g));
        if (classMatches.some((match) => !node.classList.contains(match[1]))) {
          return false;
        }
        const attributeMatches = Array.from(
          source.matchAll(/\[([^=\]]+)(?:="([^"]*)")?\]/g)
        );
        return attributeMatches.every((match) => {
          const actual = node.getAttribute(match[1]);
          return match[2] === undefined ? actual !== null : actual === match[2];
        });
      };
      const visit = (node) => {
        (node.children || []).forEach((child) => {
          if (matchesSelector(child)) {
            matches.push(child);
          }
          visit(child);
        });
      };
      visit(this);
      return matches;
    },
    getBoundingClientRect() {
      return { left: 0, top: 0, right: 120, bottom: 32, width: 120, height: 32 };
    },
    focus() {
      documentObj.activeElement = this;
    },
    blur() {
      if (documentObj.activeElement === this) {
        documentObj.activeElement = null;
      }
      this._blurred = true;
      this.dispatchEvent({
        type: 'blur',
        target: this,
        preventDefault() {},
        stopPropagation() {}
      });
    }
  };
  element.classList = createFakeClassList(element);
  return element;
}

function createFakeDocument() {
  const documentObj = {
    activeElement: null,
    body: null,
    head: null,
    documentElement: null,
    createElement(tagName) {
      return createFakeElement(tagName, documentObj);
    }
  };
  documentObj.body = createFakeElement('body', documentObj);
  documentObj.head = createFakeElement('head', documentObj);
  documentObj.documentElement = createFakeElement('html', documentObj);
  return documentObj;
}

// Stands in for the React panel (src/newtab/react/wallpaper-view.tsx, tested with vitest):
// it keeps the state the runtime renders and the few elements the runtime measures or
// focuses. Tests read settings from that state and act through its callbacks, as the
// panel's controls do.
function createRecordingWallpaperViewController(config) {
  const documentObj = config.documentObj;
  const refs = Object.create(null);
  const create = (tagName, className, refName, parent) => {
    const element = documentObj.createElement(tagName);
    element.className = className || '';
    if (refName) {
      refs[refName] = element;
      element.setAttribute('data-wallpaper-ref', refName);
    }
    if (parent) parent.appendChild(element);
    return element;
  };
  const control = create('div', 'x-nt-wallpaper-control');
  const panel = create('div', 'x-nt-wallpaper-panel', 'panel', control);
  const button = create('button', 'x-nt-wallpaper-button', 'button', control);
  [
    'appearanceOptions', 'builtInGrid', 'localGrid', 'bingPanel', 'curatedPanel', 'curatedItemsHost', 'modeRow',
    'effectInkToneControl', 'effectStrengthControl', 'effectSizeControl', 'effectSpacingControl',
    'effectTextureControl', 'effectCrtBloomControl', 'effectCrtRgbOffsetControl', 'effectCrtCurvatureControl',
    'urlTile', 'urlForm', 'quoteBody'
  ].forEach((name) => create('div', '', name, panel));
  create('input', '', 'urlInput', refs.urlForm);
  const view = {
    control,
    panel,
    button,
    model: config.model,
    state: config.state,
    renders: 0,
    focused: [],
    selectOpen: false,
    getRefs() {
      return refs;
    },
    render(state) {
      view.state = state;
      view.renders += 1;
      control.setAttribute('data-panel-open', state.open ? 'true' : 'false');
    },
    focus(name) {
      view.focused.push(name);
      if (refs[name]) refs[name].focus();
    },
    closeOpenSelect() {
      const wasOpen = view.selectOpen;
      view.selectOpen = false;
      return wasOpen;
    },
    containsSelectMenuTarget(target) {
      return target === view.selectMenu;
    },
    renderQuoteSettings(model) {
      view.quoteSettings = model;
    },
    renderSectionSettings(model) {
      view.sectionSettings = model;
    },
    destroy() {}
  };
  view.selectMenu = documentObj.createElement('div');
  control.__view = view;
  return view;
}

function panelOf(runtime) {
  return runtime.getControlElement().__view;
}

// The runtime lives in its own VM realm; copy its state into this one so deepStrictEqual
// compares plain arrays and objects. Callbacks are kept as they are.
function toHostRealm(value) {
  if (Array.isArray(value)) return Array.from(value, toHostRealm);
  if (value && typeof value === 'object') {
    const copy = {};
    Object.keys(value).forEach((key) => {
      copy[key] = toHostRealm(value[key]);
    });
    return copy;
  }
  return value;
}

function panelState(runtime) {
  return toHostRealm(panelOf(runtime).state);
}

function panelActions(runtime) {
  return panelState(runtime).actions;
}

function openPanel(runtime) {
  if (!runtime.isPanelOpen()) panelActions(runtime).togglePanel();
}

function findTile(runtime, id) {
  const wallpaper = panelState(runtime).wallpaper;
  const sources = [
    ['built-in', wallpaper.builtIn.tiles],
    ['local', wallpaper.local.tiles],
    ['bing', wallpaper.bing.tiles],
    ['curated', wallpaper.curated.tiles]
  ];
  for (const [source, tiles] of sources) {
    const tile = tiles.find((item) => item.id === id);
    if (tile) return Object.assign({ source }, tile);
  }
  return null;
}

function clickTile(runtime, id) {
  const tile = findTile(runtime, id);
  assert.ok(tile, `${id} should be listed in the panel`);
  const actions = panelActions(runtime);
  if (tile.source === 'bing') actions.selectBingWallpaper(id);
  else if (tile.source === 'curated') actions.selectCuratedWallpaper(id);
  else actions.selectWallpaper(id);
}

const NOT_DRAGGING = Object.freeze({ dragging: false, final: false });
const TYPED = Object.freeze({ dragging: false, final: true });

function createFakeWindow() {
  const mediaQueries = new Map();
  const listenersByType = Object.create(null);
  const localStorageData = new Map();
  class FakeEvent {
    constructor(type, options) {
      this.type = String(type || '');
      this.bubbles = Boolean(options && options.bubbles);
      this.defaultPrevented = false;
      this.target = null;
      this.currentTarget = null;
    }

    preventDefault() {
      this.defaultPrevented = true;
    }

    stopPropagation() {}
  }
  function getMediaQueryList(query) {
    const text = String(query || '');
    if (!mediaQueries.has(text)) {
      const listeners = [];
      mediaQueries.set(text, {
        media: text,
        matches: text.includes('prefers-reduced-motion'),
        addEventListener(type, listener) {
          if (String(type) === 'change' && typeof listener === 'function') {
            listeners.push(listener);
          }
        },
        removeEventListener(type, listener) {
          if (String(type) !== 'change') {
            return;
          }
          const index = listeners.indexOf(listener);
          if (index !== -1) {
            listeners.splice(index, 1);
          }
        },
        addListener(listener) {
          if (typeof listener === 'function') {
            listeners.push(listener);
          }
        },
        removeListener(listener) {
          const index = listeners.indexOf(listener);
          if (index !== -1) {
            listeners.splice(index, 1);
          }
        },
        _dispatch(matches) {
          this.matches = Boolean(matches);
          listeners.slice().forEach((listener) => listener(this));
        },
        _setMatches(matches) {
          this.matches = Boolean(matches);
        }
      });
    }
    return mediaQueries.get(text);
  }
  function addWindowListener(type, listener) {
    const key = String(type);
    if (!listenersByType[key]) {
      listenersByType[key] = [];
    }
    if (typeof listener === 'function') {
      listenersByType[key].push(listener);
    }
  }
  function removeWindowListener(type, listener) {
    const key = String(type);
    if (!listenersByType[key]) {
      return;
    }
    listenersByType[key] = listenersByType[key].filter((item) => item !== listener);
  }
  return {
    Event: FakeEvent,
    setTimeout,
    clearTimeout,
    requestAnimationFrame(callback) {
      return setTimeout(callback, 0);
    },
    cancelAnimationFrame(id) {
      clearTimeout(id);
    },
    addEventListener: addWindowListener,
    removeEventListener: removeWindowListener,
    innerWidth: 1280,
    innerHeight: 800,
    getComputedStyle(element) {
      return {
        borderLeftWidth: '0',
        borderTopWidth: '0',
        transform: 'none',
        backgroundColor: element && element.style.getPropertyValue('background-color'),
        backgroundImage: element && element.style.getPropertyValue('background-image'),
        backgroundSize: element && element.style.getPropertyValue('background-size'),
        backgroundPosition: element && element.style.getPropertyValue('background-position'),
        backgroundRepeat: element && element.style.getPropertyValue('background-repeat'),
        getPropertyValue(name) {
          return element && element.style && typeof element.style.getPropertyValue === 'function'
            ? element.style.getPropertyValue(name)
            : '';
        }
      };
    },
    matchMedia(query) {
      return getMediaQueryList(query);
    },
    __setMediaMatch(query, matches) {
      getMediaQueryList(query)._dispatch(matches);
    },
    __setMediaMatchSilently(query, matches) {
      getMediaQueryList(query)._setMatches(matches);
    },
    __dispatchEvent(type) {
      (listenersByType[String(type)] || []).slice().forEach((listener) => listener({ type: String(type) }));
    },
    localStorage: {
      removeItem(key) {
        localStorageData.delete(String(key));
      },
      setItem(key, value) {
        localStorageData.set(String(key), String(value));
      },
      getItem(key) {
        return localStorageData.has(String(key)) ? localStorageData.get(String(key)) : '';
      }
    },
    __localStorageData: localStorageData
  };
}

function createFakeBroadcastChannelClass() {
  const channels = new Map();
  return class FakeBroadcastChannel {
    constructor(name) {
      this.name = String(name || '');
      this.onmessage = null;
      this._listeners = [];
      if (!channels.has(this.name)) {
        channels.set(this.name, []);
      }
      channels.get(this.name).push(this);
    }

    addEventListener(type, listener) {
      if (String(type) === 'message' && typeof listener === 'function') {
        this._listeners.push(listener);
      }
    }

    removeEventListener(type, listener) {
      if (String(type) !== 'message') {
        return;
      }
      this._listeners = this._listeners.filter((item) => item !== listener);
    }

    postMessage(data) {
      const peers = channels.get(this.name) || [];
      peers.forEach((peer) => {
        if (peer === this) {
          return;
        }
        const event = { data };
        if (typeof peer.onmessage === 'function') {
          peer.onmessage(event);
        }
        peer._listeners.slice().forEach((listener) => listener(event));
      });
    }

    close() {
      const peers = channels.get(this.name) || [];
      channels.set(this.name, peers.filter((peer) => peer !== this));
    }
  };
}

function createFakeImageClass() {
  return class FakeImage {
    constructor() {
      this.onload = null;
      this.onerror = null;
      this.decoding = '';
      this._src = '';
    }

    set src(value) {
      this._src = String(value || '');
      setTimeout(() => {
        if (typeof this.onload === 'function') {
          this.onload();
        }
      }, 0);
    }

    get src() {
      return this._src;
    }

    decode() {
      return Promise.resolve();
    }
  };
}

function createDeferredWallpaperImageHarness() {
  const requests = [];
  class DeferredImage {
    constructor() {
      this.onload = null;
      this.onerror = null;
      this.decoding = '';
      this._src = '';
      this.decodePromise = new Promise((resolve) => {
        this.resolveDecode = resolve;
      });
      requests.push(this);
    }

    set src(value) {
      this._src = String(value || '');
      setTimeout(() => {
        if (typeof this.onload === 'function') {
          this.onload();
        }
      }, 0);
    }

    get src() {
      return this._src;
    }

    decode() {
      return this.decodePromise;
    }
  }
  return { Image: DeferredImage, requests };
}

function waitForAsyncWallpaperApply() {
  return new Promise((resolve) => setTimeout(resolve, 20));
}

function getDescendantsByClassName(element, className, results) {
  const matches = results || [];
  (element && element.children ? element.children : []).forEach((child) => {
    const classes = String(child.className || '').split(/\s+/);
    if (classes.includes(className)) {
      matches.push(child);
    }
    getDescendantsByClassName(child, className, matches);
  });
  return matches;
}

function getDescendantByClassName(element, className) {
  return getDescendantsByClassName(element, className)[0] || null;
}


function decodeSvgDataUrl(url) {
  const prefix = 'data:image/svg+xml;charset=UTF-8,';
  assert.ok(String(url || '').startsWith(prefix), 'the alternate favicon should be rendered as an SVG data URL');
  return decodeURIComponent(String(url).slice(prefix.length));
}

function clonePlain(value) {
  return JSON.parse(JSON.stringify(value));
}

function assertSquareFaviconOptionCss(filePath) {
  const css = parsePageCss(filePath);
  const rule = (selector) => {
    const found = css.rule(selector);
    assert.ok(found, `${filePath} should style ${selector}`);
    return found;
  };
  const options = rule('.x-nt-favicon-options');
  assert.strictEqual(options.get('display'), 'flex', `${filePath} favicon options should not stretch as a grid`);
  assert.strictEqual(options.get('justify-content'), 'flex-start', `${filePath} favicon options should align left`);
  assert.strictEqual(options.get('gap'), 'var(--x-nt-panel-grid-gap)', `${filePath} favicon options should use wallpaper grid gap`);
  assert.strictEqual(options.has('grid-template-columns'), false, `${filePath} favicon options should not use equal-width columns`);

  const quarter = 'calc((100% - (var(--x-nt-panel-grid-gap) * 3)) / 4)';
  const option = rule('.x-nt-favicon-option');
  assert.strictEqual(option.get('width').replace(/\s+/g, ' '), quarter, `${filePath} favicon option should use a quarter-width column`);
  assert.strictEqual(option.get('flex').replace(/\s+/g, ' '), `0 0 ${quarter}`, `${filePath} favicon option flex basis should use a quarter-width column`);

  const thumb = rule('.x-nt-favicon-thumb');
  assert.strictEqual(thumb.get('width'), '100%', `${filePath} favicon thumb should fill the wallpaper-width option`);
  assert.strictEqual(thumb.get('aspect-ratio').replace(/\s+/g, ''), '1/1', `${filePath} favicon thumb should use a square rounded rectangle`);
  assert.strictEqual(thumb.has('height'), false, `${filePath} favicon thumb should not keep the compact fixed height`);

  const selected = rule('.x-nt-favicon-option[data-selected="true"] .x-nt-favicon-thumb::after');
  assert.strictEqual(selected.get('inset'), '0', `${filePath} selected favicon outline should not have inner spacing`);
  assert.strictEqual(selected.get('border-radius'), 'inherit', `${filePath} selected favicon outline should inherit thumb radius`);
}

function assertSegmentedTabRadiusCss(filePath) {
  const css = parsePageCss(filePath);
  const tokens = css.rule('.x-nt-segmented-tabs');
  assert.ok(tokens, `${filePath} should define shared segmented-tab radius tokens`);
  assert.match(
    tokens.get('--x-nt-segmented-tabs-inner-radius'),
    /^calc\(.*--x-nt-segmented-tabs-radius.*--x-nt-segmented-tabs-border-width.*--x-nt-segmented-tabs-inset/,
    `${filePath} should derive the inner radius from the full visual inset`
  );
  ['.x-nt-segmented-tabs-indicator', '.x-nt-segmented-tab'].forEach((selector) => {
    assert.strictEqual(css.rule(selector) && css.rule(selector).get('border-radius'), 'var(--x-nt-segmented-tabs-inner-radius)',
      `${filePath} should apply one inner radius to indicators and buttons (${selector})`);
  });
}

function assertEffectSelectCss(filePath) {
  const css = parsePageCss(filePath);
  const select = css.rule('.x-nt-row-select');
  assert.strictEqual(select && select.get('flex'), '0 0 var(--x-nt-row-control-width)',
    `${filePath} should size the filter dropdown like the other row controls`);
  const trigger = css.rule('.x-nt-row-select ._x_extension_select_trigger_2024_unique_');
  assert.strictEqual(trigger && trigger.get('height'), '30px',
    `${filePath} should match the filter trigger height to the slider value inputs`);
}

function readLocaleMessages(locale) {
  return JSON.parse(fs.readFileSync(`_locales/${locale}/messages.json`, 'utf8'));
}

function assertBrandMarkCopy() {
  const expected = {
    zh_CN: {
      title: '搜索框上方内容',
      brand: '品牌标识',
      time: '时间',
      off: '隐藏',
      weight: '时间字重',
      seconds: '显示秒数'
    },
    zh_TW: {
      title: '搜尋框上方內容',
      brand: '品牌標識',
      time: '時間',
      off: '隱藏',
      weight: '時間字重',
      seconds: '顯示秒數'
    },
    en: {
      title: 'Content above the search bar',
      brand: 'Brand',
      time: 'Time',
      off: 'Hide',
      weight: 'Time font weight',
      seconds: 'Show seconds'
    },
    ja: {
      title: '検索ボックス上のコンテンツ',
      brand: 'ブランド',
      time: '時刻',
      off: '非表示',
      weight: '時刻の文字の太さ',
      seconds: '秒を表示'
    }
  };
  Object.keys(expected).forEach((locale) => {
    const messages = readLocaleMessages(locale);
    assert.strictEqual(messages.settings_newtab_wordmark_title.message, expected[locale].title);
    assert.strictEqual(messages.newtab_top_content_brand.message, expected[locale].brand);
    assert.strictEqual(messages.newtab_top_content_time.message, expected[locale].time);
    assert.strictEqual(messages.newtab_top_content_off.message, expected[locale].off);
  });

  // The panel shows those messages for the content above the search bar.
  const zhMessages = readLocaleMessages('zh_CN');
  const localized = createWallpaperSandbox();
  const timeSettings = createTestSettings();
  timeSettings.set(REAL_WALLPAPER_DEPENDENCIES.LumnoSettings.newtabTopContentMode, 'time');
  const localizedRuntime = createRuntimeWithSettings(localized.sandbox, {
    documentObj: localized.documentObj,
    windowObj: localized.windowObj,
    storageArea: null,
    settings: timeSettings,
    t: (key, fallback) => (zhMessages[key] ? zhMessages[key].message : fallback || '')
  });
  localizedRuntime.createControls();
  const search = panelState(localizedRuntime).search;
  assert.strictEqual(search.topContent.title, expected.zh_CN.title);
  assert.strictEqual(search.topContent.tabs.label, expected.zh_CN.title);
  assert.deepStrictEqual(
    search.topContent.tabs.options.map((option) => [option.value, option.label]),
    [['brand', expected.zh_CN.brand], ['time', expected.zh_CN.time], ['off', expected.zh_CN.off]]
  );
  assert.strictEqual(search.topContent.tabs.active, 'time');
  assert.strictEqual(search.timeWeight.label, expected.zh_CN.weight);
  assert.strictEqual(search.timeWeight.visible, true, 'the time shows its font weight setting');
  assert.strictEqual(search.seconds.title, expected.zh_CN.seconds);
  assert.strictEqual(search.seconds.toggle.label, expected.zh_CN.seconds);
  assert.strictEqual(search.seconds.visible, true);
}

function assertThemeAwareAlternateFaviconAsset() {
  // The picker previews the alternate favicon as the supplied lumno1.svg.
  const { documentObj, windowObj, sandbox } = createWallpaperSandbox();
  const runtime = createRuntimeWithSettings(sandbox, {
    documentObj,
    windowObj,
    storageArea: null,
    t: (key, fallback) => fallback || key
  });
  runtime.createControls();
  const preview = JSON.stringify(panelOf(runtime).model.favicons.find((item) => item.id === 'alternate').inlineSvg);
  assert.ok(preview.includes('M14.1832'), 'favicon picker preview should use the supplied lumno1.svg shadow shape');
  assert.ok(preview.includes('M34.0761'), 'favicon picker preview should use the supplied lumno1.svg main shape');

  const svg = fs.readFileSync('assets/images/lumno-newtab-favicon.svg', 'utf8');
  assert.match(svg, /prefers-color-scheme:\s*dark/, 'alternate favicon SVG should adapt to dark Chrome themes');
  assert.match(svg, /color:\s*#000000;/i, 'alternate favicon light theme should use the supplied SVG base color');
  assert.match(svg, /--x-nt-favicon-main-opacity:\s*0\.5/i, 'alternate favicon should preserve the supplied SVG light opacity');
  assert.match(svg, /--x-nt-favicon-main-opacity:\s*0\.72/i, 'alternate favicon dark theme should brighten the main mark');
  assert.match(svg, /M14\.1832/, 'alternate favicon should use the supplied lumno1.svg shadow shape');
  assert.match(svg, /M34\.0761/, 'alternate favicon should use the supplied lumno1.svg main shape');
  assert.match(svg, /currentColor/, 'alternate favicon SVG should be tintable from its root color');
  assert.doesNotMatch(svg, /fill="black"/i, 'alternate favicon should not keep fixed black fills');
  assert.doesNotMatch(svg, /url\(#paint/i, 'alternate favicon should not depend on fixed gradient paints');

  const darkPreview = parsePageCss('newtab.html').rule('body[data-theme="dark"] .x-nt-favicon-svg-preview');
  assert.deepStrictEqual(
    darkPreview && [darkPreview.get('color'), darkPreview.get('--x-nt-favicon-main-opacity')],
    ['#f1f3f4', '0.72'],
    'newtab.html should tint the SVG picker preview from the actual UI dark theme'
  );
}

function testNewtabFaviconPreloadAppliesCachedAlternateBeforeMainRuntime() {
  const documentObj = createFakeDocument();
  const windowObj = createFakeWindow();
  windowObj.localStorage.setItem(NEWTAB_FAVICON_PRELOAD_STORAGE_KEY, 'alternate');
  const sandbox = {
    ...REAL_WALLPAPER_DEPENDENCIES,
    document: documentObj,
    window: windowObj,
    chrome: {
      runtime: {
        getURL: (path) => `chrome-extension://abc/${String(path || '').replace(/^\/+/, '')}`
      }
    }
  };

  vm.runInNewContext(moduleScript('src/newtab/wallpaper/wallpaper-preload.ts', undefined, null, { 'src/domain/settings/index.ts': 'LumnoSettings', 'src/newtab/remote-content.ts': 'LumnoNewtabRemoteContent', 'src/newtab/wallpaper/wallpaper-adaptive-tone.ts': 'LumnoNewtabWallpaperAdaptiveTone', 'src/newtab/wallpaper/wallpaper-effects.ts': 'LumnoNewtabWallpaperEffects', 'src/shared/wallpaper-local-store.ts': 'LumnoNewtabWallpaperLocalStore' }), sandbox, {
    filename: 'src/newtab/wallpaper/wallpaper-preload.ts'
  });

  const faviconLink = documentObj.head.children.find((child) => child.tagName === 'LINK' &&
    child.getAttribute('data-lumno-newtab-favicon') === 'true');
  assert.ok(faviconLink, 'wallpaper preload should apply the cached New Tab favicon before main runtime');
  assert.strictEqual(faviconLink.getAttribute('rel'), 'icon');
  assert.strictEqual(faviconLink.getAttribute('type'), 'image/svg+xml');
  assert.strictEqual(faviconLink.getAttribute('sizes'), 'any');
  assert.strictEqual(faviconLink.getAttribute('data-newtab-favicon-id'), 'alternate');
  assert.ok(
    faviconLink.getAttribute('href').includes('assets/images/lumno-newtab-favicon.svg'),
    'cached alternate favicon should use the theme-aware monochrome SVG asset before the colorful default can flash'
  );

  const page = new JSDOM(readPageSource('newtab.html')).window.document;
  const staticFavicon = page.querySelector('link[data-lumno-newtab-favicon="true"]');
  const precedes = (first, second) => Boolean(first && second && (first.compareDocumentPosition(second) & 4));
  assert.ok(staticFavicon, 'newtab.html should include a static monochrome favicon link');
  assert.ok(precedes(staticFavicon, page.querySelector('title')),
    'newtab.html should expose the monochrome favicon before the title can use the extension default icon');
  const preload = page.querySelector('script[src="../../build/newtab-preload.js"]');
  assert.ok(getBundleFiles('newtab-preload').includes('src/newtab/wallpaper/wallpaper-preload.ts'),
    'newtab.html should run wallpaper-preload in its head preload bundle');
  assert.ok(precedes(staticFavicon, preload), 'newtab.html should expose the monochrome favicon before the external preload script runs');
  const firstStylesheet = page.querySelector('link[rel="stylesheet"]');
  if (firstStylesheet) {
    assert.ok(precedes(preload, firstStylesheet), 'newtab.html should run wallpaper-preload before stylesheets so favicon is set early');
  }

  // The legacy lumno-newtab page only redirects to the primary page.
  const fallback = new JSDOM(fs.readFileSync('src/newtab/lumno-newtab.html', 'utf8')).window.document;
  assert.deepStrictEqual(
    Array.from(fallback.scripts).map((script) => script.getAttribute('src')),
    ['../../build/lumno-newtab.js'],
    'lumno-newtab fallback should load only its redirect (no wallpaper preload, no inline script) through an external script allowed by extension CSP'
  );
  const replaced = [];
  vm.runInNewContext(fs.readFileSync('src/newtab/lumno-newtab.ts', 'utf8'), {
    URL,
    window: {
      location: {
        href: 'chrome-extension://abc/src/newtab/lumno-newtab.html?q=1#top',
        search: '?q=1',
        hash: '#top',
        replace: (href) => replaced.push(href)
      }
    }
  });
  assert.deepStrictEqual(replaced, ['chrome-extension://abc/newtab.html?q=1&focus=1#top'],
    'lumno-newtab fallback should redirect into the primary New Tab, keeping its query and hash and focusing the search');
}

async function testWallpaperPreloadUsesTheCachedResolvedMode() {
  const runWallpaperPreload = (documentObj, windowObj) => {
    const preloadSandbox = {
      ...REAL_WALLPAPER_DEPENDENCIES,
      document: documentObj,
      window: windowObj,
      chrome: {
        runtime: {
          getURL: (path) => `chrome-extension://abc/${String(path || '').replace(/^\/+/, '')}`
        }
      }
    };
    vm.runInNewContext(moduleScript('src/newtab/wallpaper/wallpaper-preload.ts', undefined, null, { 'src/domain/settings/index.ts': 'LumnoSettings', 'src/newtab/remote-content.ts': 'LumnoNewtabRemoteContent', 'src/newtab/wallpaper/wallpaper-adaptive-tone.ts': 'LumnoNewtabWallpaperAdaptiveTone', 'src/newtab/wallpaper/wallpaper-effects.ts': 'LumnoNewtabWallpaperEffects', 'src/shared/wallpaper-local-store.ts': 'LumnoNewtabWallpaperLocalStore' }), preloadSandbox, {
      filename: 'src/newtab/wallpaper/wallpaper-preload.ts'
    });
    return preloadSandbox;
  };
  const documentObj = createFakeDocument();
  const windowObj = createFakeWindow();
  windowObj.localStorage.setItem(WALLPAPER_PRELOAD_STORAGE_KEY, JSON.stringify({
    version: WALLPAPER_PRELOAD_STORAGE_VERSION,
    mode: 'dark',
    themeMode: 'dark',
    overlayStops: {
      light: { top: 0, mid: 0, bottom: 0 },
      dark: { top: 4.4, mid: 2, bottom: 5 }
    },
    wallpapers: {
      light: {
        id: 'monet-coastal-white',
        path: 'assets/wallpapers/lumno-newtab-monet-coastal-white.webp'
      },
      dark: {
        id: 'dark-shanshui-moonlit',
        path: 'assets/wallpapers/lumno-newtab-dark-shanshui-moonlit.webp'
      }
    },
    wallpaperEffects: {
      light: { type: 'grain', spacing: -20, crtSpacing: 73, crtGrain: 9 },
      dark: { type: 'grain', spacing: 240, crtSpacing: 73, crtGrain: 9 }
    }
  }));
  const preloadSandbox = runWallpaperPreload(documentObj, windowObj);
  const preloadedEffectPrefs = await preloadSandbox.__lumnoBoot?.wallpaperPreload.effectPrefsReady;
  assert.strictEqual(preloadedEffectPrefs.spacing, 100);
  assert.strictEqual(preloadedEffectPrefs.crtSpacing, undefined);
  assert.strictEqual(preloadedEffectPrefs.crtGrain, undefined);

  const preloadedImage = documentObj.documentElement.style.getPropertyValue('--x-nt-wallpaper-image');
  assert.ok(
    preloadedImage.includes('lumno-newtab-dark-shanshui-moonlit.webp'),
    'dark mode should preload its own wallpaper instead of the cached light fallback'
  );
  assert.doesNotMatch(
    preloadedImage,
    /monet-coastal-white/,
    'dark mode preload should not paint the default white wallpaper first'
  );
  assert.strictEqual(
    documentObj.documentElement.getAttribute('data-wallpaper-preload-theme'),
    'dark',
    'the preload should expose a dark placeholder before the runtime resolves the theme'
  );
  assert.strictEqual(
    documentObj.documentElement.style.getPropertyValue('--x-nt-wallpaper-overlay-dark-top'),
    '4.4%',
    'the first wallpaper frame should use the cached mask strength instead of the default overlay'
  );

  const localDocument = createFakeDocument();
  const localWindow = createFakeWindow();
  localWindow.localStorage.setItem(WALLPAPER_PRELOAD_STORAGE_KEY, JSON.stringify({
    version: WALLPAPER_PRELOAD_STORAGE_VERSION,
    mode: 'dark',
    themeMode: 'dark',
    overlayStops: {
      light: { top: 0, mid: 0, bottom: 0 },
      dark: { top: 4.4, mid: 2, bottom: 5 }
    },
    wallpapers: {
      light: {
        id: 'monet-coastal-white',
        path: 'assets/wallpapers/lumno-newtab-monet-coastal-white.webp'
      },
      dark: null
    }
  }));
  runWallpaperPreload(localDocument, localWindow);
  assert.strictEqual(
    localDocument.documentElement.getAttribute('data-wallpaper-preload-theme'),
    'dark',
    'a local-only wallpaper should keep a dark placeholder while its image data loads'
  );
  assert.strictEqual(
    localDocument.documentElement.style.getPropertyValue('--x-nt-wallpaper-image'),
    '',
    'a local-only dark wallpaper should not preload the synced white fallback'
  );

  // No blurred stand-in: a copy of the wallpaper left in the cache by an older version paints nothing.
  const oldCopyDocument = createFakeDocument();
  const oldCopyWindow = createFakeWindow();
  oldCopyWindow.localStorage.setItem(WALLPAPER_PRELOAD_STORAGE_KEY, JSON.stringify({
    version: WALLPAPER_PRELOAD_STORAGE_VERSION,
    mode: 'light',
    themeMode: 'light',
    overlayStops: {
      light: { top: 54, mid: 20, bottom: 38 },
      dark: { top: 44, mid: 20, bottom: 50 }
    },
    wallpapers: { light: { id: 'custom-wallpaper-1', placeholder: 'data:image/webp;base64,UklGRhIAAABXRUJQVlA4TAYAAAAvQWxvAGs=',
      placeholderKey: 'custom-wallpaper-1' }, dark: null }
  }));
  runWallpaperPreload(oldCopyDocument, oldCopyWindow);
  assert.strictEqual(oldCopyDocument.documentElement.style.getPropertyValue('--x-nt-wallpaper-placeholder'), '');
  assert.strictEqual(oldCopyDocument.documentElement.getAttribute('data-wallpaper-placeholder'), null,
    'the New Tab never opens on a blurred copy of its wallpaper');

  const preloadRemote = (url) => {
    const remoteDocument = createFakeDocument();
    const remoteWindow = createFakeWindow();
    remoteWindow.localStorage.setItem(WALLPAPER_PRELOAD_STORAGE_KEY, JSON.stringify({
      version: WALLPAPER_PRELOAD_STORAGE_VERSION,
      mode: 'light',
      themeMode: 'light',
      overlayStops: {
        light: { top: 0, mid: 0, bottom: 0 },
        dark: { top: 0, mid: 0, bottom: 0 }
      },
      wallpapers: { light: { id: 'picsum-28', url }, dark: null }
    }));
    runWallpaperPreload(remoteDocument, remoteWindow);
    return remoteDocument.documentElement.style.getPropertyValue('--x-nt-wallpaper-image');
  };
  for (const url of ['https://picsum.photos/id/28/2560/1440',
    'https://www.bing.com/th?id=OHR.Example_1920x1080.jpg&pid=hp', 'https://evil.example/id/28/2560/1440']) {
    assert.strictEqual(preloadRemote(url), '',
      'the first frame never waits on the network, even for an online photo an older version cached');
  }

  const staleDocument = createFakeDocument();
  const staleWindow = createFakeWindow();
  staleWindow.localStorage.setItem(WALLPAPER_PRELOAD_STORAGE_KEY, JSON.stringify({
    version: 2,
    mode: 'dark',
    themeMode: 'dark',
    wallpapers: {
      light: null,
      dark: {
        id: DEFAULT_WALLPAPER_ID,
        path: 'assets/wallpapers/lumno-newtab-monet-coastal-white.webp'
      }
    }
  }));
  runWallpaperPreload(staleDocument, staleWindow);
  assert.strictEqual(
    staleDocument.documentElement.style.getPropertyValue('--x-nt-wallpaper-image'),
    '',
    'stale mode-aware caches that may contain the fallback race should be ignored after the fix'
  );
}

function createMemoryStorage(initialData) {
  const data = Object.assign({}, initialData || {});
  const sets = [];
  return {
    data,
    sets,
    get(keys, callback) {
      const keyList = Array.isArray(keys) ? keys : [keys];
      const result = {};
      keyList.forEach((key) => {
        if (Object.prototype.hasOwnProperty.call(data, key)) {
          result[key] = data[key];
        }
      });
      callback(result);
    },
    set(payload, callback) {
      sets.push(Object.assign({}, payload || {}));
      Object.assign(data, payload || {});
      if (callback) {
        callback();
      }
    }
  };
}

function createLocalWallpaperStoreApi(records, metrics) {
  const items = Array.isArray(records) ? records.slice() : [];
  const calls = metrics || {};
  calls.readAll = Number(calls.readAll) || 0;
  calls.readByIds = Array.isArray(calls.readByIds) ? calls.readByIds : [];
  return {
    CUSTOM_WALLPAPER_ID: 'custom-upload',
    CUSTOM_WALLPAPER_ID_PREFIX,
    createWallpaperLocalStore() {
      return {
        isCustomWallpaperId(id) {
          return String(id || '').startsWith(CUSTOM_WALLPAPER_ID_PREFIX);
        },
        normalizeRecord(record) {
          if (!record || !record.imageDataUrl) {
            return null;
          }
          return {
            id: String(record.id || ''),
            key: String(record.key || record.id || ''),
            name: String(record.name || ''),
            imageDataUrl: String(record.imageDataUrl || ''),
            thumbnailDataUrl: String(record.thumbnailDataUrl || record.imageDataUrl || ''),
            updatedAt: Number(record.updatedAt) || 1
          };
        },
        readAll() {
          calls.readAll += 1;
          return Promise.resolve(items);
        },
        readByIds(ids) {
          const requestedIds = Array.isArray(ids) ? ids.slice() : [];
          calls.readByIds.push(requestedIds);
          return Promise.resolve(items.filter((record) => {
            const recordId = String(record && record.id || '');
            return requestedIds.includes(recordId) ||
              (requestedIds.includes('custom-upload') && recordId === `${CUSTOM_WALLPAPER_ID_PREFIX}legacy`);
          }));
        },
        write() {
          return Promise.resolve();
        },
        remove(record) {
          const index = items.findIndex((item) => item && item.id === (record && record.id));
          if (index !== -1) {
            items.splice(index, 1);
          }
          return Promise.resolve();
        },
        buildRecordFromFile() {
          return Promise.reject(new Error('not implemented'));
        }
      };
    }
  };
}

function createWallpaperSandbox(options) {
  const testDocument = createFakeDocument();
  const testWindow = createFakeWindow();
  const testSandbox = {
    console,
    setTimeout,
    clearTimeout,
    requestAnimationFrame: testWindow.requestAnimationFrame,
    cancelAnimationFrame: testWindow.cancelAnimationFrame,
    URL,
    AbortController,
    File,
    Event: testWindow.Event,
    Image: options && options.Image ? options.Image : createFakeImageClass(),
    globalThis: null,
    document: testDocument,
    window: testWindow,
    BroadcastChannel: options && options.BroadcastChannel ? options.BroadcastChannel : undefined,
    chrome: {
      runtime: {
        getURL: (path) => `chrome-extension://abc/${String(path || '').replace(/^\/+/, '')}`
      }
    },
    ...REAL_WALLPAPER_DEPENDENCIES,
    // Test doubles replace individual functions of the real modules.
    LumnoNewtabRemoteContent: Object.assign(
      {},
      REAL_WALLPAPER_DEPENDENCIES.LumnoNewtabRemoteContent,
      options && options.remoteApi
    ),
    LumnoNewtabWallpaperEffects: Object.assign(
      {},
      REAL_WALLPAPER_DEPENDENCIES.LumnoNewtabWallpaperEffects,
      options && options.effectsApi
    ),
    LumnoNewtabWallpaperLocalStore: Object.assign(
      {},
      REAL_WALLPAPER_DEPENDENCIES.LumnoNewtabWallpaperLocalStore,
      options && options.localStoreApi
    ),
    LumnoNewtabWallpaperAdaptiveTone: Object.assign(
      {},
      REAL_WALLPAPER_DEPENDENCIES.LumnoNewtabWallpaperAdaptiveTone,
      options && options.adaptiveToneApi
    ),
    LumnoNewtabWallpaperViewModule: {
      getWallpaperViewApi: () => ({ createController: createRecordingWallpaperViewController })
    },
    // What wallpaper-preload.ts left for the runtime, when a test ran it first.
    __lumnoBoot: options && options.preload ? { wallpaperPreload: options.preload } : undefined
  };
  if (options && typeof options.prepareWindow === 'function') {
    options.prepareWindow(testWindow, testDocument);
  }
  testSandbox.globalThis = testSandbox;
  vm.runInNewContext(readWallpaperRuntimeSource(WALLPAPER_DEPENDENCY_GLOBALS), testSandbox, {
    filename: 'src/newtab/wallpaper/wallpaper.ts'
  });
  return { documentObj: testDocument, windowObj: testWindow, sandbox: testSandbox };
}

const documentObj = createFakeDocument();
const windowObj = createFakeWindow();

const sandbox = {
  console,
  setTimeout,
  clearTimeout,
  requestAnimationFrame: windowObj.requestAnimationFrame,
  cancelAnimationFrame: windowObj.cancelAnimationFrame,
  URL,
  Event: windowObj.Event,
  Image: createFakeImageClass(),
  globalThis: null,
  document: documentObj,
  window: windowObj,
  chrome: {
    runtime: {
      getURL: (path) => `chrome-extension://abc/${String(path || '').replace(/^\/+/, '')}`
    }
  },
  ...REAL_WALLPAPER_DEPENDENCIES,
  LumnoNewtabWallpaperViewModule: {
    getWallpaperViewApi: () => ({ createController: createRecordingWallpaperViewController })
  }
};
sandbox.globalThis = sandbox;

vm.runInNewContext(readWallpaperRuntimeSource(WALLPAPER_DEPENDENCY_GLOBALS), sandbox, {
  filename: 'src/newtab/wallpaper/wallpaper.ts'
});

let inputAutoFocusEnabled = false;
const inputAutoFocusWrites = [];
const inputAutoFocusTooltips = [];
let shortcutsVisible = true;
let shortcutAddVisible = true;
let shortcutDockMagnificationEnabled = true;
let shortcutColumns = 10;
const shortcutPreferenceWrites = [];
const runtime = createRuntimeWithSettings(sandbox, {
  documentObj,
  windowObj,
  storageArea: null,
  getInputAutoFocusEnabled: () => inputAutoFocusEnabled,
  setInputAutoFocusEnabled(value) {
    inputAutoFocusEnabled = Boolean(value);
    inputAutoFocusWrites.push(inputAutoFocusEnabled);
  },
  getShortcutsVisible: () => shortcutsVisible,
  setShortcutsVisible(value) {
    shortcutsVisible = Boolean(value);
    shortcutPreferenceWrites.push(['visible', shortcutsVisible]);
  },
  getShortcutAddVisible: () => shortcutAddVisible,
  setShortcutAddVisible(value) {
    shortcutAddVisible = Boolean(value);
    shortcutPreferenceWrites.push(['add', shortcutAddVisible]);
  },
  getShortcutDockMagnificationEnabled: () => shortcutDockMagnificationEnabled,
  setShortcutDockMagnificationEnabled(value) {
    shortcutDockMagnificationEnabled = Boolean(value);
    shortcutPreferenceWrites.push(['dock', shortcutDockMagnificationEnabled]);
  },
  getShortcutColumns: () => shortcutColumns,
  setShortcutColumns(value, options) {
    shortcutColumns = Number(value);
    shortcutPreferenceWrites.push(['columns', shortcutColumns, Boolean(options && options.persist)]);
  },
  showTopActionTooltip(anchor, text) {
    inputAutoFocusTooltips.push({ anchor, text });
  },
  t: (_key, fallback) => fallback || ''
});

runtime.createControls();
const control = runtime.getControlElement();
[
  {
    id: 'impressionist-orchard-white',
    path: 'assets/wallpapers/lumno-newtab-impressionist-orchard-white.webp'
  },
  {
    id: 'pointillist-lakeside-white',
    path: 'assets/wallpapers/lumno-newtab-pointillist-lakeside-white.webp'
  },
  {
    id: 'white-3d-observatory',
    path: 'assets/wallpapers/lumno-newtab-white-3d-observatory.webp'
  },
  {
    id: 'white-shanshui-bamboo-bridge',
    path: 'assets/wallpapers/lumno-newtab-white-shanshui-bamboo-bridge.webp'
  }
].forEach((item) => {
  const tile = findTile(runtime, item.id);
  assert.ok(tile, `${item.id} should render as a built-in wallpaper`);
  assert.strictEqual(tile.source, 'built-in');
  assert.strictEqual(tile.path, item.path, `${item.id} should point to its full-size wallpaper asset`);
  assert.ok(tile.thumbnailUrl.endsWith('-thumb.webp'), `${item.id} should show its thumbnail in the grid`);
});
const panel = panelOf(runtime).panel;
const slider = documentObj.createElement('input');
slider.type = 'range';
panel.appendChild(slider);
documentObj.activeElement = slider;

runtime.closePanel();

assert.strictEqual(slider._blurred, true, 'closing the appearance panel should blur an active slider inside it');
assert.strictEqual(documentObj.activeElement, null, 'closing the appearance panel should clear activeElement for panel sliders');

openPanel(runtime);
assert.strictEqual(runtime.isPanelOpen(), true);
assert.strictEqual(panelState(runtime).open, true, 'the panel renders open');
assert.strictEqual(control.getAttribute('data-panel-open'), 'true');
assert.strictEqual(panelState(runtime).button.label, 'Appearance');
assert.strictEqual(
  panelState(runtime).header.moreSettingsUrl,
  'chrome-extension://abc/src/options/options.html#appearance',
  'more settings opens the appearance page of the options'
);
const searchWidth = panelState(runtime).search.width;
assert.deepStrictEqual(
  [searchWidth.min, searchWidth.max, searchWidth.value, searchWidth.suffix, searchWidth.valueText],
  [640, 1040, 920, ' px', '920 px'],
  'the search width slider shows the page width in pixels'
);
assert.deepStrictEqual(
  toHostRealm(panelOf(runtime).model.marks.searchWidth),
  [0, 20, 70, 100],
  'the search width marks sit on the snap points 640, 720, 920 and 1040'
);
assert.strictEqual(panelState(runtime).search.autoFocus.toggle.checked, false, 'input auto-focus should default to disabled');
assert.strictEqual(panelState(runtime).shortcuts.enabled, true, 'shortcuts should default to enabled');
assert.strictEqual(panelState(runtime).shortcuts.toggle.checked, true);
assert.strictEqual(panelState(runtime).shortcuts.columns.value, 10);
assert.deepStrictEqual(
  [panelState(runtime).shortcuts.columns.min, panelState(runtime).shortcuts.columns.max],
  [4, 16]
);
const panelActionsForMain = panelActions(runtime);
panelActionsForMain.setShortcutColumns(7, NOT_DRAGGING);
assert.deepStrictEqual(shortcutPreferenceWrites[shortcutPreferenceWrites.length - 1], ['columns', 7, false],
  'moving the slider previews the column count without saving it');
panelActionsForMain.setShortcutColumns(7, TYPED);
assert.strictEqual(shortcutColumns, 7, 'the slider should preserve every integer without snapping');
assert.deepStrictEqual(shortcutPreferenceWrites[shortcutPreferenceWrites.length - 1], ['columns', 7, true],
  'the end of a move saves the column count');
assert.strictEqual(panelState(runtime).shortcuts.columns.value, 7, 'the panel shows the new column count');
panelActionsForMain.setShortcutColumns(11, TYPED);
assert.strictEqual(shortcutColumns, 11, 'a typed exact integer should commit');
panelActionsForMain.setShortcutColumns(99, TYPED);
assert.strictEqual(shortcutColumns, 16, 'values beyond the range should clamp to the supported range');
panelActionsForMain.setShortcutsVisible(false);
assert.strictEqual(shortcutsVisible, false);
assert.strictEqual(panelState(runtime).shortcuts.enabled, false, 'turning shortcuts off disables their settings');
assert.strictEqual(panelState(runtime).shortcuts.toggle.checked, false);
panelActionsForMain.setShortcutsVisible(true);
assert.strictEqual(panelState(runtime).shortcuts.enabled, true, 're-enabling shortcuts should restore their settings');
panelActionsForMain.setShortcutAddVisible(false);
panelActionsForMain.setShortcutDockMagnification(false);
assert.deepStrictEqual(shortcutPreferenceWrites.slice(-2), [['add', false], ['dock', false]]);
assert.strictEqual(panelState(runtime).shortcuts.add.toggle.checked, false);
assert.strictEqual(panelState(runtime).shortcuts.dock.toggle.checked, false);
assert.strictEqual(panelState(runtime).search.autoFocus.infoLabel, 'Input auto-focus info');
assert.strictEqual(
  panelState(runtime).search.autoFocus.infoTooltip,
  'If you prefer to use the browser’s native address bar, turn this option off. The extension URL will no longer appear in the address bar.'
);
const tooltipAnchor = documentObj.createElement('button');
panelActionsForMain.showTooltip(tooltipAnchor, panelState(runtime).search.autoFocus.infoTooltip);
assert.strictEqual(inputAutoFocusTooltips.length, 1);
assert.strictEqual(inputAutoFocusTooltips[0].anchor, tooltipAnchor);
panelActionsForMain.setInputAutoFocus(true);
assert.deepStrictEqual(inputAutoFocusWrites, [true]);
assert.strictEqual(panelState(runtime).search.autoFocus.toggle.checked, true);

const zhCNMessages = JSON.parse(fs.readFileSync('_locales/zh_CN/messages.json', 'utf8'));
assert.strictEqual(
  zhCNMessages.newtab_input_auto_focus_help.message,
  '如倾向使用浏览器原生地址栏，可关闭该选项。关闭后地址栏中的扩展 URL 将不再显示。'
);

function effectState(runtime) {
  return panelState(runtime).wallpaper.effect;
}

async function testOverlayAndStrengthSnapToTheirMarksWhileDragged() {
  const storageArea = createMemoryStorage({});
  const { documentObj: testDocument, windowObj: testWindow, sandbox: testSandbox } =
    createWallpaperSandbox();
  const testRuntime = createRuntimeWithSettings(testSandbox, {
    documentObj: testDocument,
    windowObj: testWindow,
    storageArea,
    storageKeys: { overlay: WALLPAPER_OVERLAY_STORAGE_KEY, effect: WALLPAPER_EFFECT_STORAGE_KEY },
    t: (_key, fallback) => fallback || ''
  });
  testRuntime.createControls();
  openPanel(testRuntime);
  await testRuntime.bootstrapInitialWallpaperOverlay();
  await testRuntime.bootstrapInitialWallpaperEffect();
  const actions = panelActions(testRuntime);
  const overlay = () => panelState(testRuntime).wallpaper.overlay;
  assert.deepStrictEqual([overlay().label, overlay().value, overlay().min, overlay().max], ['Mask effect', 50, 0, 100]);
  actions.setOverlay(53, { dragging: true, final: false });
  assert.strictEqual(overlay().value, 50, 'a dragged mask slider snaps to the default mark');
  actions.setOverlay(97, { dragging: true, final: false });
  assert.strictEqual(overlay().value, 97, 'the cover end only snaps when reached exactly');
  actions.setOverlay(53, NOT_DRAGGING);
  assert.strictEqual(overlay().value, 53, 'keys and typed values keep their exact value');
  actions.setOverlay(148, TYPED);
  assert.strictEqual(overlay().value, 100, 'typed values clamp to the slider range');
  await new Promise((resolve) => setTimeout(resolve, 150));
  assert.deepStrictEqual(clonePlain(storageArea.data[WALLPAPER_OVERLAY_STORAGE_KEY]), { version: 2, light: 100, dark: 50 },
    'only the mask of the current theme mode changes, saved once the slider settles');
  assert.strictEqual(storageArea.sets.filter((set) => WALLPAPER_OVERLAY_STORAGE_KEY in set).length, 1,
    'quick slider moves save once');

  actions.selectEffect('grain');
  actions.setEffectParameter('strength', 47, { dragging: true, final: false });
  assert.strictEqual(effectState(testRuntime).sliders.strength.value, 50, 'filter strength snaps while dragged');
  actions.setEffectParameter('spacing', 47, { dragging: true, final: false });
  assert.strictEqual(effectState(testRuntime).sliders.spacing.value, 47, 'other filter sliders never snap');
}

async function testWallpaperSourcesHintWaitsForFinalFocusRoute() {
  const pendingRoute = createWallpaperSandbox();
  pendingRoute.documentObj.documentElement.setAttribute(
    'data-nt-focus-route-pending',
    'true'
  );
  let pendingRouteCreates = 0;
  const pendingRuntime = createRuntimeWithSettings(pendingRoute.sandbox, {
    documentObj: pendingRoute.documentObj,
    windowObj: pendingRoute.windowObj,
    storageArea: null,
    featureHints: {
      createFeatureHint() {
        pendingRouteCreates += 1;
        return null;
      }
    },
    t: (_key, fallback) => fallback || ''
  });
  pendingRuntime.createControls();
  await Promise.resolve();
  await Promise.resolve();
  assert.strictEqual(
    pendingRouteCreates,
    0,
    'the pre-redirect New Tab must not create or remember the feature hint while focus routing is pending'
  );

  const settledRoute = createWallpaperSandbox();
  let settledRouteCreates = 0;
  let settledRouteDismissals = 0;
  let createdHintOptions = null;
  const featureHintVisibilityGate = Promise.resolve();
  const hintElement = settledRoute.documentObj.createElement('span');
  hintElement.setAttribute('data-feature-hint-id', 'newtab-wallpaper-sources');
  hintElement.setAttribute('data-visible', 'true');
  const settledRuntime = createRuntimeWithSettings(settledRoute.sandbox, {
    documentObj: settledRoute.documentObj,
    windowObj: settledRoute.windowObj,
    storageArea: null,
    featureHints: {
      createFeatureHint(options) {
        settledRouteCreates += 1;
        createdHintOptions = options;
        return {
          element: hintElement,
          dismiss() {
            settledRouteDismissals += 1;
            hintElement.setAttribute('data-dismissed', 'true');
            hintElement.setAttribute('data-visible', 'false');
          },
          setVisible(visible) {
            hintElement.setAttribute('data-visible', visible ? 'true' : 'false');
          },
          updateLanguage() {}
        };
      }
    },
    featureHintVisibilityGate,
    t: (_key, fallback) => fallback || ''
  });
  settledRuntime.createControls();
  await Promise.resolve();
  await Promise.resolve();
  assert.strictEqual(settledRouteCreates, 1, 'the New Tab should create the new wallpapers hint once');
  assert.strictEqual(createdHintOptions.definition, 'newtab-wallpaper-sources');
  assert.strictEqual(
    createdHintOptions.dismissStorage,
    undefined,
    'the new wallpapers hint should use its normal Sync dismissal state'
  );
  assert.strictEqual(
    createdHintOptions.visibilityGate,
    featureHintVisibilityGate,
    'the new wallpapers hint should receive the page entrance completion gate'
  );
  assert.strictEqual(
    hintElement.parentNode,
    settledRuntime.getControlElement(),
    'the hint should mount beside the appearance button it points at'
  );
  openPanel(settledRuntime);
  assert.strictEqual(
    settledRouteDismissals,
    1,
    'opening the appearance panel should acknowledge and dismiss the visible feature hint'
  );
}

const scopedRuntime = createRuntimeWithSettings(sandbox, {
  documentObj,
  windowObj,
  storageArea: null,
  t: (_key, fallback) => fallback || '',
  getThemeScope: () => 'home'
});
scopedRuntime.createControls();
openPanel(scopedRuntime);
assert.strictEqual(panelState(scopedRuntime).theme.scope.active, 'home');
assert.strictEqual(
  panelState(scopedRuntime).theme.modes.find((mode) => mode.mode === 'system').label,
  'Follow "Global"',
  'the New Tab scope offers to follow the global theme instead of the system'
);
assert.strictEqual(panelState(scopedRuntime).search.width.value, 920,
  'the search width slider stays available in the New Tab scope');

let previewGlobalMode = 'dark';
const previewRuntime = createRuntimeWithSettings(sandbox, {
  documentObj,
  windowObj,
  storageArea: null,
  t: (_key, fallback) => fallback || '',
  getThemeScope: () => 'home',
  getGlobalThemeMode: () => previewGlobalMode
});
previewRuntime.createControls();
openPanel(previewRuntime);
const previewUrl = (mode) => panelState(previewRuntime).theme.modes.find((item) => item.mode === mode).imageUrl;
assert.ok(previewUrl('system').endsWith('assets/images/newtab-dark.svg'),
  'following a dark Global should preview the dark New Tab, not a half-light one');
assert.ok(previewUrl('light').endsWith('assets/images/newtab-light.svg'));
const previewBadge = (mode) => panelState(previewRuntime).theme.modes.find((item) => item.mode === mode).badgeUrl;
assert.ok(previewBadge('system').endsWith('assets/images/lumno.png'),
  'Follow "Global" should carry the Lumno icon');
assert.strictEqual(previewBadge('light'), '', 'fixed modes should not carry the Lumno icon');
previewGlobalMode = 'system';
previewRuntime.updateAppearanceSelectionUi();
assert.ok(previewUrl('system').endsWith('assets/images/newtab-system.svg'),
  'following a Global that follows the system should keep the split preview');

let switchingScope = 'global';
const switchingRuntime = createRuntimeWithSettings(sandbox, {
  documentObj,
  windowObj,
  storageArea: null,
  t: (_key, fallback) => fallback || '',
  getThemeScope: () => switchingScope,
  setThemeScope: (scope) => {
    switchingScope = scope === 'home' ? 'home' : 'global';
  }
});
switchingRuntime.createControls();
openPanel(switchingRuntime);
const switchingTheme = () => panelState(switchingRuntime).theme;
assert.strictEqual(switchingTheme().scope.active, 'global');
assert.strictEqual(switchingTheme().modes.find((mode) => mode.mode === 'system').label, 'Follow system');
assert.deepStrictEqual(
  switchingTheme().modes.map((mode) => mode.imageUrl.split('/').pop()),
  ['system.svg', 'light.svg', 'dark.svg'],
  'the Global scope keeps the shared theme previews used across Lumno'
);
assert.strictEqual(switchingTheme().modes.find((mode) => mode.mode === 'system').badgeUrl, '',
  'Follow system is not a Lumno setting, so it carries no Lumno icon');
assert.deepStrictEqual(
  switchingTheme().scope.options.map((option) => [option.value, option.label]),
  [['global', 'Global'], ['home', 'New Tab']]
);
panelActions(switchingRuntime).selectThemeScope('home');
assert.strictEqual(switchingScope, 'home', 'choosing New Tab should switch theme scope');
assert.strictEqual(switchingTheme().scope.active, 'home');
assert.strictEqual(switchingTheme().modes.find((mode) => mode.mode === 'system').label, 'Follow "Global"');
assert.deepStrictEqual(
  switchingTheme().modes.map((mode) => mode.imageUrl.split('/').pop()),
  ['newtab-system.svg', 'newtab-light.svg', 'newtab-dark.svg'],
  'the New Tab scope previews miniature New Tabs'
);
panelActions(switchingRuntime).selectThemeScope('global');
assert.strictEqual(switchingScope, 'global', 'choosing Global should switch theme scope back');
assert.strictEqual(switchingTheme().scope.active, 'global');

async function testBuiltInWallpaperBootstrapDefersCustomCatalogRead() {
  const localStoreCalls = {};
  const localStoreApi = createLocalWallpaperStoreApi([{
    id: `${CUSTOM_WALLPAPER_ID_PREFIX}unused`,
    imageDataUrl: 'data:image/webp;base64,unused',
    thumbnailDataUrl: 'data:image/webp;base64,unused-thumb',
    updatedAt: 1
  }], localStoreCalls);
  const { documentObj: testDocument, windowObj: testWindow, sandbox: testSandbox } =
    createWallpaperSandbox({ localStoreApi });
  const testRuntime = createRuntimeWithSettings(testSandbox, {
    documentObj: testDocument,
    windowObj: testWindow,
    storageArea: createMemoryStorage({ [WALLPAPER_STORAGE_KEY]: DEFAULT_WALLPAPER_ID }),
    storageKeys: {
      wallpaper: WALLPAPER_STORAGE_KEY,
      localWallpaper: LOCAL_WALLPAPER_STORAGE_KEY
    },
    t: (_key, fallback) => fallback || ''
  });

  await testRuntime.bootstrapInitialWallpaper();

  assert.strictEqual(localStoreCalls.readAll, 0, 'built-in startup should skip the local wallpaper catalog');
  assert.deepStrictEqual(localStoreCalls.readByIds, [], 'built-in startup should not query local wallpaper records');

  testRuntime.createControls();
  openPanel(testRuntime);
  assert.strictEqual(panelState(testRuntime).wallpaper.activeTab, 'built-in');
  assert.strictEqual(localStoreCalls.readAll, 0, 'opening the panel on Built-in should keep the catalog deferred');

  panelActions(testRuntime).selectSourceTab('local');
  assert.strictEqual(panelState(testRuntime).wallpaper.activeTab, 'local');
  assert.strictEqual(localStoreCalls.readAll, 1, 'opening Local should load the full catalog once');
  await Promise.resolve();
  await Promise.resolve();
  assert.ok(findTile(testRuntime, `${CUSTOM_WALLPAPER_ID_PREFIX}unused`), 'the catalog fills the local tiles');
  panelActions(testRuntime).selectSourceTab('built-in');
  panelActions(testRuntime).selectSourceTab('local');
  assert.strictEqual(localStoreCalls.readAll, 1, 'reopening Local should reuse the loaded catalog');
}

async function testWallpaperTileIntentReusesDecodedImagePromise() {
  const imageHarness = createDeferredWallpaperImageHarness();
  const { documentObj: testDocument, windowObj: testWindow, sandbox: testSandbox } =
    createWallpaperSandbox({ Image: imageHarness.Image });
  const testRuntime = createRuntimeWithSettings(testSandbox, {
    documentObj: testDocument,
    windowObj: testWindow,
    storageArea: createMemoryStorage({ [WALLPAPER_STORAGE_KEY]: DEFAULT_WALLPAPER_ID }),
    storageKeys: { wallpaper: WALLPAPER_STORAGE_KEY },
    t: (_key, fallback) => fallback || ''
  });

  await testRuntime.bootstrapInitialWallpaper();
  testRuntime.createControls();
  openPanel(testRuntime);
  // Hovering, focusing and pressing a tile each prime its image.
  panelActions(testRuntime).primeWallpaper('white-shanshui');
  panelActions(testRuntime).primeWallpaper('white-shanshui');
  panelActions(testRuntime).primeWallpaper('white-shanshui');
  assert.strictEqual(imageHarness.requests.length, 1, 'all selection-intent events should share one image request');

  clickTile(testRuntime, 'white-shanshui');
  assert.strictEqual(imageHarness.requests.length, 1, 'click should reuse the image promise primed by selection intent');
  assert.ok(
    testDocument.documentElement.style
      .getPropertyValue('--x-nt-wallpaper-image')
      .includes('lumno-newtab-monet-coastal-white.webp'),
    'the previous wallpaper should remain visible while the target image decodes'
  );
  assert.strictEqual(findTile(testRuntime, 'white-shanshui').selected, true,
    'the chosen tile is highlighted at once');

  imageHarness.requests[0].resolveDecode();
  await waitForAsyncWallpaperApply();
  assert.ok(
    testDocument.documentElement.style
      .getPropertyValue('--x-nt-wallpaper-image')
      .includes('lumno-newtab-white-shanshui.webp'),
    'the primed wallpaper should apply after its shared decode promise resolves'
  );
}

async function testRapidWallpaperSelectionNeverAppliesStaleDecode() {
  const imageHarness = createDeferredWallpaperImageHarness();
  const { documentObj: testDocument, windowObj: testWindow, sandbox: testSandbox } =
    createWallpaperSandbox({ Image: imageHarness.Image });
  const testRuntime = createRuntimeWithSettings(testSandbox, {
    documentObj: testDocument,
    windowObj: testWindow,
    storageArea: createMemoryStorage({ [WALLPAPER_STORAGE_KEY]: DEFAULT_WALLPAPER_ID }),
    storageKeys: { wallpaper: WALLPAPER_STORAGE_KEY },
    t: (_key, fallback) => fallback || ''
  });

  await testRuntime.bootstrapInitialWallpaper();
  testRuntime.createControls();
  openPanel(testRuntime);
  clickTile(testRuntime, 'white-shanshui');
  clickTile(testRuntime, 'dark-shanshui-moonlit');
  await new Promise((resolve) => setTimeout(resolve, 5));

  const firstRequest = imageHarness.requests.find((request) => request.src.includes('white-shanshui.webp'));
  const secondRequest = imageHarness.requests.find((request) => request.src.includes('dark-shanshui-moonlit.webp'));
  assert.ok(firstRequest && secondRequest, 'rapid selections should start both target decodes');

  secondRequest.resolveDecode();
  await waitForAsyncWallpaperApply();
  assert.ok(
    testDocument.documentElement.style
      .getPropertyValue('--x-nt-wallpaper-image')
      .includes('lumno-newtab-dark-shanshui-moonlit.webp'),
    'the latest decoded wallpaper should apply first'
  );

  firstRequest.resolveDecode();
  await waitForAsyncWallpaperApply();
  assert.ok(
    testDocument.documentElement.style
      .getPropertyValue('--x-nt-wallpaper-image')
      .includes('lumno-newtab-dark-shanshui-moonlit.webp'),
    'a stale decode should never replace the latest wallpaper selection'
  );
}

async function testSyncedCustomWallpaperWithoutLocalRecordFallsBackToDefault() {
  const syncStorage = createMemoryStorage({
    [WALLPAPER_STORAGE_KEY]: `${CUSTOM_WALLPAPER_ID_PREFIX}remote-only`
  });
  const { documentObj: testDocument, windowObj: testWindow, sandbox: testSandbox } = createWallpaperSandbox();
  const testRuntime = createRuntimeWithSettings(testSandbox, {
    documentObj: testDocument,
    windowObj: testWindow,
    storageArea: syncStorage,
    storageKeys: {
      wallpaper: WALLPAPER_STORAGE_KEY,
      localWallpaper: LOCAL_WALLPAPER_STORAGE_KEY
    },
    t: (_key, fallback) => fallback || ''
  });

  await testRuntime.bootstrapInitialWallpaper();

  assert.strictEqual(
    testDocument.body.getAttribute('data-wallpaper-active'),
    'true',
    'missing local wallpaper records should not leave the new tab with a blank wallpaper'
  );
  assert.ok(
    testDocument.documentElement.style
      .getPropertyValue('--x-nt-wallpaper-image')
      .includes('lumno-newtab-monet-coastal-white.webp'),
    'missing synced custom wallpaper should fall back to the default built-in wallpaper'
  );
  assert.strictEqual(
    syncStorage.data[WALLPAPER_STORAGE_KEY],
    DEFAULT_WALLPAPER_ID,
    'a synced custom wallpaper id without local image data should be sanitized to a built-in wallpaper'
  );
}

async function testUnrecognizedSyncedWallpaperIsNotWrittenBack() {
  const futureId = 'future-source-photo';
  const syncStorage = createMemoryStorage({ [WALLPAPER_STORAGE_KEY]: futureId });
  const { documentObj: testDocument, windowObj: testWindow, sandbox: testSandbox } = createWallpaperSandbox();
  const testRuntime = createRuntimeWithSettings(testSandbox, {
    documentObj: testDocument,
    windowObj: testWindow,
    storageArea: syncStorage,
    storageKeys: {
      wallpaper: WALLPAPER_STORAGE_KEY,
      localWallpaper: LOCAL_WALLPAPER_STORAGE_KEY
    },
    t: (_key, fallback) => fallback || ''
  });

  await testRuntime.bootstrapInitialWallpaper();

  assert.ok(
    testDocument.documentElement.style
      .getPropertyValue('--x-nt-wallpaper-image')
      .includes('lumno-newtab-monet-coastal-white.webp'),
    'an unrecognized synced wallpaper should show the default wallpaper'
  );
  assert.strictEqual(
    syncStorage.data[WALLPAPER_STORAGE_KEY],
    futureId,
    'an ID from a newer install sharing sync storage must not be overwritten'
  );
}

async function testLegacySyncedCustomWallpaperMigratesToLocalOnlySelection() {
  const customWallpaperId = `${CUSTOM_WALLPAPER_ID_PREFIX}local-record`;
  const localStoreCalls = {};
  const syncStorage = createMemoryStorage({
    [WALLPAPER_STORAGE_KEY]: customWallpaperId
  });
  const localStorageArea = createMemoryStorage();
  const localStoreApi = createLocalWallpaperStoreApi([{
    id: customWallpaperId,
    imageDataUrl: 'data:image/webp;base64,wallpaper',
    thumbnailDataUrl: 'data:image/webp;base64,thumb',
    updatedAt: 1
  }], localStoreCalls);
  const { documentObj: testDocument, windowObj: testWindow, sandbox: testSandbox } = createWallpaperSandbox({
    localStoreApi
  });
  const testRuntime = createRuntimeWithSettings(testSandbox, {
    documentObj: testDocument,
    windowObj: testWindow,
    storageArea: syncStorage,
    localWallpaperStorageArea: localStorageArea,
    storageKeys: {
      wallpaper: WALLPAPER_STORAGE_KEY,
      localWallpaper: LOCAL_WALLPAPER_STORAGE_KEY
    },
    t: (_key, fallback) => fallback || ''
  });

  await testRuntime.bootstrapInitialWallpaper();

  assert.ok(
    testDocument.documentElement.style
      .getPropertyValue('--x-nt-wallpaper-image')
      .includes('data:image/webp;base64,wallpaper'),
    'a legacy synced custom wallpaper that exists locally should still render on this device'
  );
  assert.strictEqual(
    localStorageArea.data[LOCAL_WALLPAPER_STORAGE_KEY],
    customWallpaperId,
    'custom wallpaper selection should be migrated to local-only storage'
  );
  assert.strictEqual(
    syncStorage.data[WALLPAPER_STORAGE_KEY],
    DEFAULT_WALLPAPER_ID,
    'custom wallpaper ids should not remain in sync storage after migration'
  );
  assert.deepStrictEqual(
    clonePlain(localStoreCalls.readByIds),
    [[customWallpaperId]],
    'initial custom wallpaper loading should target only the referenced local record'
  );
  assert.strictEqual(
    localStoreCalls.readAll,
    0,
    'initial custom wallpaper loading should not read the full local catalog'
  );
}

async function testOversizedDataUrlWallpaperRendersThroughBlobUrl() {
  // Chrome drops a CSS custom property over 2 MB, so a stored wallpaper whose data URL is longer
  // would leave the page blank; it has to reach --x-nt-wallpaper-image as a blob URL.
  const customWallpaperId = `${CUSTOM_WALLPAPER_ID_PREFIX}oversized`;
  const payload = 'A'.repeat(2 * 1024 * 1024 + 400);
  const localStoreApi = createLocalWallpaperStoreApi([{
    id: customWallpaperId,
    imageDataUrl: `data:image/webp;base64,${payload}`,
    thumbnailDataUrl: 'data:image/webp;base64,thumb',
    updatedAt: 1
  }]);
  const { documentObj: testDocument, windowObj: testWindow, sandbox: testSandbox } = createWallpaperSandbox({
    localStoreApi
  });
  const created = [];
  testWindow.atob = (value) => Buffer.from(value, 'base64').toString('binary');
  testWindow.Blob = Blob;
  testWindow.URL = {
    createObjectURL(blob) {
      created.push(blob);
      return `blob:chrome-extension://abc/wallpaper-${created.length}`;
    },
    revokeObjectURL() {}
  };
  const testRuntime = createRuntimeWithSettings(testSandbox, {
    documentObj: testDocument,
    windowObj: testWindow,
    storageArea: createMemoryStorage(),
    localWallpaperStorageArea: createMemoryStorage({ [LOCAL_WALLPAPER_STORAGE_KEY]: customWallpaperId }),
    storageKeys: {
      wallpaper: WALLPAPER_STORAGE_KEY,
      localWallpaper: LOCAL_WALLPAPER_STORAGE_KEY
    },
    t: (_key, fallback) => fallback || ''
  });

  await testRuntime.bootstrapInitialWallpaper();

  assert.strictEqual(
    testDocument.documentElement.style.getPropertyValue('--x-nt-wallpaper-image'),
    'url("blob:chrome-extension://abc/wallpaper-1")',
    'an oversized data URL wallpaper should be set as a blob URL'
  );
  assert.strictEqual(created.length, 1);
  assert.strictEqual(created[0].type, 'image/webp');
  assert.strictEqual(created[0].size, Buffer.from(payload, 'base64').byteLength);
}

async function testInitialThemeResolutionDoesNotPaintFallbackBeforeCustomWallpaper() {
  for (const mode of ['light', 'dark']) {
    const customWallpaperId = `${CUSTOM_WALLPAPER_ID_PREFIX}initial-${mode}`;
    const syncStorage = createMemoryStorage({
      [WALLPAPER_STORAGE_KEY]: {
        version: WALLPAPER_PREFS_STORAGE_VERSION,
        sameForModes: false,
        light: DEFAULT_WALLPAPER_ID,
        dark: DEFAULT_WALLPAPER_ID
      }
    });
    const localStorageArea = createMemoryStorage({
      [LOCAL_WALLPAPER_STORAGE_KEY]: {
        version: WALLPAPER_PREFS_STORAGE_VERSION,
        light: customWallpaperId,
        dark: customWallpaperId
      }
    });
    const localStoreApi = createLocalWallpaperStoreApi([{
      id: customWallpaperId,
      imageDataUrl: `data:image/webp;base64,initial-${mode}`,
      thumbnailDataUrl: `data:image/webp;base64,thumb-${mode}`,
      updatedAt: 1
    }]);
    const { documentObj: testDocument, windowObj: testWindow, sandbox: testSandbox } = createWallpaperSandbox({
      localStoreApi
    });
    testDocument.body.setAttribute('data-theme', mode);
    const testRuntime = createRuntimeWithSettings(testSandbox, {
      documentObj: testDocument,
      windowObj: testWindow,
      storageArea: syncStorage,
      localWallpaperStorageArea: localStorageArea,
      storageKeys: {
        wallpaper: WALLPAPER_STORAGE_KEY,
        localWallpaper: LOCAL_WALLPAPER_STORAGE_KEY
      },
      t: (_key, fallback) => fallback || ''
    });

    testRuntime.handleThemeModeChange();

    assert.strictEqual(
      testDocument.documentElement.style.getPropertyValue('--x-nt-wallpaper-image'),
      '',
      `${mode} theme resolution should not paint the synced fallback before local state loads`
    );
    assert.strictEqual(
      testDocument.body.getAttribute('data-wallpaper-active'),
      null,
      `${mode} theme resolution should leave the wallpaper visual pending before local state loads`
    );

    await testRuntime.bootstrapInitialWallpaper();

    const preloadCache = JSON.parse(testWindow.localStorage.getItem(WALLPAPER_PRELOAD_STORAGE_KEY));
    assert.strictEqual(
      preloadCache.version,
      WALLPAPER_PRELOAD_STORAGE_VERSION,
      `${mode} mode should replace stale preload data with the pending-safe cache format`
    );
    assert.deepStrictEqual(
      preloadCache.wallpapers[mode],
      { id: customWallpaperId, customImage: { id: customWallpaperId } },
      `${mode} mode should point the preload at its upload in IndexedDB, never at a bundled file`
    );

    assert.ok(
      testDocument.documentElement.style
        .getPropertyValue('--x-nt-wallpaper-image')
        .includes(`data:image/webp;base64,initial-${mode}`),
      `${mode} mode should commit the local custom wallpaper as its first runtime wallpaper`
    );
  }
}

async function testWallpaperModeConsistencyDefaultsOnAndCopiesLegacySelectionWhenDisabled() {
  const syncStorage = createMemoryStorage({
    [WALLPAPER_STORAGE_KEY]: 'white-shanshui'
  });
  const { documentObj: testDocument, windowObj: testWindow, sandbox: testSandbox } = createWallpaperSandbox();
  const testRuntime = createRuntimeWithSettings(testSandbox, {
    documentObj: testDocument,
    windowObj: testWindow,
    storageArea: syncStorage,
    storageKeys: {
      wallpaper: WALLPAPER_STORAGE_KEY,
      localWallpaper: LOCAL_WALLPAPER_STORAGE_KEY
    },
    t: (_key, fallback) => fallback || ''
  });

  await testRuntime.bootstrapInitialWallpaper();
  testRuntime.createControls();
  openPanel(testRuntime);
  const wallpaper = () => panelState(testRuntime).wallpaper;

  assert.strictEqual(wallpaper().modeSync.title, 'Match light and dark mode',
    'wallpaper panel should render a light/dark consistency switch below the main toggle');
  assert.strictEqual(wallpaper().modeSync.toggle.checked, true, 'light/dark consistency should default on for legacy wallpaper values');
  assert.strictEqual(wallpaper().mode.visible, false, 'the mode row should stay hidden while consistency is on');

  panelActions(testRuntime).setModeSync(false);

  assert.deepStrictEqual(clonePlain(syncStorage.data[WALLPAPER_STORAGE_KEY]), {
    version: WALLPAPER_PREFS_STORAGE_VERSION,
    sameForModes: false,
    light: 'white-shanshui',
    dark: 'white-shanshui'
  });
  assert.strictEqual(
    testDocument.body.getAttribute('data-wallpaper-active'),
    'true',
    'disabling light/dark consistency should not disable the current wallpaper'
  );
  assert.ok(
    testDocument.documentElement.style
      .getPropertyValue('--x-nt-wallpaper-image')
      .includes('lumno-newtab-white-shanshui.webp'),
    'disabling light/dark consistency should keep the current wallpaper image applied'
  );
  assert.strictEqual(wallpaper().modeSync.toggle.checked, false);
  assert.strictEqual(wallpaper().mode.visible, true, 'the mode row should appear after consistency is disabled');
  assert.strictEqual(wallpaper().mode.label, 'Mode',
    'the light/dark switch reads as a setting row like Source and Category');
  assert.deepStrictEqual(
    wallpaper().mode.tabs.options.map((option) => [option.value, option.label, option.ariaLabel]),
    [['light', 'Light', 'Edit Light wallpaper'], ['dark', 'Dark', 'Edit Dark wallpaper']]
  );
}

async function testDisablingWallpaperModeConsistencyIgnoresStaleLocalDisabledOverride() {
  const syncStorage = createMemoryStorage({
    [WALLPAPER_STORAGE_KEY]: 'white-shanshui'
  });
  const localStorageArea = createMemoryStorage({
    [LOCAL_WALLPAPER_STORAGE_KEY]: {
      version: WALLPAPER_PREFS_STORAGE_VERSION,
      light: '',
      dark: LOCAL_WALLPAPER_DISABLED_VALUE
    }
  });
  const { documentObj: testDocument, windowObj: testWindow, sandbox: testSandbox } = createWallpaperSandbox();
  testDocument.body.setAttribute('data-theme', 'dark');
  const testRuntime = createRuntimeWithSettings(testSandbox, {
    documentObj: testDocument,
    windowObj: testWindow,
    storageArea: syncStorage,
    localWallpaperStorageArea: localStorageArea,
    storageKeys: {
      wallpaper: WALLPAPER_STORAGE_KEY,
      localWallpaper: LOCAL_WALLPAPER_STORAGE_KEY
    },
    t: (_key, fallback) => fallback || ''
  });

  await testRuntime.bootstrapInitialWallpaper();
  testRuntime.createControls();
  openPanel(testRuntime);
  panelActions(testRuntime).setModeSync(false);

  assert.deepStrictEqual(clonePlain(syncStorage.data[WALLPAPER_STORAGE_KEY]), {
    version: WALLPAPER_PREFS_STORAGE_VERSION,
    sameForModes: false,
    light: 'white-shanshui',
    dark: 'white-shanshui'
  }, 'stale local disabled markers should not replace the synced wallpaper when consistency is disabled');
  assert.strictEqual(
    localStorageArea.data[LOCAL_WALLPAPER_STORAGE_KEY],
    '',
    'stale local disabled markers should be cleared after consistency is disabled'
  );
  await waitForAsyncWallpaperApply();
  assert.strictEqual(
    testDocument.body.getAttribute('data-wallpaper-active'),
    'true',
    'disabling light/dark consistency should keep wallpaper enabled when a synced wallpaper exists'
  );
}

// With light and dark set apart, the panel opens on the mode the page shows:
// a dark page that opened on Light took every filter change to the light
// wallpaper, and the one on screen never changed.
async function testSplitWallpaperPanelOpensOnTheShownMode() {
  const syncStorage = createMemoryStorage({
    [WALLPAPER_STORAGE_KEY]: {
      version: WALLPAPER_PREFS_STORAGE_VERSION,
      sameForModes: false,
      light: 'white-shanshui',
      dark: 'dark-shanshui-moonlit'
    }
  });
  const { documentObj: testDocument, windowObj: testWindow, sandbox: testSandbox } = createWallpaperSandbox();
  testDocument.body.setAttribute('data-theme', 'dark');
  const testRuntime = createRuntimeWithSettings(testSandbox, {
    documentObj: testDocument,
    windowObj: testWindow,
    storageArea: syncStorage,
    storageKeys: {
      wallpaper: WALLPAPER_STORAGE_KEY,
      localWallpaper: LOCAL_WALLPAPER_STORAGE_KEY,
      effect: WALLPAPER_EFFECT_STORAGE_KEY
    },
    t: (_key, fallback) => fallback || ''
  });

  await testRuntime.bootstrapInitialWallpaper();
  testRuntime.createControls();
  openPanel(testRuntime);
  const wallpaper = () => panelState(testRuntime).wallpaper;
  assert.strictEqual(wallpaper().mode.visible, true);
  assert.strictEqual(wallpaper().mode.tabs.active, 'dark', 'a dark page opens the panel on Dark');

  panelActions(testRuntime).selectEffect('halftone');
  assert.strictEqual(testDocument.body.getAttribute('data-wallpaper-effect'), 'halftone',
    'the filter picked applies to the wallpaper on screen');
  await new Promise((resolve) => setTimeout(resolve, 150));
  const savedEffects = clonePlain(syncStorage.data[WALLPAPER_EFFECT_STORAGE_KEY]);
  assert.strictEqual(savedEffects.dark.type, 'halftone', 'and is saved for that mode');
  assert.notStrictEqual(savedEffects.light.type, 'halftone', 'not for the other one');

  panelActions(testRuntime).selectWallpaperMode('light');
  assert.strictEqual(wallpaper().mode.tabs.active, 'light', 'the other mode can still be edited on purpose');
  testRuntime.closePanel();
  openPanel(testRuntime);
  assert.strictEqual(wallpaper().mode.tabs.active, 'dark', 'and the next open starts on the shown mode again');
}

async function testWallpaperLuminanceIsCachedForThePreload() {
  const createRuntime = (cachedPreload) => {
    let toneOptions = null;
    const { documentObj: testDocument, windowObj: testWindow, sandbox: testSandbox } = createWallpaperSandbox({
      adaptiveToneApi: {
        createWallpaperAdaptiveTone(options) {
          toneOptions = options;
          return { clear() {}, refresh() {}, schedule() {}, whenSettled: () => Promise.resolve() };
        }
      },
      prepareWindow(preparedWindow) {
        if (cachedPreload) {
          preparedWindow.localStorage.setItem(WALLPAPER_PRELOAD_STORAGE_KEY, JSON.stringify(cachedPreload));
        }
      }
    });
    testDocument.body.setAttribute('data-theme', 'light');
    const testRuntime = createRuntimeWithSettings(testSandbox, {
      documentObj: testDocument,
      windowObj: testWindow,
      storageArea: createMemoryStorage({ [WALLPAPER_STORAGE_KEY]: 'dark-shanshui-moonlit' }),
      storageKeys: {
        wallpaper: WALLPAPER_STORAGE_KEY,
        localWallpaper: LOCAL_WALLPAPER_STORAGE_KEY
      },
      t: (_key, fallback) => fallback || ''
    });
    const readPreload = () => JSON.parse(testWindow.localStorage.getItem(WALLPAPER_PRELOAD_STORAGE_KEY));
    return { testDocument, testRuntime, readPreload, getToneOptions: () => toneOptions };
  };
  // A mid-gray sample: luminance 0.5.
  const imageData = new Uint8ClampedArray([128, 128, 128, 255, 127, 127, 127, 255]);

  const first = createRuntime(null);
  await first.testRuntime.bootstrapInitialWallpaper();
  await waitForAsyncWallpaperApply();
  const shownUrl = first.testDocument.documentElement.style.getPropertyValue('--x-nt-wallpaper-image')
    .replace(/^url\("|"\)$/g, '');
  assert.ok(shownUrl.includes('lumno-newtab-dark-shanshui-moonlit.webp'));
  first.getToneOptions().onSamplerReady({ url: 'chrome-extension://abc/stale.webp', imageData });
  assert.strictEqual(first.readPreload().wallpapers.light.luminance, undefined,
    'a sample of an image that is no longer shown should not be remembered');

  first.getToneOptions().onSamplerReady({ url: shownUrl, imageData });
  const cached = first.readPreload();
  ['light', 'dark'].forEach((mode) => {
    assert.ok(Math.abs(cached.wallpapers[mode].luminance - 0.5) < 0.01,
      `the ${mode} entry remembers how bright the wallpaper is, for the next page's blur frost`);
    assert.strictEqual(cached.wallpapers[mode].luminanceKey, 'dark-shanshui-moonlit');
    assert.ok(cached.wallpapers[mode].path.includes('lumno-newtab-dark-shanshui-moonlit.webp'));
    assert.strictEqual(cached.wallpapers[mode].placeholder, undefined, 'no blurred copy is kept');
    assert.strictEqual(cached.wallpapers[mode].backdrop, undefined);
  });

  // The next New Tab keeps the luminance it was opened with instead of dropping it until the next sample.
  const second = createRuntime(cached);
  await second.testRuntime.bootstrapInitialWallpaper();
  await waitForAsyncWallpaperApply();
  assert.strictEqual(second.readPreload().wallpapers.light.luminance, cached.wallpapers.light.luminance);
}

function runPreloadForWallpaper(entry, wallpaperEffects, prepareWindow) {
  const documentObj = createFakeDocument();
  const windowObj = createFakeWindow();
  windowObj.localStorage.setItem(WALLPAPER_PRELOAD_STORAGE_KEY, JSON.stringify({
    version: WALLPAPER_PRELOAD_STORAGE_VERSION,
    mode: 'light',
    themeMode: 'light',
    overlayStops: { light: { top: 0, mid: 0, bottom: 0 }, dark: { top: 0, mid: 0, bottom: 0 } },
    wallpapers: { light: entry, dark: null },
    ...(wallpaperEffects ? { wallpaperEffects } : {})
  }));
  windowObj.chrome = { runtime: { getURL: (path) => `chrome-extension://abc/${path}` } };
  if (prepareWindow) prepareWindow(windowObj);
  const sandbox = { ...REAL_WALLPAPER_DEPENDENCIES, document: documentObj, window: windowObj, chrome: windowObj.chrome };
  vm.runInNewContext(moduleScript('src/newtab/wallpaper/wallpaper-preload.ts', undefined, null, { 'src/domain/settings/index.ts': 'LumnoSettings', 'src/newtab/remote-content.ts': 'LumnoNewtabRemoteContent', 'src/newtab/wallpaper/wallpaper-adaptive-tone.ts': 'LumnoNewtabWallpaperAdaptiveTone', 'src/newtab/wallpaper/wallpaper-effects.ts': 'LumnoNewtabWallpaperEffects', 'src/shared/wallpaper-local-store.ts': 'LumnoNewtabWallpaperLocalStore' }), sandbox, {
    filename: 'src/newtab/wallpaper/wallpaper-preload.ts'
  });
  return { root: documentObj.documentElement, preload: sandbox.__lumnoBoot?.wallpaperPreload };
}

async function testPreloadHandsOverLuminanceAndTheDecodedImage() {
  const bundled = {
    id: 'dark-shanshui-moonlit',
    path: 'assets/wallpapers/lumno-newtab-dark-shanshui-moonlit.webp',
    width: 2048,
    height: 1152,
    luminance: 0.31,
    luminanceKey: 'dark-shanshui-moonlit',
    placeholder: 'data:image/webp;base64,cGxhY2Vob2xkZXI=',
    backdrop: 'data:image/webp;base64,YmFja2Ryb3A='
  };
  const effects = { light: { type: 'blur' }, dark: { type: 'blur' } };
  const withImage = (windowObj) => { windowObj.Image = createFakeImageClass(); };

  const shown = runPreloadForWallpaper(bundled, effects, withImage);
  assert.strictEqual(shown.preload.luminance, 0.31, 'the blur frost blends by the remembered luminance');
  assert.strictEqual(shown.preload.initialImageUrl,
    'chrome-extension://abc/assets/wallpapers/lumno-newtab-dark-shanshui-moonlit.webp');
  assert.deepStrictEqual(Object.assign({}, shown.preload.sample), {
    url: 'chrome-extension://abc/assets/wallpapers/lumno-newtab-dark-shanshui-moonlit-sample.avif',
    width: 2048,
    height: 1152
  }, 'effects and tones sample the bundled small copy, placed by the full size the cache names');
  assert.strictEqual(shown.preload.decodedImage.url, shown.preload.initialImageUrl,
    'the decoded small copy stands for the shown wallpaper');
  assert.strictEqual((await shown.preload.decodedImage.ready).src, shown.preload.sample.url,
    'the first tone sample reuses the small copy the preload decoded');
  assert.strictEqual(shown.root.style.getPropertyValue('--x-nt-wallpaper-backdrop'), '',
    'no blurred copy lies under the wallpaper');
  assert.strictEqual(shown.root.style.getPropertyValue('--x-nt-wallpaper-placeholder'), '');

  const forged = runPreloadForWallpaper(Object.assign({}, bundled, { luminance: 4 }), effects);
  assert.strictEqual(forged.preload.luminance, null);

  const id = `${CUSTOM_WALLPAPER_ID_PREFIX}decoded`;
  const dataUrl = 'data:image/webp;base64,dXBsb2Fk';
  const upload = runPreloadForWallpaper({ id, customImage: { id } }, effects, (windowObj) => {
    windowObj.indexedDB = createFakeImageCacheDatabase([{ key: id, id, imageDataUrl: dataUrl }], 'key');
    withImage(windowObj);
  });
  assert.strictEqual(upload.preload.decodedImage, null, 'nothing to decode before the upload is read');
  assert.strictEqual(await upload.preload.imageReady, dataUrl);
  assert.strictEqual(upload.preload.initialImageUrl, dataUrl);
  assert.strictEqual(upload.preload.sample, null, 'an upload without a small copy samples itself');
  assert.strictEqual((await upload.preload.decodedImage.ready).src, dataUrl);

  const thumbnailDataUrl = 'data:image/webp;base64,dGh1bWI=';
  const thumbed = runPreloadForWallpaper({ id, customImage: { id } }, effects, (windowObj) => {
    windowObj.indexedDB = createFakeImageCacheDatabase([
      { key: id, id, imageDataUrl: dataUrl, thumbnailDataUrl, width: 2560, height: 1440 }
    ], 'key');
    withImage(windowObj);
  });
  assert.strictEqual(await thumbed.preload.imageReady, dataUrl);
  assert.deepStrictEqual(Object.assign({}, thumbed.preload.sample), { url: thumbnailDataUrl, width: 2560, height: 1440 });
  assert.strictEqual(thumbed.preload.decodedImage.url, dataUrl);
  assert.strictEqual((await thumbed.preload.decodedImage.ready).src, thumbnailDataUrl,
    'an upload saved before sampling copies existed samples its thumbnail');

  const sampleDataUrl = 'data:image/webp;base64,c2FtcGxl';
  const sampled = runPreloadForWallpaper({ id, customImage: { id } }, effects, (windowObj) => {
    windowObj.indexedDB = createFakeImageCacheDatabase([
      { key: id, id, imageDataUrl: dataUrl, thumbnailDataUrl, sampleDataUrl, width: 2560, height: 1440 }
    ], 'key');
    withImage(windowObj);
  });
  assert.strictEqual(await sampled.preload.imageReady, dataUrl);
  assert.deepStrictEqual(Object.assign({}, sampled.preload.sample), { url: sampleDataUrl, width: 2560, height: 1440 });
  assert.strictEqual((await sampled.preload.decodedImage.ready).src, sampleDataUrl,
    'an upload samples the small copy saved for sampling');
}

async function testSplitBuiltInWallpaperSelectionFollowsResolvedTheme() {
  const syncStorage = createMemoryStorage({
    [WALLPAPER_STORAGE_KEY]: {
      version: WALLPAPER_PREFS_STORAGE_VERSION,
      sameForModes: false,
      light: 'monet-coastal-white',
      dark: 'dark-shanshui-moonlit'
    }
  });
  const { documentObj: testDocument, windowObj: testWindow, sandbox: testSandbox } = createWallpaperSandbox();
  testDocument.body.setAttribute('data-theme', 'light');
  const testRuntime = createRuntimeWithSettings(testSandbox, {
    documentObj: testDocument,
    windowObj: testWindow,
    storageArea: syncStorage,
    storageKeys: {
      wallpaper: WALLPAPER_STORAGE_KEY,
      localWallpaper: LOCAL_WALLPAPER_STORAGE_KEY
    },
    t: (_key, fallback) => fallback || ''
  });

  await testRuntime.bootstrapInitialWallpaper();
  const preloadCache = JSON.parse(testWindow.localStorage.getItem(WALLPAPER_PRELOAD_STORAGE_KEY));
  assert.strictEqual(
    preloadCache.version,
    WALLPAPER_PRELOAD_STORAGE_VERSION,
    'wallpaper preload cache should use the mode-aware format'
  );
  assert.ok(
    preloadCache.wallpapers.light.path.includes('lumno-newtab-monet-coastal-white.webp'),
    'wallpaper preload cache should retain the light selection'
  );
  assert.deepStrictEqual(
    [preloadCache.wallpapers.light.width, preloadCache.wallpapers.light.height],
    [2048, 1152],
    'the preload places samples from a built-in small copy by the full wallpaper size'
  );
  assert.ok(
    preloadCache.wallpapers.dark.path.includes('lumno-newtab-dark-shanshui-moonlit.webp'),
    'wallpaper preload cache should retain the dark selection before it is active'
  );
  assert.ok(
    testDocument.documentElement.style
      .getPropertyValue('--x-nt-wallpaper-image')
      .includes('lumno-newtab-monet-coastal-white.webp'),
    'light theme should initially render the light wallpaper from split prefs'
  );

  testRuntime.createControls();
  openPanel(testRuntime);
  assert.strictEqual(panelState(testRuntime).wallpaper.mode.visible, true,
    'separate light and dark wallpapers show the mode tabs');
  assert.strictEqual(panelState(testRuntime).wallpaper.mode.tabs.active, 'light');
  assert.strictEqual(findTile(testRuntime, 'monet-coastal-white').selected, true);
  panelActions(testRuntime).selectWallpaperMode('dark');
  assert.strictEqual(panelState(testRuntime).wallpaper.mode.tabs.active, 'dark');
  assert.strictEqual(findTile(testRuntime, 'dark-shanshui-moonlit').selected, true,
    'the dark tab highlights the dark wallpaper');
  clickTile(testRuntime, 'dark-monet-lily-nocturne');

  assert.deepStrictEqual(clonePlain(syncStorage.data[WALLPAPER_STORAGE_KEY]), {
    version: WALLPAPER_PREFS_STORAGE_VERSION,
    sameForModes: false,
    light: 'monet-coastal-white',
    dark: 'dark-monet-lily-nocturne'
  });
  assert.ok(
    testDocument.documentElement.style
      .getPropertyValue('--x-nt-wallpaper-image')
      .includes('lumno-newtab-monet-coastal-white.webp'),
    'editing the dark wallpaper should not replace the currently resolved light wallpaper'
  );

  testDocument.body.setAttribute('data-theme', 'dark');
  testRuntime.handleThemeModeChange();
  await waitForAsyncWallpaperApply();

  assert.ok(
    testDocument.documentElement.style
      .getPropertyValue('--x-nt-wallpaper-image')
      .includes('lumno-newtab-dark-monet-lily-nocturne.webp'),
    'switching to dark theme should apply the separately configured dark wallpaper'
  );
}

async function testWallpaperPreloadCacheRetainsMinimumLightOverlay() {
  const syncStorage = createMemoryStorage({
    [WALLPAPER_STORAGE_KEY]: {
      version: WALLPAPER_PREFS_STORAGE_VERSION,
      sameForModes: true,
      light: 'dark-shanshui-moonlit',
      dark: 'dark-shanshui-moonlit'
    },
    [WALLPAPER_OVERLAY_STORAGE_KEY]: {
      version: 2,
      light: 0,
      dark: 50
    }
  });
  const { documentObj: testDocument, windowObj: testWindow, sandbox: testSandbox } =
    createWallpaperSandbox();
  testDocument.body.setAttribute('data-theme', 'light');
  const testRuntime = createRuntimeWithSettings(testSandbox, {
    documentObj: testDocument,
    windowObj: testWindow,
    storageArea: syncStorage,
    storageKeys: {
      wallpaper: WALLPAPER_STORAGE_KEY,
      localWallpaper: LOCAL_WALLPAPER_STORAGE_KEY,
      overlay: WALLPAPER_OVERLAY_STORAGE_KEY
    },
    t: (_key, fallback) => fallback || ''
  });

  await testRuntime.bootstrapInitialWallpaperOverlay();
  await testRuntime.bootstrapInitialWallpaper();

  const preloadCache = JSON.parse(
    testWindow.localStorage.getItem(WALLPAPER_PRELOAD_STORAGE_KEY)
  );
  assert.deepStrictEqual(
    clonePlain(preloadCache.overlayStops.light),
    { top: 0, mid: 0, bottom: 0 },
    'a minimum light-mode mask should stay at zero in the next new-tab first frame'
  );
}

async function testSplitLocalWallpaperSelectionStaysLocalOnly() {
  const customWallpaperId = `${CUSTOM_WALLPAPER_ID_PREFIX}dark-local`;
  const syncStorage = createMemoryStorage({
    [WALLPAPER_STORAGE_KEY]: {
      version: WALLPAPER_PREFS_STORAGE_VERSION,
      sameForModes: false,
      light: 'monet-coastal-white',
      dark: DEFAULT_WALLPAPER_ID
    }
  });
  const localStorageArea = createMemoryStorage();
  const localStoreApi = createLocalWallpaperStoreApi([{
    id: customWallpaperId,
    imageDataUrl: 'data:image/webp;base64,dark-wallpaper',
    thumbnailDataUrl: 'data:image/webp;base64,dark-thumb',
    updatedAt: 1
  }]);
  const { documentObj: testDocument, windowObj: testWindow, sandbox: testSandbox } = createWallpaperSandbox({
    localStoreApi
  });
  testDocument.body.setAttribute('data-theme', 'light');
  const testRuntime = createRuntimeWithSettings(testSandbox, {
    documentObj: testDocument,
    windowObj: testWindow,
    storageArea: syncStorage,
    localWallpaperStorageArea: localStorageArea,
    storageKeys: {
      wallpaper: WALLPAPER_STORAGE_KEY,
      localWallpaper: LOCAL_WALLPAPER_STORAGE_KEY
    },
    t: (_key, fallback) => fallback || ''
  });

  await testRuntime.bootstrapInitialWallpaper();
  testRuntime.createControls();
  openPanel(testRuntime);
  panelActions(testRuntime).selectWallpaperMode('dark');
  panelActions(testRuntime).selectSourceTab('local');
  await Promise.resolve();
  await Promise.resolve();
  assert.strictEqual(findTile(testRuntime, customWallpaperId).thumbnailUrl, 'data:image/webp;base64,dark-thumb',
    'local tiles show the stored thumbnail');
  clickTile(testRuntime, customWallpaperId);

  assert.deepStrictEqual(clonePlain(syncStorage.data[WALLPAPER_STORAGE_KEY]), {
    version: WALLPAPER_PREFS_STORAGE_VERSION,
    sameForModes: false,
    light: 'monet-coastal-white',
    dark: DEFAULT_WALLPAPER_ID
  }, 'selecting a local dark wallpaper should not write the custom id to sync storage');
  assert.deepStrictEqual(clonePlain(localStorageArea.data[LOCAL_WALLPAPER_STORAGE_KEY]), {
    version: WALLPAPER_PREFS_STORAGE_VERSION,
    light: '',
    dark: customWallpaperId
  }, 'the split local wallpaper override should be kept in local storage only');

  assert.ok(
    testDocument.documentElement.style
      .getPropertyValue('--x-nt-wallpaper-image')
      .includes('lumno-newtab-monet-coastal-white.webp'),
    'choosing a dark local wallpaper should not replace the current light wallpaper'
  );

  testDocument.body.setAttribute('data-theme', 'dark');
  testRuntime.handleThemeModeChange();
  await waitForAsyncWallpaperApply();

  const preloadCache = JSON.parse(testWindow.localStorage.getItem(WALLPAPER_PRELOAD_STORAGE_KEY));
  assert.deepStrictEqual(
    preloadCache.wallpapers.dark,
    { id: 'custom-wallpaper-dark-local', customImage: { id: 'custom-wallpaper-dark-local' } },
    'a local-only dark wallpaper should preload its upload instead of the synced white fallback'
  );

  assert.ok(
    testDocument.documentElement.style
      .getPropertyValue('--x-nt-wallpaper-image')
      .includes('data:image/webp;base64,dark-wallpaper'),
    'dark theme should use the local-only dark wallpaper on the same device'
  );
}

async function testDeletingLocalWallpapersKeepsTheLocalTabOpen() {
  const ASSET_REVISION_STORAGE_KEY = '_x_extension_asset_revision_2026_unique_';
  const firstId = `${CUSTOM_WALLPAPER_ID_PREFIX}first`;
  const secondId = `${CUSTOM_WALLPAPER_ID_PREFIX}second`;
  const syncStorage = createMemoryStorage({ [WALLPAPER_STORAGE_KEY]: DEFAULT_WALLPAPER_ID });
  const localStorageArea = createMemoryStorage();
  const localStoreApi = createLocalWallpaperStoreApi([firstId, secondId].map((id, index) => ({
    id,
    imageDataUrl: `data:image/webp;base64,${id}`,
    thumbnailDataUrl: `data:image/webp;base64,${id}-thumb`,
    updatedAt: index + 1
  })));
  const { documentObj: testDocument, windowObj: testWindow, sandbox: testSandbox } = createWallpaperSandbox({
    localStoreApi
  });
  testDocument.body.setAttribute('data-theme', 'light');
  const testRuntime = createRuntimeWithSettings(testSandbox, {
    documentObj: testDocument,
    windowObj: testWindow,
    storageArea: syncStorage,
    localWallpaperStorageArea: localStorageArea,
    storageKeys: {
      wallpaper: WALLPAPER_STORAGE_KEY,
      localWallpaper: LOCAL_WALLPAPER_STORAGE_KEY
    },
    t: (_key, fallback) => fallback || ''
  });

  await testRuntime.bootstrapInitialWallpaper();
  testRuntime.createControls();
  openPanel(testRuntime);
  panelActions(testRuntime).selectSourceTab('local');
  await waitForAsyncWallpaperApply();
  const activeTab = () => panelState(testRuntime).wallpaper.activeTab;
  assert.strictEqual(activeTab(), 'local', 'the local tab should open');
  assert.deepStrictEqual(panelState(testRuntime).wallpaper.local.tiles.map((tile) => tile.id), [firstId, secondId]);

  // Every IndexedDB write publishes an asset revision, which reloads the stored state.
  const deleteWallpaper = async (id) => {
    assert.ok(findTile(testRuntime, id), `${id} should be listed before it is deleted`);
    panelActions(testRuntime).deleteWallpaper(id);
    await waitForAsyncWallpaperApply();
    testRuntime.handleStorageChange({ [ASSET_REVISION_STORAGE_KEY]: { newValue: id } });
    await waitForAsyncWallpaperApply();
  };

  await deleteWallpaper(firstId);
  assert.strictEqual(activeTab(), 'local',
    'deleting an unselected local wallpaper should keep the local tab open');
  assert.strictEqual(findTile(testRuntime, firstId), null);

  clickTile(testRuntime, secondId);
  testRuntime.handleStorageChange({ [LOCAL_WALLPAPER_STORAGE_KEY]: { newValue: localStorageArea.data[LOCAL_WALLPAPER_STORAGE_KEY] } });
  await waitForAsyncWallpaperApply();
  await deleteWallpaper(secondId);
  testRuntime.handleStorageChange({ [LOCAL_WALLPAPER_STORAGE_KEY]: { newValue: localStorageArea.data[LOCAL_WALLPAPER_STORAGE_KEY] } });
  await waitForAsyncWallpaperApply();
  assert.strictEqual(activeTab(), 'local',
    'deleting the selected local wallpaper should keep the local tab open');

  panelActions(testRuntime).selectSourceTab('bing');
  testDocument.body.setAttribute('data-theme', 'dark');
  testRuntime.handleThemeModeChange();
  await waitForAsyncWallpaperApply();
  assert.strictEqual(activeTab(), 'bing',
    'a theme change that keeps the same selection should not switch source tabs');
}

async function testNewtabFaviconOptionsRenderBelowLogoAndPersistSelection() {
  const syncStorage = createMemoryStorage({
    [NEWTAB_FAVICON_STORAGE_KEY]: 'default'
  });
  const { documentObj: testDocument, windowObj: testWindow, sandbox: testSandbox } = createWallpaperSandbox();
  const testRuntime = createRuntimeWithSettings(testSandbox, {
    documentObj: testDocument,
    windowObj: testWindow,
    storageArea: syncStorage,
    storageKeys: {
      favicon: NEWTAB_FAVICON_STORAGE_KEY
    },
    t: (_key, fallback) => fallback || '',
    formatMessage: (_key, fallback, params) => String(fallback || '').replace('{name}', params.name)
  });

  await testRuntime.bootstrapInitialNewtabFavicon();
  testRuntime.createControls();
  openPanel(testRuntime);
  const favicon = () => panelState(testRuntime).favicon;
  const faviconModel = panelOf(testRuntime).model.favicons;

  assert.strictEqual(favicon().title, 'New Tab favicon');
  assert.deepStrictEqual(
    favicon().options.map((option) => [option.id, option.selected]),
    [['default', true], ['alternate', false]],
    'favicon selector should reserve two icon slots'
  );
  assert.strictEqual(favicon().options[1].label, 'Select Alternate favicon');
  assert.ok(
    faviconModel[0].previewUrl.includes('assets/images/lumno.png'),
    'default favicon option should use the current extension icon'
  );
  assert.strictEqual(faviconModel[1].inlineSvg[0], 'svg', 'alternate favicon option should use an inline SVG preview');

  panelActions(testRuntime).selectFavicon('alternate');

  assert.strictEqual(
    syncStorage.data[NEWTAB_FAVICON_STORAGE_KEY],
    'alternate',
    'clicking the reserved favicon slot should persist the selected favicon id'
  );
  assert.strictEqual(
    testWindow.localStorage.getItem(NEWTAB_FAVICON_PRELOAD_STORAGE_KEY),
    'alternate',
    'selecting the alternate favicon should cache it for the next New Tab preload'
  );
  assert.deepStrictEqual(favicon().options.map((option) => option.selected), [false, true]);
  const faviconLink = testDocument.head.children.find((child) => child.tagName === 'LINK');
  assert.ok(faviconLink, 'selecting a favicon should apply a document icon link');
  assert.strictEqual(faviconLink.getAttribute('rel'), 'icon');
  assert.strictEqual(faviconLink.getAttribute('type'), 'image/svg+xml');
  assert.strictEqual(faviconLink.getAttribute('sizes'), 'any');
  assert.strictEqual(faviconLink.getAttribute('data-newtab-favicon-id'), 'alternate');
  assert.strictEqual(faviconLink.getAttribute('data-lumno-newtab-favicon-theme'), 'light');
  const lightHref = faviconLink.getAttribute('href');
  const lightSvg = decodeSvgDataUrl(lightHref);
  assert.match(lightSvg, /fill="#000000"/, 'light browser mode should use the dark original mark color');
  assert.match(lightSvg, /fill-opacity="0\.5"/, 'light browser mode should preserve the supplied main opacity');

  testWindow.__setMediaMatch('(prefers-color-scheme: dark)', true);

  assert.strictEqual(faviconLink.getAttribute('data-lumno-newtab-favicon-theme'), 'dark');
  const darkHref = faviconLink.getAttribute('href');
  const darkSvg = decodeSvgDataUrl(darkHref);
  assert.notStrictEqual(darkHref, lightHref, 'browser color-scheme changes should refresh the favicon href');
  assert.match(darkSvg, /fill="#f1f3f4"/, 'dark browser mode should use a light visible mark color');
  assert.match(darkSvg, /fill-opacity="0\.72"/, 'dark browser mode should brighten the main mark');

  testWindow.__setMediaMatch('(prefers-color-scheme: dark)', false);

  assert.strictEqual(faviconLink.getAttribute('data-lumno-newtab-favicon-theme'), 'light');
  assert.strictEqual(
    faviconLink.getAttribute('href'),
    lightHref,
    'switching the browser back to light mode should restore the light favicon'
  );

  testWindow.__setMediaMatchSilently('(prefers-color-scheme: dark)', true);
  assert.strictEqual(
    faviconLink.getAttribute('href'),
    lightHref,
    'background tabs can miss the media query change while staying on their old favicon'
  );

  testWindow.__dispatchEvent('focus');

  assert.strictEqual(
    faviconLink.getAttribute('data-lumno-newtab-favicon-theme'),
    'dark',
    'refocusing a background new tab should re-check the browser color scheme'
  );
  assert.match(
    decodeSvgDataUrl(faviconLink.getAttribute('href')),
    /fill="#f1f3f4"/,
    'refocusing a background new tab should refresh to the dark favicon'
  );
}

async function testNewtabFaviconThemeBroadcastRefreshesBackgroundTabs() {
  const BroadcastChannel = createFakeBroadcastChannelClass();
  const foregroundStorage = createMemoryStorage({
    [NEWTAB_FAVICON_STORAGE_KEY]: 'alternate'
  });
  const backgroundStorage = createMemoryStorage({
    [NEWTAB_FAVICON_STORAGE_KEY]: 'alternate'
  });
  const foreground = createWallpaperSandbox({ BroadcastChannel });
  const background = createWallpaperSandbox({ BroadcastChannel });
  const foregroundRuntime = createRuntimeWithSettings(foreground.sandbox, {
    documentObj: foreground.documentObj,
    windowObj: foreground.windowObj,
    storageArea: foregroundStorage,
    storageKeys: {
      favicon: NEWTAB_FAVICON_STORAGE_KEY
    },
    t: (_key, fallback) => fallback || ''
  });
  const backgroundRuntime = createRuntimeWithSettings(background.sandbox, {
    documentObj: background.documentObj,
    windowObj: background.windowObj,
    storageArea: backgroundStorage,
    storageKeys: {
      favicon: NEWTAB_FAVICON_STORAGE_KEY
    },
    t: (_key, fallback) => fallback || ''
  });

  await Promise.all([
    foregroundRuntime.bootstrapInitialNewtabFavicon(),
    backgroundRuntime.bootstrapInitialNewtabFavicon()
  ]);
  const backgroundFaviconLink = background.documentObj.head.children.find((child) => child.tagName === 'LINK');
  const lightHref = backgroundFaviconLink.getAttribute('href');

  assert.strictEqual(backgroundFaviconLink.getAttribute('data-lumno-newtab-favicon-theme'), 'light');

  background.windowObj.__setMediaMatchSilently('(prefers-color-scheme: dark)', true);
  foreground.windowObj.__setMediaMatch('(prefers-color-scheme: dark)', true);

  assert.strictEqual(
    backgroundFaviconLink.getAttribute('data-lumno-newtab-favicon-theme'),
    'dark',
    'a foreground new tab should broadcast browser theme changes to background new tabs'
  );
  assert.notStrictEqual(
    backgroundFaviconLink.getAttribute('href'),
    lightHref,
    'background new tabs should refresh their favicon without being focused'
  );
  assert.match(
    decodeSvgDataUrl(backgroundFaviconLink.getAttribute('href')),
    /fill="#f1f3f4"/,
    'broadcast refresh should update background new tabs to the dark favicon'
  );
}

async function testWallpaperEffectInkToneControlPersistsAndFollowsEffectType() {
  const storageArea = createMemoryStorage({
    [WALLPAPER_EFFECT_STORAGE_KEY]: {
      version: 4,
      light: {
        version: 4,
        type: 'halftone',
        inkTone: 'auto',
        strength: 50,
        size: 50,
        spacing: 50
      },
      dark: {
        version: 4,
        type: 'halftone',
        inkTone: 'auto',
        strength: 50,
        size: 50,
        spacing: 50
      }
    }
  });
  const { documentObj: testDocument, windowObj: testWindow, sandbox: testSandbox } =
    createWallpaperSandbox();
  const testRuntime = createRuntimeWithSettings(testSandbox, {
    documentObj: testDocument,
    windowObj: testWindow,
    storageArea,
    storageKeys: { effect: WALLPAPER_EFFECT_STORAGE_KEY },
    t: (_key, fallback) => fallback || ''
  });

  testRuntime.createControls();
  openPanel(testRuntime);
  await testRuntime.bootstrapInitialWallpaperEffect();
  const inkTone = () => effectState(testRuntime).inkTone;

  assert.strictEqual(
    inkTone().visible,
    true,
    'halftone should show the shadow/highlight sampling picker beneath the effect tabs'
  );
  assert.strictEqual(
    inkTone().tabs.active,
    'dark',
    'legacy automatic tone should present the expected dark default for the light wallpaper mode'
  );
  assert.deepStrictEqual(
    inkTone().tabs.options.map((option) => [option.value, option.label]),
    [['dark', 'Shadows'], ['light', 'Highlights']]
  );

  panelActions(testRuntime).selectInkTone('light');
  await new Promise((resolve) => setTimeout(resolve, 150));
  assert.strictEqual(inkTone().tabs.active, 'light');
  assert.strictEqual(storageArea.data[WALLPAPER_EFFECT_STORAGE_KEY].light.inkTone, 'light');
  assert.strictEqual(
    storageArea.data[WALLPAPER_EFFECT_STORAGE_KEY].dark.inkTone,
    'light',
    'shared wallpaper modes should persist the chosen ink tone consistently'
  );

  panelActions(testRuntime).selectEffect('ascii');
  assert.strictEqual(
    inkTone().visible,
    true,
    'ASCII should keep the shadow/highlight sampling picker visible'
  );
  panelActions(testRuntime).selectEffect('dither');
  assert.strictEqual(
    inkTone().visible,
    false,
    'Dither should use the wallpaper palette instead of the dot or character ink picker'
  );
  panelActions(testRuntime).selectEffect('grain');
  assert.strictEqual(
    inkTone().visible,
    false,
    'grain should hide the ink tone picker because it has no dots or characters'
  );
}

async function testBlocksExposeReliefControls() {
  const storageArea = createMemoryStorage({});
  const { documentObj: testDocument, windowObj: testWindow, sandbox: testSandbox } =
    createWallpaperSandbox();
  const testRuntime = createRuntimeWithSettings(testSandbox, {
    documentObj: testDocument,
    windowObj: testWindow,
    storageArea,
    storageKeys: { effect: WALLPAPER_EFFECT_STORAGE_KEY },
    t: (_key, fallback) => fallback || ''
  });

  testRuntime.createControls();
  openPanel(testRuntime);
  await testRuntime.bootstrapInitialWallpaperEffect();
  const view = panelOf(testRuntime);

  assert.ok(
    effectState(testRuntime).select.options.some((option) => option.value === 'blocks' && option.label === 'Blocks'),
    'the appearance panel should include the Blocks filter'
  );
  panelActions(testRuntime).selectEffect('blocks');
  assert.strictEqual(effectState(testRuntime).select.value, 'blocks');
  assert.strictEqual(testDocument.body.getAttribute('data-wallpaper-effect'), 'blocks');
  assert.ok(
    testRuntime.containsTarget(view.selectMenu),
    'clicks inside the filter menu should not count as outside the appearance panel'
  );
  view.selectOpen = true;
  assert.strictEqual(testRuntime.closeOpenMenu(), true, 'Escape should close the open filter menu first');
  assert.strictEqual(testRuntime.closeOpenMenu(), false, 'Escape should fall through once the menu is closed');
  const sliders = () => effectState(testRuntime).sliders;
  assert.strictEqual(sliders().size.visible, true, 'Block size should be visible for Blocks');
  assert.strictEqual(sliders().size.label, 'Block size');
  assert.strictEqual(
    effectState(testRuntime).inkTone.visible,
    false,
    'Blocks should preserve wallpaper colors instead of exposing an ink-tone override'
  );
  assert.strictEqual(sliders().strength.visible, false, 'fixed full-height relief should not render a redundant adjustment');
  assert.strictEqual(sliders().texture.visible, false, 'fixed full-detail color should not render a redundant adjustment');
  assert.strictEqual(sliders().spacing.visible, false, 'fixed zero block spacing should not render a redundant adjustment');
  assert.strictEqual(sliders().size.max, 5);
  assert.strictEqual(sliders().size.step, undefined, 'block sizes are whole steps');
  assert.strictEqual(sliders().size.suffix, '', 'block sizes are levels, not percentages');
  assert.strictEqual(sliders().size.value, 1, 'Blocks should start at the first size level');
  panelActions(testRuntime).setEffectParameter('size', 5, NOT_DRAGGING);
  assert.strictEqual(sliders().size.value, 5);
  await new Promise((resolve) => setTimeout(resolve, 150));
  assert.strictEqual(storageArea.data[WALLPAPER_EFFECT_STORAGE_KEY].light.type, 'blocks');
  assert.strictEqual(storageArea.data[WALLPAPER_EFFECT_STORAGE_KEY].dark.type, 'blocks');
  assert.strictEqual(storageArea.data[WALLPAPER_EFFECT_STORAGE_KEY].light.strength, 50);
  assert.strictEqual(storageArea.data[WALLPAPER_EFFECT_STORAGE_KEY].light.texture, 20);
  assert.strictEqual(storageArea.data[WALLPAPER_EFFECT_STORAGE_KEY].light.size, 50);
  assert.strictEqual(storageArea.data[WALLPAPER_EFFECT_STORAGE_KEY].light.spacing, 50);
  assert.strictEqual(storageArea.data[WALLPAPER_EFFECT_STORAGE_KEY].light.blockSize, 5);
}

async function testEffectSpecificParametersRoundTrip() {
  const modePrefs = {
    version: 11,
    type: 'grain',
    inkTone: 'auto',
    strength: 80,
    size: 65,
    spacing: 35,
    texture: 25,
    blockSize: 1,
    crtStrength: 20,
    crtBloom: 15,
    crtRgbOffset: 35,
    crtCurvature: 18
  };
  const storageArea = createMemoryStorage({
    [WALLPAPER_EFFECT_STORAGE_KEY]: {
      version: 11,
      light: Object.assign({}, modePrefs),
      dark: Object.assign({}, modePrefs)
    }
  });
  const { documentObj: testDocument, windowObj: testWindow, sandbox: testSandbox } =
    createWallpaperSandbox();
  const testRuntime = createRuntimeWithSettings(testSandbox, {
    documentObj: testDocument,
    windowObj: testWindow,
    storageArea,
    storageKeys: { effect: WALLPAPER_EFFECT_STORAGE_KEY },
    t: (_key, fallback) => fallback || ''
  });

  testRuntime.createControls();
  openPanel(testRuntime);
  await testRuntime.bootstrapInitialWallpaperEffect();
  const sliders = () => effectState(testRuntime).sliders;
  const actions = panelActions(testRuntime);
  assert.strictEqual(sliders().strength.value, 80);

  actions.selectEffect('crt');
  assert.strictEqual(sliders().strength.value, 100, 'CRT should expose its dedicated strength');
  actions.setEffectParameter('strength', 50, NOT_DRAGGING);

  actions.selectEffect('grain');
  assert.strictEqual(sliders().strength.value, 80, 'Grain strength should survive a round trip through CRT');

  actions.selectEffect('blocks');
  assert.strictEqual(sliders().size.value, 1, 'Blocks should expose its dedicated size');
  actions.setEffectParameter('size', 4, NOT_DRAGGING);

  actions.selectEffect('halftone');
  assert.strictEqual(sliders().size.value, 65, 'generic size should survive a round trip through Blocks');
  actions.selectEffect('blocks');
  assert.strictEqual(sliders().size.value, 4, 'Blocks size should be retained independently');
  actions.selectEffect('grain');

  await new Promise((resolve) => setTimeout(resolve, 150));
  const persisted = storageArea.data[WALLPAPER_EFFECT_STORAGE_KEY].light;
  assert.strictEqual(persisted.type, 'grain');
  assert.strictEqual(persisted.strength, 80);
  assert.strictEqual(persisted.size, 65);
  assert.strictEqual(persisted.spacing, 35);
  assert.strictEqual(persisted.texture, 25);
  assert.strictEqual(persisted.blockSize, 4);
  assert.strictEqual(persisted.crtStrength, 10);
}

async function testTimeSettingsFollowTheContentAboveTheSearchBar() {
  const settings = REAL_WALLPAPER_DEPENDENCIES.LumnoSettings;
  const store = createTestSettings();
  const { documentObj: testDocument, windowObj: testWindow, sandbox: testSandbox } = createWallpaperSandbox();
  const testRuntime = createRuntimeWithSettings(testSandbox, {
    documentObj: testDocument,
    windowObj: testWindow,
    storageArea: createMemoryStorage({}),
    settings: store,
    t: (_key, fallback) => fallback || ''
  });
  testRuntime.createControls();
  openPanel(testRuntime);
  const search = () => panelState(testRuntime).search;
  assert.strictEqual(search().topContent.tabs.active, 'brand');
  assert.strictEqual(search().timeWeight.visible, false, 'the brand mark has no font weight setting');
  assert.strictEqual(search().timeFont.visible, false, 'the brand mark has no font setting');
  assert.strictEqual(search().seconds.visible, false);
  assert.strictEqual(search().timeFont.value, 'open-sans');
  assert.deepStrictEqual(
    search().timeFont.options.map((option) => option.label),
    ['Open Sans', 'Geist', 'JetBrains Mono', 'Bricolage Grotesque', 'Unbounded', 'Bitcount']
  );
  assert.deepStrictEqual(
    [search().timeWeight.min, search().timeWeight.max, search().timeWeight.value, search().timeWeight.step],
    [300, 800, 320, undefined],
    'the font weight slider moves in whole steps across the supported range'
  );
  assert.strictEqual(search().timeWeight.resetVisible, false, 'the default weight has nothing to reset');

  panelActions(testRuntime).selectTopContent('time');
  assert.strictEqual(store.get(settings.newtabTopContentMode), 'time');
  assert.strictEqual(search().timeWeight.visible, true, 'the time shows its font weight setting');
  assert.strictEqual(search().timeFont.visible, true, 'the time shows its font setting');
  assert.strictEqual(search().seconds.visible, true, 'the time shows its seconds setting');

  // Picking a face moves the weight to that face's default and the slider to its range.
  panelActions(testRuntime).setTimeFontWeight(700, NOT_DRAGGING);
  panelActions(testRuntime).setTimeFont('bitcount');
  assert.strictEqual(store.get(settings.newtabTimeFont), 'bitcount');
  assert.strictEqual(store.get(settings.newtabTimeFontWeight), 480);
  assert.deepStrictEqual(
    [search().timeFont.value, search().timeWeight.min, search().timeWeight.max, search().timeWeight.value],
    ['bitcount', 300, 550, 480]
  );
  assert.strictEqual(search().timeWeight.resetVisible, false, "the face's own default has nothing to reset");
  // A heavier synced weight shows at the face's ceiling; the stored weight is kept
  // for the faces that can draw it.
  store.set(settings.newtabTimeFontWeight, 800);
  assert.strictEqual(search().timeWeight.value, 550);
  panelActions(testRuntime).resetTimeFontWeight();
  assert.strictEqual(store.get(settings.newtabTimeFontWeight), 480, "reset returns to the face's own default");
  // Another device picks a face; an unknown one falls back to Open Sans.
  store.set(settings.newtabTimeFont, 'geist');
  assert.strictEqual(search().timeWeight.max, 800);
  store.set(settings.newtabTimeFont, 'papyrus');
  assert.strictEqual(store.get(settings.newtabTimeFont), 'open-sans');
  panelActions(testRuntime).setTimeFontWeight(320, NOT_DRAGGING);

  panelActions(testRuntime).setTimeFontWeight(612, NOT_DRAGGING);
  assert.strictEqual(store.get(settings.newtabTimeFontWeight), 612);
  assert.strictEqual(search().timeWeight.value, 612);
  assert.strictEqual(search().timeWeight.resetVisible, true, 'a changed weight offers a reset');
  panelActions(testRuntime).resetTimeFontWeight();
  assert.strictEqual(store.get(settings.newtabTimeFontWeight), 320);
  assert.strictEqual(search().timeWeight.resetVisible, false);
  panelActions(testRuntime).setTimeFontWeight(612, NOT_DRAGGING);
  panelActions(testRuntime).setTimeSecondsVisible(true);
  assert.strictEqual(store.get(settings.newtabTimeSecondsVisible), true);
  assert.strictEqual(search().seconds.toggle.checked, true);

  // Another device changes the settings: the panel follows.
  store.set(settings.newtabTimeFontWeight, 9999);
  assert.strictEqual(search().timeWeight.value, 800, 'a synced weight is clamped');
  store.set(settings.newtabTimeSecondsVisible, false);
  assert.strictEqual(search().seconds.toggle.checked, false);
  store.set(settings.newtabTopContentMode, 'off');
  assert.strictEqual(search().topContent.tabs.active, 'off');
  assert.strictEqual(search().timeWeight.visible, false);
}

async function testGlassBlurCanBeEnabledAndDisabled() {
  const storageArea = createMemoryStorage({
    [WALLPAPER_EFFECT_STORAGE_KEY]: {
      version: 4,
      light: {
        version: 4,
        type: 'none',
        inkTone: 'auto',
        strength: 50,
        size: 50,
        spacing: 50
      },
      dark: {
        version: 4,
        type: 'none',
        inkTone: 'auto',
        strength: 50,
        size: 50,
        spacing: 50
      }
    }
  });
  const { documentObj: testDocument, windowObj: testWindow, sandbox: testSandbox } =
    createWallpaperSandbox();
  const testRuntime = createRuntimeWithSettings(testSandbox, {
    documentObj: testDocument,
    windowObj: testWindow,
    storageArea,
    storageKeys: { effect: WALLPAPER_EFFECT_STORAGE_KEY },
    t: (_key, fallback) => fallback || ''
  });

  testRuntime.createControls();
  openPanel(testRuntime);
  await testRuntime.bootstrapInitialWallpaperEffect();
  const sliders = () => effectState(testRuntime).sliders;
  const actions = panelActions(testRuntime);

  actions.selectEffect('blur');
  assert.strictEqual(effectState(testRuntime).select.value, 'blur');
  assert.strictEqual(testDocument.body.getAttribute('data-wallpaper-effect'), 'blur');
  assert.strictEqual(sliders().size.visible, false);
  assert.strictEqual(sliders().spacing.visible, false);
  assert.strictEqual(sliders().texture.visible, true);
  assert.strictEqual(sliders().texture.disabled, false);
  assert.deepStrictEqual([sliders().texture.min, sliders().texture.max], [0, 100]);
  assert.strictEqual(sliders().texture.label, 'Texture');
  assert.strictEqual(sliders().strength.label, 'Blur strength');
  actions.setEffectParameter('texture', 180.75, TYPED);
  await new Promise((resolve) => setTimeout(resolve, 150));
  assert.strictEqual(
    storageArea.data[WALLPAPER_EFFECT_STORAGE_KEY].light.texture,
    100,
    'standard glass texture should clamp typed values to 0–100'
  );
  actions.setEffectParameter('strength', 150, TYPED);
  await new Promise((resolve) => setTimeout(resolve, 150));
  assert.strictEqual(storageArea.data[WALLPAPER_EFFECT_STORAGE_KEY].light.type, 'blur');
  assert.strictEqual(
    storageArea.data[WALLPAPER_EFFECT_STORAGE_KEY].light.strength,
    100,
    'bounded strength should keep its existing 0–100 contract'
  );
  actions.selectEffect('none');
  assert.strictEqual(effectState(testRuntime).select.value, 'none');
  assert.strictEqual(testDocument.body.getAttribute('data-wallpaper-effect'), 'none');
  assert.strictEqual(sliders().strength.visible, false, 'no filter means no filter settings');
  await new Promise((resolve) => setTimeout(resolve, 150));
  assert.strictEqual(storageArea.data[WALLPAPER_EFFECT_STORAGE_KEY].light.type, 'none');
  assert.strictEqual(storageArea.data[WALLPAPER_EFFECT_STORAGE_KEY].dark.type, 'none');
}

async function testGlassBlurFilterSwitchPreservesTheOutgoingFrame() {
  const storageArea = createMemoryStorage({
    [WALLPAPER_EFFECT_STORAGE_KEY]: {
      version: 7,
      light: { version: 7, type: 'grain', strength: 50, size: 50, spacing: 50, texture: 20 },
      dark: { version: 7, type: 'grain', strength: 50, size: 50, spacing: 50, texture: 20 }
    }
  });
  let resolveBlurRender;
  const blurRenderReady = new Promise((resolve) => {
    resolveBlurRender = resolve;
  });
  const effectsApi = {
    DEFAULT_PREFS: { version: 7, type: 'none', strength: 50, size: 50, spacing: 50, texture: 20 },
    normalizePrefs(value) {
      return Object.assign({}, this.DEFAULT_PREFS, value || {});
    },
    createWallpaperEffects() {
      return {
        apply(prefs) {
          return prefs.type === 'blur' ? blurRenderReady : Promise.resolve();
        },
        refresh() {
          return Promise.resolve();
        }
      };
    }
  };
  const { documentObj: testDocument, windowObj: testWindow, sandbox: testSandbox } =
    createWallpaperSandbox({ effectsApi });
  testWindow.__setMediaMatchSilently('(prefers-reduced-motion: reduce)', false);
  const testRuntime = createRuntimeWithSettings(testSandbox, {
    documentObj: testDocument,
    windowObj: testWindow,
    storageArea,
    storageKeys: { effect: WALLPAPER_EFFECT_STORAGE_KEY },
    t: (_key, fallback) => fallback || ''
  });

  testRuntime.createControls();
  openPanel(testRuntime);
  await testRuntime.bootstrapInitialWallpaperEffect();
  testDocument.body.setAttribute('data-nt-enter', 'done');

  assert.strictEqual(testDocument.body.getAttribute('data-wallpaper-effect'), 'grain');
  panelActions(testRuntime).selectEffect('blur');
  const enteringSnapshot = getDescendantByClassName(
    testDocument.body,
    'x-nt-wallpaper-transition-layer'
  );
  assert.ok(enteringSnapshot, 'entering glass blur should preserve the outgoing wallpaper frame');
  assert.strictEqual(enteringSnapshot.getAttribute('data-exit'), null);
  assert.strictEqual(testDocument.body.getAttribute('data-wallpaper-effect'), 'blur');
  await new Promise((resolve) => setTimeout(resolve, 10));
  assert.strictEqual(
    enteringSnapshot.getAttribute('data-exit'),
    null,
    'the outgoing frame must remain opaque until the blurred background and texture are rendered'
  );
  resolveBlurRender();
  await new Promise((resolve) => setTimeout(resolve, 10));
  assert.strictEqual(
    enteringSnapshot.getAttribute('data-exit'),
    'true',
    'the outgoing frame should begin fading on the frame after the glass render completes'
  );

  await new Promise((resolve) => setTimeout(resolve, 300));
  assert.strictEqual(enteringSnapshot.parentNode, null);
  const blurSnapshotProperties = {
    '--x-nt-wallpaper-blur-overscan': '42px',
    '--x-nt-wallpaper-blur-radius': '18px',
    '--x-nt-wallpaper-blur-saturate': '110%',
    '--x-nt-wallpaper-blur-brightness': '106%',
    '--x-nt-wallpaper-blur-contrast': '84%'
  };
  Object.entries(blurSnapshotProperties).forEach(([name, value]) => {
    testDocument.body.style.setProperty(name, value);
  });
  panelActions(testRuntime).selectEffect('grain');
  const leavingSnapshot = getDescendantByClassName(
    testDocument.body,
    'x-nt-wallpaper-transition-layer'
  );
  assert.ok(leavingSnapshot, 'leaving glass blur should preserve the blurred outgoing frame');
  assert.strictEqual(leavingSnapshot.getAttribute('data-wallpaper-effect'), 'blur');
  Object.entries(blurSnapshotProperties).forEach(([name, value]) => {
    assert.strictEqual(
      leavingSnapshot.style.getPropertyValue(name),
      value,
      `${name} should be frozen on the outgoing blur snapshot`
    );
  });
  assert.strictEqual(testDocument.body.getAttribute('data-wallpaper-effect'), 'grain');
}

async function testCrtFilterPersistsAndShowsDisplayControls() {
  assert.strictEqual(
    sandbox.LumnoNewtabWallpaper.normalizeWallpaperEffectStoragePrefs({ type: 'crt' }).light.type,
    'crt',
    'the storage fallback should preserve CRT before the renderer module is available'
  );
  const storageArea = createMemoryStorage({
    [WALLPAPER_EFFECT_STORAGE_KEY]: {
      version: 7,
      light: { version: 7, type: 'none', strength: 50, size: 50, spacing: 240, texture: 20 },
      dark: { version: 7, type: 'none', strength: 50, size: 50, spacing: 240, texture: 20 }
    }
  });
  const { documentObj: testDocument, windowObj: testWindow, sandbox: testSandbox } =
    createWallpaperSandbox();
  const testRuntime = createRuntimeWithSettings(testSandbox, {
    documentObj: testDocument,
    windowObj: testWindow,
    storageArea,
    storageKeys: { effect: WALLPAPER_EFFECT_STORAGE_KEY },
    t: (_key, fallback) => fallback || ''
  });

  testRuntime.createControls();
  openPanel(testRuntime);
  await testRuntime.bootstrapInitialWallpaperEffect();
  const sliders = () => effectState(testRuntime).sliders;
  const actions = panelActions(testRuntime);
  assert.ok(
    effectState(testRuntime).select.options.some((option) => option.value === 'crt'),
    'the wallpaper filter picker should expose CRT'
  );
  actions.selectEffect('crt');
  assert.strictEqual(testDocument.body.getAttribute('data-wallpaper-effect'), 'crt');
  assert.strictEqual(sliders().size.visible, false,
    'CRT should use a preset-specific fixed phosphor grille instead of exposing its size');
  assert.strictEqual(sliders().spacing.visible, false,
    'CRT should use a fixed two-pixel scanline instead of exposing spacing');
  assert.strictEqual(sliders().texture.visible, false);
  assert.strictEqual(sliders().strength.label, 'Display intensity');
  [
    ['crtBloom', 'Bloom'],
    ['crtRgbOffset', 'RGB offset'],
    ['crtCurvature', 'Screen curvature']
  ].forEach(([key, label]) => {
    assert.strictEqual(sliders()[key].visible, true);
    assert.strictEqual(sliders()[key].label, label);
  });
  actions.setEffectParameter('strength', 50, TYPED);
  actions.setEffectParameter('crtBloom', 100, TYPED);
  actions.setEffectParameter('crtCurvature', 50, TYPED);
  assert.strictEqual(
    sliders().crtCurvature.value,
    50,
    'fractional physical values should round-trip back to the same UI percentage'
  );
  actions.setEffectParameter('crtRgbOffset', 50, TYPED);
  ['strength', 'crtBloom', 'crtRgbOffset', 'crtCurvature'].forEach((key) => {
    assert.strictEqual(sliders()[key].max, 100);
    assert.strictEqual(sliders()[key].suffix, '%', 'CRT parameter values should visibly use percentage units');
    assert.strictEqual(sliders()[key].valueText, `${sliders()[key].value}%`);
  });
  actions.selectEffect('grain');
  assert.strictEqual(sliders().spacing.max, 100, 'non-CRT filter spacing should remain bounded');
  assert.strictEqual(
    sliders().spacing.value,
    100,
    'legacy out-of-range spacing should render at the safe UI boundary'
  );
  assert.strictEqual(
    storageArea.data[WALLPAPER_EFFECT_STORAGE_KEY].light.spacing,
    100,
    'normalized spacing should remain within the shared slider range'
  );
  assert.strictEqual(sliders().spacing.suffix, '%');
  actions.setEffectParameter('spacing', 240, TYPED);
  assert.strictEqual(sliders().spacing.value, 100, 'other filter spacing should clamp accidental values');
  actions.selectEffect('crt');
  assert.strictEqual(sliders().spacing.visible, false, 'returning to CRT should keep the removed spacing control hidden');
  await new Promise((resolve) => setTimeout(resolve, 150));
  assert.strictEqual(storageArea.data[WALLPAPER_EFFECT_STORAGE_KEY].light.type, 'crt');
  assert.strictEqual(storageArea.data[WALLPAPER_EFFECT_STORAGE_KEY].dark.type, 'crt');
  assert.strictEqual(storageArea.data[WALLPAPER_EFFECT_STORAGE_KEY].light.crtPreset, undefined);
  assert.strictEqual(storageArea.data[WALLPAPER_EFFECT_STORAGE_KEY].dark.crtPreset, undefined);
  assert.strictEqual(
    storageArea.data[WALLPAPER_EFFECT_STORAGE_KEY].light.crtStrength,
    10,
    '50% display intensity should map to half of its physical 20-unit range'
  );
  assert.strictEqual(
    storageArea.data[WALLPAPER_EFFECT_STORAGE_KEY].light.strength,
    50,
    'editing CRT intensity should not overwrite generic effect strength'
  );
  assert.strictEqual(storageArea.data[WALLPAPER_EFFECT_STORAGE_KEY].light.crtBloom, 20);
  assert.strictEqual(storageArea.data[WALLPAPER_EFFECT_STORAGE_KEY].light.crtRgbOffset, 50);
  assert.strictEqual(
    storageArea.data[WALLPAPER_EFFECT_STORAGE_KEY].light.crtCurvature,
    17.5,
    '50% curvature should map to half of its physical 35-unit range'
  );
  assert.strictEqual(
    storageArea.data[WALLPAPER_EFFECT_STORAGE_KEY].light.spacing,
    100,
    'other filter spacing should persist only within the bounded range'
  );
}

async function testBingDailySelectionAndManualOverride() {
  const remote = require('../../src/newtab/remote-content.ts');
  const id = 'bing-20261002-OHR.River_ZH-CN123';
  const photo = { ...remote.wallpaperFromId(id), name: 'River', copyright: 'River bank (© Photographer)',
    imageDataUrl: 'data:image/webp;base64,aGVsbG8=', thumbnailDataUrl: 'data:image/webp;base64,dGh1bWI=' };
  let waitForDownload = null;
  const client = {
    getCatalog: async () => [photo], setPinnedIds() {},
    getWallpaper: (selected) => selected === remote.BING_DAILY_ID ? { ...photo, id: selected, dailyId: id } : photo,
    restoreWallpaper: async () => photo,
    ensureWallpaper: async (selected) => {
      if (waitForDownload) await waitForDownload;
      return client.getWallpaper(selected);
    }
  };
  const context = createWallpaperSandbox({ remoteApi: { ...remote, createClient: () => client } });
  const prefs = createMemoryStorage({ [WALLPAPER_STORAGE_KEY]: {
    version: 2, sameForModes: false, light: DEFAULT_WALLPAPER_ID, dark: 'dark-linocut-topographic'
  } });
  const runtime = createRuntimeWithSettings(context.sandbox, {
    documentObj: context.documentObj, windowObj: context.windowObj,
    storageArea: prefs, localWallpaperStorageArea: createMemoryStorage()
  });
  await runtime.bootstrapInitialWallpaper();
  runtime.createControls();
  openPanel(runtime);
  panelActions(runtime).selectSourceTab('bing');
  await waitForAsyncWallpaperApply();
  const bing = () => panelState(runtime).wallpaper.bing;
  assert.deepStrictEqual(bing().tiles.map((tile) => tile.id), [id], 'the recent Bing photos are listed');
  assert.strictEqual(bing().tiles[0].tooltip, 'River · 2026-10-02', 'Bing tiles are named by place and date');
  panelActions(runtime).setBingDaily(true);
  await waitForAsyncWallpaperApply();
  assert.strictEqual(readPickedWallpaper(prefs).light, 'bing-daily', 'Persist daily intent instead of a fixed image ID');
  assert.strictEqual(prefs.data[WALLPAPER_STORAGE_KEY].light, DEFAULT_WALLPAPER_ID,
    'The shared key keeps a built-in stand-in that older versions accept');
  assert.strictEqual(readPickedWallpaper(prefs).dark, 'dark-linocut-topographic', 'Respect split light/dark settings');
  assert.strictEqual(bing().daily.toggle.checked, true);
  assert.strictEqual(bing().selected.meta, 'River bank · © Photographer', 'Split Bing credits into place and photographer');
  assert.strictEqual(bing().selected.title, 'River');
  assert.strictEqual(bing().selected.visible, true);
  assert.strictEqual(findTile(runtime, id).selected, true, 'Daily mode should highlight the dated tile it resolves to');
  panelActions(runtime).setBingDaily(false);
  await waitForAsyncWallpaperApply();
  assert.strictEqual(readPickedWallpaper(prefs).light, id, 'Turning off daily should fix the current photo');
  assert.strictEqual(bing().daily.toggle.checked, false);
  clickTile(runtime, id);
  await waitForAsyncWallpaperApply();
  assert.strictEqual(readPickedWallpaper(prefs).light, id);

  let completeDownload;
  waitForDownload = new Promise((resolve) => { completeDownload = resolve; });
  panelActions(runtime).setBingDaily(true);
  assert.strictEqual(bing().daily.busy, true, 'the daily switch waits while the photo downloads');
  assert.strictEqual(bing().refresh.disabled, true);
  clickTile(runtime, 'dark-monet-lily-nocturne');
  completeDownload();
  await waitForAsyncWallpaperApply();
  assert.strictEqual(readPickedWallpaper(prefs).light, 'dark-monet-lily-nocturne',
    'A completed Bing download must not override a newer manual choice');
  assert.strictEqual(bing().daily.toggle.checked, false);
  assert.strictEqual(bing().daily.busy, false);
}

async function testLegacyOnlineWallpaperMigratesToBing() {
  const remote = require('../../src/newtab/remote-content.ts');
  const ensured = [];
  const photo = { ...remote.wallpaperFromId('bing-20261002-OHR.River_ZH-CN123'),
    id: remote.BING_DAILY_ID };
  const client = { getWallpaper: () => photo, restoreWallpaper: async () => photo,
    ensureWallpaper: async (id) => { ensured.push(id); return photo; }, setPinnedIds() {} };
  const context = createWallpaperSandbox({ remoteApi: { ...remote, createClient: () => client } });
  const prefs = createMemoryStorage({ [WALLPAPER_STORAGE_KEY]: 'wallhaven-abc123' });
  const runtime = createRuntimeWithSettings(context.sandbox, {
    documentObj: context.documentObj, windowObj: context.windowObj,
    storageArea: prefs, localWallpaperStorageArea: createMemoryStorage()
  });
  await runtime.bootstrapInitialWallpaper();
  await waitForAsyncWallpaperApply();
  assert.strictEqual(readPickedWallpaper(prefs), 'bing-daily');
  assert.strictEqual(prefs.data[WALLPAPER_STORAGE_KEY], DEFAULT_WALLPAPER_ID);
  assert(ensured.includes('bing-daily'), 'Start daily updates after migrating the old provider');
}

function readPickedWallpaper(storage) {
  const online = storage.data[ONLINE_WALLPAPER_STORAGE_KEY];
  return online && online.value || storage.data[WALLPAPER_STORAGE_KEY];
}

async function testOnlineWallpaperSurvivesOlderVersions() {
  const remote = require('../../src/newtab/remote-content.ts');
  const photo = { ...remote.wallpaperFromId('bing-20261002-OHR.River_ZH-CN123'), id: remote.BING_DAILY_ID };
  const client = { getWallpaper: () => photo, restoreWallpaper: async () => photo,
    ensureWallpaper: async () => photo, setPinnedIds() {} };
  const prefs = createMemoryStorage({ [WALLPAPER_STORAGE_KEY]: 'bing-daily' });
  const boot = async () => {
    const context = createWallpaperSandbox({ remoteApi: { ...remote, createClient: () => client } });
    const runtime = createRuntimeWithSettings(context.sandbox, {
      documentObj: context.documentObj, windowObj: context.windowObj,
      storageArea: prefs, localWallpaperStorageArea: createMemoryStorage()
    });
    await runtime.bootstrapInitialWallpaper();
    await waitForAsyncWallpaperApply();
    return context.documentObj;
  };
  await boot();
  assert.strictEqual(prefs.data[WALLPAPER_STORAGE_KEY], DEFAULT_WALLPAPER_ID,
    'Online picks saved under the shared key move out before older versions can clear them');
  assert.deepStrictEqual(JSON.parse(JSON.stringify(prefs.data[ONLINE_WALLPAPER_STORAGE_KEY])),
    { value: 'bing-daily', shared: DEFAULT_WALLPAPER_ID });
  await boot();
  assert.strictEqual(readPickedWallpaper(prefs), 'bing-daily', 'Re-saving the same stand-in keeps the online pick');

  prefs.data[WALLPAPER_STORAGE_KEY] = '';
  const testDocument = await boot();
  assert.strictEqual(testDocument.body.getAttribute('data-wallpaper-active'), 'false',
    'Turning wallpaper off on an older version still applies everywhere');
  prefs.data[WALLPAPER_STORAGE_KEY] = 'dark-linocut-topographic';
  const builtInDocument = await boot();
  assert.ok(
    builtInDocument.documentElement.style.getPropertyValue('--x-nt-wallpaper-image').includes('linocut-topographic'),
    'A wallpaper chosen on an older version replaces the online pick'
  );
  assert.strictEqual(prefs.data[WALLPAPER_STORAGE_KEY], 'dark-linocut-topographic');
}

function createCuratedRuntime(prefs, options) {
  const context = createWallpaperSandbox(options && options.sandbox);
  const toasts = [];
  const runtime = createRuntimeWithSettings(context.sandbox, {
    documentObj: context.documentObj, windowObj: context.windowObj,
    storageArea: prefs, localWallpaperStorageArea: (options && options.localStorageArea) || createMemoryStorage(),
    showToast: (message, isError) => toasts.push({ message, isError }),
    fetchRemoteContent: options && options.fetchRemoteContent,
    t: (_key, fallback) => fallback || ''
  });
  return { context, runtime, toasts };
}

function getCuratedTileIds(runtime) {
  return panelState(runtime).wallpaper.curated.tiles.map((tile) => tile.id);
}

async function testCuratedMixChoosesItsCategories() {
  const remote = require('../../src/newtab/remote-content.ts');
  const prefs = createMemoryStorage({ [WALLPAPER_STORAGE_KEY]: DEFAULT_WALLPAPER_ID });
  const { context, runtime } = createCuratedRuntime(prefs);
  await runtime.bootstrapInitialWallpaper();
  runtime.createControls();
  const mix = () => panelState(runtime).wallpaper.curated.mix;
  openPanel(runtime);
  panelActions(runtime).selectSourceTab('curated');
  await waitForAsyncWallpaperApply();
  const categories = remote.CURATED_CATEGORIES.filter((value) => value !== 'random');
  assert.strictEqual(mix().visible, true, 'The random tab shows which categories it mixes');
  assert.strictEqual(mix().label, 'All categories');
  assert.deepStrictEqual(mix().options.map((option) => [option.value, option.checked]),
    categories.map((value) => [value, true]));

  panelActions(runtime).setCuratedDaily(true);
  await waitForAsyncWallpaperApply();
  assert.strictEqual(readPickedWallpaper(prefs), 'curated-daily-random');
  const keep = ['city', 'water'];
  categories.filter((value) => !keep.includes(value))
    .forEach((value) => panelActions(runtime).setCuratedMixCategory(value, false));
  await waitForAsyncWallpaperApply();
  const excluded = categories.filter((value) => !keep.includes(value));
  assert.deepStrictEqual(clonePlain(prefs.data[CURATED_MIX_EXCLUDED_STORAGE_KEY]), excluded,
    'The categories left out sync, so every device mixes the same photos');
  assert.strictEqual(mix().label, 'Water, City', 'A short mix names its categories');
  // The page shares this module, so it already lists the narrowed mix.
  assert.ok(getCuratedTileIds(runtime).every((id) => keep.includes(remote.wallpaperFromId(id).category)),
    'The mix lists only the chosen categories');
  const today = remote.getCuratedDailyWallpaper('random', Date.now());
  assert.ok(keep.includes(today.category), 'The daily photo comes from the chosen categories');
  assert.ok(context.documentObj.documentElement.style.getPropertyValue('--x-nt-wallpaper-image')
    .includes(today.thumbnailUrl), 'The daily wallpaper follows the new mix right away');
  assert.strictEqual(findTile(runtime, today.id).selected, true, 'The list opens on the page that holds it');

  panelActions(runtime).setCuratedMixCategory('city', false);
  await waitForAsyncWallpaperApply();
  const water = mix().options.find((option) => option.value === 'water');
  assert.strictEqual(water.disabled, true, 'The last category in the mix cannot be left out');
  const writes = prefs.sets.length;
  panelActions(runtime).setCuratedMixCategory('water', false);
  assert.strictEqual(prefs.sets.length, writes, 'Leaving out the last category changes nothing');

  categories.forEach((value) => panelActions(runtime).setCuratedMixCategory(value, true));
  await waitForAsyncWallpaperApply();
  assert.strictEqual(prefs.data[CURATED_MIX_EXCLUDED_STORAGE_KEY], '', 'A full mix clears the setting');
  assert.strictEqual(mix().label, 'All categories');

  panelActions(runtime).selectCuratedCategory('nature');
  await waitForAsyncWallpaperApply();
  assert.strictEqual(mix().visible, false, 'Other categories hide the mix menu');

  // A choice synced from another device applies on the next read.
  prefs.data[CURATED_MIX_EXCLUDED_STORAGE_KEY] = ['art'];
  const second = createCuratedRuntime(prefs);
  await second.runtime.bootstrapInitialWallpaper();
  second.runtime.createControls();
  openPanel(second.runtime);
  panelActions(second.runtime).selectSourceTab('curated');
  await waitForAsyncWallpaperApply();
  assert.strictEqual(panelState(second.runtime).wallpaper.curated.mix.options
    .find((option) => option.value === 'art').checked, false);
  remote.setRandomMixExcluded([]);
}

async function testCuratedWallpapersSyncAsIdsAndRotateDaily() {
  const remote = require('../../src/newtab/remote-content.ts');
  const prefs = createMemoryStorage({ [WALLPAPER_STORAGE_KEY]: DEFAULT_WALLPAPER_ID });
  const { context, runtime } = createCuratedRuntime(prefs);
  await runtime.bootstrapInitialWallpaper();
  runtime.createControls();
  const curated = () => panelState(runtime).wallpaper.curated;
  openPanel(runtime);
  panelActions(runtime).selectSourceTab('curated');
  await waitForAsyncWallpaperApply();
  assert.deepStrictEqual(getCuratedTileIds(runtime),
    remote.getCuratedWallpapers('random').slice(0, 9).map((item) => item.id),
    'The curated source opens on the random mix with three full rows');
  panelActions(runtime).selectCuratedCategory('nature');
  await waitForAsyncWallpaperApply();
  const nature = remote.getCuratedWallpapers('nature');
  assert.deepStrictEqual(getCuratedTileIds(runtime), nature.slice(0, 9).map((item) => item.id));
  assert.strictEqual(curated().category.tabs.active, 'nature');

  const picked = nature[1];
  clickTile(runtime, picked.id);
  await waitForAsyncWallpaperApply();
  assert.strictEqual(readPickedWallpaper(prefs), picked.id, 'A curated photo syncs as its ID alone');
  assert.strictEqual(prefs.data[WALLPAPER_STORAGE_KEY], DEFAULT_WALLPAPER_ID,
    'The shared key keeps a built-in stand-in that older versions accept');
  assert.ok(context.documentObj.documentElement.style.getPropertyValue('--x-nt-wallpaper-image')
    .includes(picked.thumbnailUrl), 'The photo shows its Picsum thumbnail until this device caches a copy');
  assert.strictEqual(curated().selected.title, `Photo by ${picked.name}`, 'Bundled credits name the photographer');
  assert.strictEqual(curated().selected.url, picked.sourceUrl);

  panelActions(runtime).showMoreCurated();
  assert.deepStrictEqual(getCuratedTileIds(runtime), nature.slice(9, 18).map((item) => item.id),
    'Showing others pages through the category without moving the chosen photo into it');
  panelActions(runtime).selectCuratedCategory('city');
  await waitForAsyncWallpaperApply();
  assert.strictEqual(readPickedWallpaper(prefs), picked.id, 'Browsing another category keeps the wallpaper');
  assert.deepStrictEqual(getCuratedTileIds(runtime),
    remote.getCuratedWallpapers('city').slice(0, 9).map((item) => item.id));

  panelActions(runtime).setCuratedDaily(true);
  await waitForAsyncWallpaperApply();
  const todayCity = remote.getCuratedDailyWallpaper('city', Date.now());
  assert.strictEqual(readPickedWallpaper(prefs), 'curated-daily-city',
    'Daily mode syncs the category, so each device resolves the same photo for the date');
  assert.strictEqual(curated().daily.toggle.checked, true);
  assert.strictEqual(findTile(runtime, todayCity.id).selected, true, 'The list opens on the page that holds the daily photo');

  const shownBefore = context.documentObj.documentElement.style.getPropertyValue('--x-nt-wallpaper-image');
  panelActions(runtime).selectCuratedCategory('water');
  await waitForAsyncWallpaperApply();
  assert.strictEqual(readPickedWallpaper(prefs), 'curated-daily-city', 'A category tab only browses, even with daily on');
  assert.strictEqual(context.documentObj.documentElement.style.getPropertyValue('--x-nt-wallpaper-image'), shownBefore,
    'Browsing another category keeps the wallpaper');
  panelActions(runtime).setCuratedDaily(false);
  await waitForAsyncWallpaperApply();
  panelActions(runtime).setCuratedDaily(true);
  await waitForAsyncWallpaperApply();
  assert.strictEqual(readPickedWallpaper(prefs), 'curated-daily-water',
    'Turning daily on uses the category on screen');

  const todayWater = remote.getCuratedDailyWallpaper('water', Date.now());
  const otherWater = getCuratedTileIds(runtime).find((tileId) => tileId !== todayWater.id);
  clickTile(runtime, otherWater);
  await waitForAsyncWallpaperApply();
  assert.strictEqual(readPickedWallpaper(prefs), 'curated-daily-water', 'Picking a photo keeps daily updates on');
  assert.strictEqual(curated().daily.toggle.checked, true);
  assert.deepStrictEqual(clonePlain(prefs.data[DAILY_WALLPAPER_PICKS_STORAGE_KEY].picks),
    { 'curated-daily-water': otherWater }, 'The pick for today syncs with the daily choice');
  assert.ok(context.documentObj.documentElement.style.getPropertyValue('--x-nt-wallpaper-image')
    .includes(remote.wallpaperFromId(otherWater).thumbnailUrl), 'The picked photo shows instead of the scheduled one');
  assert.strictEqual(findTile(runtime, otherWater).selected, true);
  assert.strictEqual(curated().daily.restoreVisible, true, 'A restore button appears once today is overridden');
  const picksWrites = prefs.sets.length;
  clickTile(runtime, otherWater);
  assert.strictEqual(prefs.sets.length, picksWrites, 'Choosing the highlighted photo again changes nothing');

  panelActions(runtime).restoreDailyWallpaper();
  await waitForAsyncWallpaperApply();
  assert.strictEqual(prefs.data[DAILY_WALLPAPER_PICKS_STORAGE_KEY], '', 'Restoring drops the pick');
  assert.strictEqual(curated().daily.restoreVisible, false);
  assert.strictEqual(findTile(runtime, todayWater.id).selected, true, 'Restoring shows the scheduled photo again');

  clickTile(runtime, otherWater);
  await waitForAsyncWallpaperApply();
  const stalePicks = createMemoryStorage(clonePlain(prefs.data));
  stalePicks.data[DAILY_WALLPAPER_PICKS_STORAGE_KEY] = { day: '2000-1-1', picks: { 'curated-daily-water': otherWater } };
  const nextDay = createCuratedRuntime(stalePicks);
  await nextDay.runtime.bootstrapInitialWallpaper();
  await waitForAsyncWallpaperApply();
  assert.ok(nextDay.context.documentObj.documentElement.style.getPropertyValue('--x-nt-wallpaper-image')
    .includes(todayWater.thumbnailUrl), 'A pick from another day no longer counts');

  panelActions(runtime).setCuratedDaily(false);
  await waitForAsyncWallpaperApply();
  assert.strictEqual(readPickedWallpaper(prefs), otherWater,
    'Turning off daily keeps the photo on screen, including today\'s pick');

  const second = createCuratedRuntime(prefs);
  await second.runtime.bootstrapInitialWallpaper();
  second.runtime.createControls();
  await waitForAsyncWallpaperApply();
  openPanel(second.runtime);
  await waitForAsyncWallpaperApply();
  assert.strictEqual(panelState(second.runtime).wallpaper.activeTab, 'curated',
    'Another device opens the curated source for a synced curated pick');
  assert.strictEqual(panelState(second.runtime).wallpaper.curated.category.tabs.active, 'water',
    'The list shows the category of the synced photo');
}

function createWallpaperImageCacheDouble(records) {
  const images = new Map((records || []).map((record) => [record.id, record]));
  return {
    images,
    createWallpaperImageCache: () => ({
      readByIds: async (ids) => ids.map((id) => images.get(id)).filter(Boolean),
      write: async (record) => { images.set(record.id, record); },
      remove: async (id) => { images.delete(id); },
      keys: async () => Array.from(images.keys())
    })
  };
}

function createLinkLocalStoreApi(cache, built) {
  const localStoreApi = { ...createLocalWallpaperStoreApi([]), ...cache };
  const createStore = localStoreApi.createWallpaperLocalStore;
  localStoreApi.createWallpaperLocalStore = () => ({
    ...createStore(),
    write() { throw new Error('Link images must stay out of the custom wallpaper library'); },
    buildRecordFromFile(file) {
      built.push({ name: file.name, type: file.type });
      return Promise.resolve({ id: `${CUSTOM_WALLPAPER_ID_PREFIX}unused`, name: file.name,
        imageDataUrl: 'data:image/webp;base64,bGluaw==', thumbnailDataUrl: 'data:image/webp;base64,dGh1bWI=',
        updatedAt: 1 });
    }
  });
  return localStoreApi;
}

async function testCuratedArtCachesOneDownscaledPrintPerDevice() {
  const remote = require('../../src/newtab/remote-content.ts');
  const requests = [];
  const cache = createWallpaperImageCacheDouble();
  const prefs = createMemoryStorage({ [WALLPAPER_STORAGE_KEY]: DEFAULT_WALLPAPER_ID });
  const { context, runtime } = createCuratedRuntime(prefs, {
    sandbox: { localStoreApi: createLinkLocalStoreApi(cache, []) },
    fetchRemoteContent: async (url) => {
      requests.push(url);
      return { ok: true, status: 200, url, blob: async () => new Blob(['print'], { type: 'image/jpeg' }) };
    }
  });
  await runtime.bootstrapInitialWallpaper();
  runtime.createControls();
  const image = () => context.documentObj.documentElement.style.getPropertyValue('--x-nt-wallpaper-image');
  openPanel(runtime);
  panelActions(runtime).selectSourceTab('curated');
  panelActions(runtime).selectCuratedCategory('art');
  await waitForAsyncWallpaperApply();
  const [first, second] = remote.getCuratedWallpapers('art');
  assert.strictEqual(getCuratedTileIds(runtime)[0], first.id);
  assert.ok(findTile(runtime, first.id).thumbnailUrl.endsWith('_web.jpg'), 'Tiles use the museum web image');

  clickTile(runtime, first.id);
  await waitForAsyncWallpaperApply();
  await waitForAsyncWallpaperApply();
  assert.strictEqual(readPickedWallpaper(prefs), first.id, 'A painting syncs as its ID alone');
  assert.deepStrictEqual(requests, [first.imageUrl], 'The print downloads once');
  assert.ok(cache.images.has(first.id), 'The downscaled print is cached on this device');
  assert.ok(image().includes('data:image/webp;base64,bGluaw=='), 'The wallpaper shows the cached copy');
  const source = panelState(runtime).wallpaper.curated.selected;
  assert.strictEqual(source.title, first.title, 'Paintings are credited by title');
  assert.ok(source.meta.includes('The Cleveland Museum of Art'));
  assert.strictEqual(source.url, first.sourceUrl);

  clickTile(runtime, second.id);
  await waitForAsyncWallpaperApply();
  await waitForAsyncWallpaperApply();
  assert.deepStrictEqual(Array.from(cache.images.keys()), [second.id],
    'A print no mode shows is dropped, so daily art does not pile up');

  const preload = JSON.parse(context.windowObj.localStorage.getItem(WALLPAPER_PRELOAD_STORAGE_KEY));
  assert.deepStrictEqual(preload.wallpapers.light, {
    id: second.id,
    cachedImage: { id: second.id, url: second.imageUrl }
  }, 'The first frame paints the downscaled copy, never the multi-megabyte print');
  assert.strictEqual(preload.wallpapers.light.path, undefined, 'The preload names no network file to load');
}

function createFakeImageCacheDatabase(records, keyPath) {
  const store = new Map((records || []).map((record) => [record[keyPath || 'id'], record]));
  const later = (callback) => setTimeout(callback, 0);
  return {
    opened: [],
    open(name, version) {
      this.opened.push([name, version]);
      const request = { result: null, onsuccess: null, onerror: null, onupgradeneeded: null };
      later(() => {
        request.result = {
          close() {},
          transaction: () => ({
            objectStore: () => ({
              get(id) {
                const read = { result: undefined, onsuccess: null, onerror: null };
                later(() => {
                  read.result = store.get(id);
                  if (read.onsuccess) read.onsuccess();
                });
                return read;
              }
            })
          })
        };
        if (request.onsuccess) request.onsuccess();
      });
      return request;
    }
  };
}

async function testPreloadPaintsTheCachedOnlineCopyBeforeTheRuntime() {
  const photoUrl = 'https://www.bing.com/th?id=OHR.River_ZH-CN123_1920x1080.jpg&pid=hp';
  const dataUrl = 'data:image/webp;base64,cml2ZXI=';
  const run = (records, entry, beforeRead) => {
    const documentObj = createFakeDocument();
    const windowObj = createFakeWindow();
    windowObj.indexedDB = createFakeImageCacheDatabase(records);
    windowObj.localStorage.setItem(WALLPAPER_PRELOAD_STORAGE_KEY, JSON.stringify({
      version: WALLPAPER_PRELOAD_STORAGE_VERSION,
      mode: 'light',
      themeMode: 'light',
      overlayStops: {
        light: { top: 0, mid: 0, bottom: 0 },
        dark: { top: 0, mid: 0, bottom: 0 }
      },
      wallpapers: { light: entry, dark: null }
    }));
    const sandbox = { ...REAL_WALLPAPER_DEPENDENCIES, document: documentObj, window: windowObj, chrome: {} };
    vm.runInNewContext(moduleScript('src/newtab/wallpaper/wallpaper-preload.ts', undefined, null, { 'src/domain/settings/index.ts': 'LumnoSettings', 'src/newtab/remote-content.ts': 'LumnoNewtabRemoteContent', 'src/newtab/wallpaper/wallpaper-adaptive-tone.ts': 'LumnoNewtabWallpaperAdaptiveTone', 'src/newtab/wallpaper/wallpaper-effects.ts': 'LumnoNewtabWallpaperEffects', 'src/shared/wallpaper-local-store.ts': 'LumnoNewtabWallpaperLocalStore' }), sandbox, {
      filename: 'src/newtab/wallpaper/wallpaper-preload.ts'
    });
    if (beforeRead) beforeRead(sandbox.__lumnoBoot?.wallpaperPreload);
    return { documentObj, windowObj, preload: sandbox.__lumnoBoot?.wallpaperPreload };
  };
  const entry = { id: 'bing-daily', cachedImage: { id: 'bing-20261002-OHR.River_ZH-CN123', url: photoUrl } };
  const record = { id: entry.cachedImage.id, url: photoUrl, imageDataUrl: dataUrl };

  const painted = run([record], entry);
  assert.strictEqual(painted.documentObj.documentElement.style.getPropertyValue('--x-nt-wallpaper-image'), '',
    'IndexedDB is asynchronous, so nothing paints before the copy is read');
  assert.strictEqual(await painted.preload.imageReady, dataUrl);
  assert.ok(painted.documentObj.documentElement.style.getPropertyValue('--x-nt-wallpaper-image').includes(dataUrl),
    'The cached copy paints while the page is still loading');
  assert.strictEqual(painted.documentObj.documentElement.getAttribute('data-wallpaper-active'), 'true');
  assert.deepStrictEqual(painted.windowObj.indexedDB.opened, [['lumno-newtab-wallpaper-cache', 1]]);
  assert.strictEqual(painted.preload.cachedImageRecord, record, 'The runtime reuses the copy instead of reading it again');

  const replaced = run([{ ...record, url: 'https://www.bing.com/th?id=OHR.Other' }], entry);
  assert.strictEqual(await replaced.preload.imageReady, '', 'A copy of another image never paints');
  assert.strictEqual(replaced.documentObj.documentElement.style.getPropertyValue('--x-nt-wallpaper-image'), '');

  const late = run([record], entry, (preload) => { preload.runtimeApplied = true; });
  assert.strictEqual(await late.preload.imageReady, '');
  assert.strictEqual(late.documentObj.documentElement.style.getPropertyValue('--x-nt-wallpaper-image'), '',
    'A copy read after the runtime painted must not cover its choice');
}

function runWallpaperPreloadWithEntry(entry, prepareWindow) {
  const documentObj = createFakeDocument();
  const windowObj = createFakeWindow();
  windowObj.localStorage.setItem(WALLPAPER_PRELOAD_STORAGE_KEY, JSON.stringify({
    version: WALLPAPER_PRELOAD_STORAGE_VERSION,
    mode: 'light',
    themeMode: 'light',
    overlayStops: {
      light: { top: 0, mid: 0, bottom: 0 },
      dark: { top: 0, mid: 0, bottom: 0 }
    },
    wallpapers: { light: entry, dark: null }
  }));
  if (prepareWindow) prepareWindow(windowObj);
  const sandbox = { ...REAL_WALLPAPER_DEPENDENCIES, document: documentObj, window: windowObj, chrome: {} };
  vm.runInNewContext(moduleScript('src/newtab/wallpaper/wallpaper-preload.ts', undefined, null, { 'src/domain/settings/index.ts': 'LumnoSettings', 'src/newtab/remote-content.ts': 'LumnoNewtabRemoteContent', 'src/newtab/wallpaper/wallpaper-adaptive-tone.ts': 'LumnoNewtabWallpaperAdaptiveTone', 'src/newtab/wallpaper/wallpaper-effects.ts': 'LumnoNewtabWallpaperEffects', 'src/shared/wallpaper-local-store.ts': 'LumnoNewtabWallpaperLocalStore' }), sandbox, {
    filename: 'src/newtab/wallpaper/wallpaper-preload.ts'
  });
  return { documentObj, windowObj, preload: sandbox.__lumnoBoot?.wallpaperPreload };
}

function createRecordingObjectUrls() {
  const created = [];
  const revoked = [];
  return {
    created,
    revoked,
    install(windowObj) {
      windowObj.atob = (value) => Buffer.from(value, 'base64').toString('binary');
      windowObj.Blob = Blob;
      windowObj.URL = {
        createObjectURL(blob) {
          created.push(blob);
          return `blob:chrome-extension://abc/wallpaper-${created.length}`;
        },
        revokeObjectURL(url) {
          revoked.push(url);
        }
      };
    }
  };
}

async function testPreloadPaintsTheUploadFromTheLocalLibrary() {
  const id = `${CUSTOM_WALLPAPER_ID_PREFIX}1760000000000`;
  const dataUrl = 'data:image/webp;base64,dXBsb2Fk';
  const record = { key: id, id, imageDataUrl: dataUrl, thumbnailDataUrl: dataUrl, updatedAt: 1 };
  const entry = { id, customImage: { id } };
  const withLibrary = (records) => (windowObj) => {
    windowObj.indexedDB = createFakeImageCacheDatabase(records, 'key');
    windowObj.Image = createFakeImageClass();
  };

  const painted = runWallpaperPreloadWithEntry(entry, withLibrary([record]));
  assert.strictEqual(painted.preload.customImageId, id);
  assert.strictEqual(painted.preload.wallpaper.id, id, 'effects render the upload the preload paints');
  assert.strictEqual(painted.documentObj.documentElement.style.getPropertyValue('--x-nt-wallpaper-image'), '',
    'IndexedDB is asynchronous, so nothing paints before the upload is read');
  assert.strictEqual(await painted.preload.imageReady, dataUrl);
  assert.deepStrictEqual(painted.windowObj.indexedDB.opened, [['lumno-newtab-wallpaper', 1]],
    'the upload is read from the local wallpaper library');
  assert.strictEqual(painted.documentObj.documentElement.style.getPropertyValue('--x-nt-wallpaper-image'),
    `url("${dataUrl}")`, 'the upload paints at full resolution while the page is still loading');
  assert.strictEqual(painted.documentObj.documentElement.getAttribute('data-wallpaper-active'), 'true');
  assert.strictEqual(painted.preload.cachedImageRecord, record, 'the runtime reuses the record instead of reading it again');
  assert.strictEqual(painted.preload.imageUrl, dataUrl);
  assert.strictEqual(painted.preload.decodedImage.url, dataUrl, 'the image decodes for the first tone sample');
  assert.strictEqual((await painted.preload.decodedImage.ready).src, dataUrl);

  const legacy = runWallpaperPreloadWithEntry({ id: `${CUSTOM_WALLPAPER_ID_PREFIX}legacy`,
    customImage: { id: `${CUSTOM_WALLPAPER_ID_PREFIX}legacy`, key: 'custom' } },
  withLibrary([{ key: 'custom', imageDataUrl: dataUrl, thumbnailDataUrl: dataUrl }]));
  assert.strictEqual(await legacy.preload.imageReady, dataUrl, 'an upload stored under the legacy key is read by that key');

  const removed = runWallpaperPreloadWithEntry(entry, withLibrary([]));
  assert.strictEqual(await removed.preload.imageReady, '', 'a removed upload paints nothing; the runtime decides');
  assert.strictEqual(removed.documentObj.documentElement.style.getPropertyValue('--x-nt-wallpaper-image'), '');

  const late = runWallpaperPreloadWithEntry(entry, withLibrary([record]));
  late.preload.runtimeApplied = true;
  assert.strictEqual(await late.preload.imageReady, '');
  assert.strictEqual(late.documentObj.documentElement.style.getPropertyValue('--x-nt-wallpaper-image'), '',
    'an upload read after the runtime painted must not cover its choice');

  const forged = runWallpaperPreloadWithEntry({ id: 'dark-shanshui-moonlit', customImage: { id: 'dark-shanshui-moonlit' } },
    withLibrary([record]));
  assert.strictEqual(forged.preload, undefined, 'only upload IDs are read from the library');
}

async function testRuntimeAdoptsThePreloadedUploadAndItsBlobUrl() {
  const id = `${CUSTOM_WALLPAPER_ID_PREFIX}1760000000001`;
  // Past the inline limit: every style recalculation re-reads --x-nt-wallpaper-image, so long data
  // URLs reach CSS as blob URLs.
  const dataUrl = `data:image/webp;base64,${'A'.repeat(40 * 1024)}`;
  const record = { key: id, id, imageDataUrl: dataUrl, thumbnailDataUrl: 'data:image/webp;base64,dGh1bWI=', updatedAt: 1 };
  const objectUrls = createRecordingObjectUrls();
  const { documentObj: preloadDocument, preload } = runWallpaperPreloadWithEntry({ id, customImage: { id } }, (windowObj) => {
    windowObj.indexedDB = createFakeImageCacheDatabase([record], 'key');
    objectUrls.install(windowObj);
  });
  assert.strictEqual(await preload.imageReady, dataUrl);
  assert.strictEqual(preloadDocument.documentElement.style.getPropertyValue('--x-nt-wallpaper-image'),
    'url("blob:chrome-extension://abc/wallpaper-1")', 'the preload paints a long upload through a blob URL');
  assert.strictEqual(preload.cssObjectUrl.source, dataUrl);
  assert.strictEqual(preload.cssObjectUrl.url, 'blob:chrome-extension://abc/wallpaper-1');
  assert.strictEqual(objectUrls.created[0].size, 30 * 1024);
  assert.strictEqual(preload.imageUrl, dataUrl, 'effects and samples keep the data URL the runtime uses');

  const metrics = {};
  const { documentObj, windowObj, sandbox: runtimeSandbox } = createWallpaperSandbox({
    localStoreApi: createLocalWallpaperStoreApi([record], metrics),
    preload,
    prepareWindow: (testWindow) => objectUrls.install(testWindow)
  });
  documentObj.documentElement.style.setProperty('--x-nt-wallpaper-image',
    preloadDocument.documentElement.style.getPropertyValue('--x-nt-wallpaper-image'));
  const runtime = createRuntimeWithSettings(runtimeSandbox, {
    documentObj,
    windowObj,
    storageArea: createMemoryStorage({ [WALLPAPER_STORAGE_KEY]: 'custom-upload' }),
    localWallpaperStorageArea: createMemoryStorage({ [LOCAL_WALLPAPER_STORAGE_KEY]: id }),
    storageKeys: { wallpaper: WALLPAPER_STORAGE_KEY, localWallpaper: LOCAL_WALLPAPER_STORAGE_KEY },
    t: (_key, fallback) => fallback || ''
  });
  await runtime.bootstrapInitialWallpaper();
  assert.deepStrictEqual(metrics.readByIds, [], 'the runtime takes the preloaded record instead of reading the library');
  assert.strictEqual(documentObj.documentElement.style.getPropertyValue('--x-nt-wallpaper-image'),
    'url("blob:chrome-extension://abc/wallpaper-1")',
    'the runtime keeps the blob URL the preload painted, so the background never swaps to an undecoded copy');
  assert.strictEqual(objectUrls.created.length, 1, 'the upload is turned into a blob once');
  assert.deepStrictEqual(objectUrls.revoked, []);
  assert.strictEqual(preload.cssObjectUrl, null, 'the handed-over URL is the runtime\'s to release now');
  const cached = JSON.parse(windowObj.localStorage.getItem(WALLPAPER_PRELOAD_STORAGE_KEY));
  assert.deepStrictEqual(cached.wallpapers.light.customImage, { id }, 'the next tab preloads the upload again');
  await runtime.waitForInitialWallpaperTone();
}

async function testShortDataUrlsStayInlineForCss() {
  const id = `${CUSTOM_WALLPAPER_ID_PREFIX}short`;
  const dataUrl = 'data:image/webp;base64,c2hvcnQ=';
  const objectUrls = createRecordingObjectUrls();
  const { documentObj, preload } = runWallpaperPreloadWithEntry({ id, customImage: { id } }, (windowObj) => {
    windowObj.indexedDB = createFakeImageCacheDatabase([{ key: id, id, imageDataUrl: dataUrl }], 'key');
    objectUrls.install(windowObj);
  });
  assert.strictEqual(await preload.imageReady, dataUrl);
  assert.strictEqual(documentObj.documentElement.style.getPropertyValue('--x-nt-wallpaper-image'), `url("${dataUrl}")`);
  assert.strictEqual(preload.cssObjectUrl, null);
  assert.strictEqual(objectUrls.created.length, 0, 'a short data URL needs no blob');
}

async function testOpenTabRollsOverWithoutOpeningThePanel() {
  const remote = require('../../src/newtab/remote-content.ts');
  const prefs = createMemoryStorage({
    [WALLPAPER_STORAGE_KEY]: DEFAULT_WALLPAPER_ID,
    [ONLINE_WALLPAPER_STORAGE_KEY]: { value: 'curated-daily-nature', shared: DEFAULT_WALLPAPER_ID }
  });
  // The client keeps its own reference to Date.now; read the clock through it so the test can move it.
  const { context, runtime } = createCuratedRuntime(prefs, { sandbox: { remoteApi: {
    ...remote, createClient: (config) => remote.createClient({ ...config, now: () => Date.now() })
  } } });
  runtime.createControls();
  await runtime.bootstrapInitialWallpaper();
  context.windowObj.__dispatchEvent('load');
  await waitForAsyncWallpaperApply();
  const image = () => context.documentObj.documentElement.style.getPropertyValue('--x-nt-wallpaper-image');
  const today = remote.getCuratedDailyWallpaper('nature', Date.now());
  assert.ok(image().includes(today.thumbnailUrl));

  const realNow = Date.now;
  const tomorrowNow = () => realNow() + 24 * 60 * 60 * 1000;
  Date.now = tomorrowNow;
  vm.runInContext('Date.now = globalThis.__tomorrowNow;', Object.assign(context.sandbox, { __tomorrowNow: tomorrowNow }));
  try {
    const tomorrow = remote.getCuratedDailyWallpaper('nature', Date.now());
    assert.notStrictEqual(tomorrow.id, today.id);
    context.windowObj.__dispatchEvent('focus');
    await waitForAsyncWallpaperApply();
    assert.ok(image().includes(tomorrow.thumbnailUrl),
      'A tab left open past midnight shows the new daily photo even if the panel was never opened');
  } finally {
    Date.now = realNow;
  }
}

// Each downloaded photo becomes a copy whose data URL names its source, so a test can tell copies apart.
function createDailyCopyHarness(records) {
  const cache = createWallpaperImageCacheDouble(records);
  const requests = [];
  const pending = new Map();
  const localStoreApi = createLinkLocalStoreApi(cache, []);
  const createStore = localStoreApi.createWallpaperLocalStore;
  localStoreApi.createWallpaperLocalStore = () => ({
    ...createStore(),
    async buildRecordFromFile(file) {
      const dataUrl = copyDataUrl(await file.text());
      return { id: `${CUSTOM_WALLPAPER_ID_PREFIX}unused`, name: file.name, imageDataUrl: dataUrl,
        thumbnailDataUrl: `${dataUrl}#thumb`, updatedAt: 1 };
    }
  });
  return {
    cache,
    requests,
    // Downloads of URLs listed here wait until release() lets them through.
    hold(url) { pending.set(url, null); },
    release(url) { const resolve = pending.get(url); pending.delete(url); if (resolve) resolve(); },
    options: {
      sandbox: { localStoreApi },
      fetchRemoteContent: async (url) => {
        requests.push(url);
        if (pending.has(url)) await new Promise((resolve) => pending.set(url, resolve));
        return { ok: true, status: 200, url, blob: async () => new Blob([url], { type: 'image/jpeg' }) };
      }
    }
  };
}

function copyDataUrl(sourceUrl) {
  return `data:image/webp;base64,${Buffer.from(sourceUrl).toString('base64')}`;
}

function copyRecord(photo) {
  const dataUrl = copyDataUrl(photo.imageUrl);
  return { id: photo.id, url: photo.imageUrl, imageDataUrl: dataUrl, thumbnailDataUrl: `${dataUrl}#thumb` };
}

// The runtime reads the clock in its own context and through the remote client in this one.
function createDailyRuntimeAt(prefs, harness, clock, localStorageValue) {
  const remote = require('../../src/newtab/remote-content.ts');
  const options = { ...harness.options, sandbox: { ...harness.options.sandbox, remoteApi: {
    ...remote, createClient: (config) => remote.createClient({ ...config, now: clock })
  } } };
  const created = createCuratedRuntime(prefs, options);
  vm.runInContext('Date.now = globalThis.__clock;', Object.assign(created.context.sandbox, { __clock: clock }));
  created.context.windowObj.requestIdleCallback = (callback) => setTimeout(callback, 0);
  if (localStorageValue) created.context.windowObj.localStorage.setItem(WALLPAPER_PRELOAD_STORAGE_KEY, localStorageValue);
  return created;
}

async function settleWallpaperCaching() {
  for (let index = 0; index < 6; index += 1) await waitForAsyncWallpaperApply();
}

async function testCuratedDailyCachesTomorrowsPhotoAhead() {
  const remote = require('../../src/newtab/remote-content.ts');
  const DAY = 24 * 60 * 60 * 1000;
  const start = new Date();
  const todayAt = new Date(start.getFullYear(), start.getMonth(), start.getDate(), 15).getTime();
  const at = (days) => () => todayAt + days * DAY;
  const [today, tomorrow, dayAfter] = [0, 1, 2]
    .map((days) => remote.getCuratedDailyWallpaper('nature', at(days)()));
  const prefs = () => createMemoryStorage({
    [WALLPAPER_STORAGE_KEY]: DEFAULT_WALLPAPER_ID,
    [ONLINE_WALLPAPER_STORAGE_KEY]: { value: 'curated-daily-nature', shared: DEFAULT_WALLPAPER_ID }
  });
  const harness = createDailyCopyHarness();
  const first = createDailyRuntimeAt(prefs(), harness, at(0));
  await first.runtime.bootstrapInitialWallpaper();
  first.context.windowObj.__dispatchEvent('load');
  await settleWallpaperCaching();
  assert.deepStrictEqual(harness.requests, [today.imageUrl, tomorrow.imageUrl],
    'Once today\'s photo is cached, the idle page downloads tomorrow\'s');
  assert.deepStrictEqual(Array.from(harness.cache.images.keys()).sort(), [today.id, tomorrow.id].sort());
  const stored = first.context.windowObj.localStorage.getItem(WALLPAPER_PRELOAD_STORAGE_KEY);
  const entry = JSON.parse(stored).wallpapers.light;
  assert.deepStrictEqual(entry.cachedImage, { id: today.id, url: today.imageUrl });
  assert.deepStrictEqual(entry.next, { day: remote.localDay(at(1)()),
    cachedImage: { id: tomorrow.id, url: tomorrow.imageUrl } }, 'The next tab learns tomorrow\'s copy');

  first.runtime.createControls();
  openPanel(first.runtime);
  panelActions(first.runtime).selectSourceTab('curated');
  panelActions(first.runtime).selectCuratedCategory('nature');
  const todayTile = panelState(first.runtime).wallpaper.curated.tiles.find((tile) => tile.id === today.id);
  assert.strictEqual(todayTile.thumbnailUrl, `${copyDataUrl(today.imageUrl)}#thumb`,
    'The panel shows a cached photo from its local thumbnail, not the network');

  // After midnight the first frame paints tomorrow's copy.
  const preloadDocument = createFakeDocument();
  const preloadWindow = createFakeWindow();
  preloadWindow.localStorage.setItem(WALLPAPER_PRELOAD_STORAGE_KEY, stored);
  preloadWindow.indexedDB = createFakeImageCacheDatabase(Array.from(harness.cache.images.values()));
  class TomorrowDate extends Date {
    static now() { return at(1)(); }
  }
  const preloadSandbox = { ...REAL_WALLPAPER_DEPENDENCIES, document: preloadDocument, window: preloadWindow,
    chrome: {}, Date: TomorrowDate };
  vm.runInNewContext(moduleScript('src/newtab/wallpaper/wallpaper-preload.ts', undefined, null, { 'src/domain/settings/index.ts': 'LumnoSettings', 'src/newtab/remote-content.ts': 'LumnoNewtabRemoteContent', 'src/newtab/wallpaper/wallpaper-adaptive-tone.ts': 'LumnoNewtabWallpaperAdaptiveTone', 'src/newtab/wallpaper/wallpaper-effects.ts': 'LumnoNewtabWallpaperEffects', 'src/shared/wallpaper-local-store.ts': 'LumnoNewtabWallpaperLocalStore' }), preloadSandbox, {
    filename: 'src/newtab/wallpaper/wallpaper-preload.ts'
  });
  assert.strictEqual(await preloadSandbox.__lumnoBoot?.wallpaperPreload.imageReady, copyDataUrl(tomorrow.imageUrl),
    'The first tab after midnight paints the new photo from this device');
  assert.strictEqual(preloadSandbox.__lumnoBoot?.wallpaperPreload.luminance, null,
    'Today\'s luminance does not carry over to tomorrow\'s photo');

  const next = createDailyRuntimeAt(prefs(), harness, at(1), stored);
  await next.runtime.bootstrapInitialWallpaper();
  const image = () => next.context.documentObj.documentElement.style.getPropertyValue('--x-nt-wallpaper-image');
  assert.ok(image().includes(copyDataUrl(tomorrow.imageUrl)), 'The runtime opens on tomorrow\'s copy at once');
  next.context.windowObj.__dispatchEvent('load');
  await settleWallpaperCaching();
  assert.deepStrictEqual(harness.requests.slice(2), [dayAfter.imageUrl],
    'Tomorrow\'s photo never downloads again; the day after\'s is fetched ahead');
  assert.deepStrictEqual(Array.from(harness.cache.images.keys()).sort(), [tomorrow.id, dayAfter.id].sort(),
    'Yesterday\'s copy is dropped, so copies do not pile up');
}

async function testDailySlotKeepsThePreviousCopyUntilTheNewOneIsCached() {
  const remote = require('../../src/newtab/remote-content.ts');
  const DAY = 24 * 60 * 60 * 1000;
  const start = new Date();
  const todayAt = new Date(start.getFullYear(), start.getMonth(), start.getDate(), 15).getTime();
  const at = (days) => () => todayAt + days * DAY;
  const friday = remote.getCuratedDailyWallpaper('city', at(0)());
  const monday = remote.getCuratedDailyWallpaper('city', at(3)());
  const prefs = createMemoryStorage({
    [WALLPAPER_STORAGE_KEY]: DEFAULT_WALLPAPER_ID,
    [ONLINE_WALLPAPER_STORAGE_KEY]: { value: 'curated-daily-city', shared: DEFAULT_WALLPAPER_ID }
  });
  // Away since Friday: the page remembers Friday's copy, and the copy fetched ahead was for Saturday.
  const saturday = remote.getCuratedDailyWallpaper('city', at(1)());
  const harness = createDailyCopyHarness([copyRecord(friday), copyRecord(saturday)]);
  const stored = JSON.stringify({
    version: WALLPAPER_PRELOAD_STORAGE_VERSION, mode: 'light', themeMode: 'light',
    overlayStops: { light: { top: 0, mid: 0, bottom: 0 }, dark: { top: 0, mid: 0, bottom: 0 } },
    wallpapers: {
      light: { id: 'curated-daily-city', cachedImage: { id: friday.id, url: friday.imageUrl },
        next: { day: remote.localDay(at(1)()), cachedImage: { id: saturday.id, url: saturday.imageUrl } } },
      dark: null
    }
  });
  harness.hold(monday.imageUrl);
  const { context, runtime } = createDailyRuntimeAt(prefs, harness, at(3), stored);
  const image = () => context.documentObj.documentElement.style.getPropertyValue('--x-nt-wallpaper-image');
  await runtime.bootstrapInitialWallpaper();
  context.windowObj.__dispatchEvent('load');
  await settleWallpaperCaching();
  assert.deepStrictEqual(harness.requests, [monday.imageUrl]);
  assert.ok(image().includes(copyDataUrl(friday.imageUrl)),
    'While Monday\'s photo downloads, the slot keeps the copy the first frame painted');
  assert.ok(!image().includes(monday.thumbnailUrl), 'The page never waits on a network thumbnail');
  assert.ok(harness.cache.images.has(friday.id), 'The copy on screen is not pruned while it stands in');

  harness.release(monday.imageUrl);
  await settleWallpaperCaching();
  assert.ok(image().includes(copyDataUrl(monday.imageUrl)), 'Monday\'s photo replaces it once cached');
  assert.ok(!harness.cache.images.has(friday.id), 'The stand-in is dropped once it is no longer shown');
}

async function testCuratedTilesComeFromTheThumbnailCache() {
  const remote = require('../../src/newtab/remote-content.ts');
  const thumbs = new Map();
  const requests = [];
  const localStoreApi = createLinkLocalStoreApi(createWallpaperImageCacheDouble(), []);
  const createStore = localStoreApi.createWallpaperLocalStore;
  localStoreApi.createWallpaperLocalStore = () => ({
    ...createStore(),
    buildTileThumbnail: async (file) => copyDataUrl(await file.text())
  });
  localStoreApi.createWallpaperThumbnailCache = () => ({
    readByIds: async (ids) => ids.map((id) => thumbs.get(id)).filter(Boolean),
    write: async (record) => { thumbs.set(record.id, record); }
  });
  const openCuratedTab = async (fetchRemoteContent) => {
    const { runtime } = createCuratedRuntime(createMemoryStorage({ [WALLPAPER_STORAGE_KEY]: DEFAULT_WALLPAPER_ID }), {
      sandbox: { localStoreApi, prepareWindow: (windowObj) => { windowObj.indexedDB = {}; } },
      fetchRemoteContent
    });
    await runtime.bootstrapInitialWallpaper();
    runtime.createControls();
    assert.ok(panelState(runtime).wallpaper.curated.tiles.every((tile) => tile.thumbnailUrl.startsWith('data:image/gif')),
      'The closed panel loads no curated tiles, so a new tab asks Picsum for nothing');
    openPanel(runtime);
    // The curated tab opens on the random mix.
    panelActions(runtime).selectSourceTab('curated');
    return runtime;
  };
  const online = async (url) => {
    requests.push(url);
    return { ok: true, status: 200, url, blob: async () => new Blob([url], { type: 'image/jpeg' }) };
  };
  const tiles = (runtime) => panelState(runtime).wallpaper.curated.tiles;

  const first = await openCuratedTab(online);
  const shown = tiles(first).map((tile) => remote.wallpaperFromId(tile.id));
  // The random mix also draws Cleveland Museum of Art prints on some days, so check each source's own size.
  assert.ok(shown.every((photo) => (photo.id.startsWith('picsum-') ? photo.thumbnailUrl.endsWith('/320/180')
    : photo.thumbnailUrl.endsWith('_web.jpg'))), 'Tiles ask for small thumbnails, such as Picsum at 320×180');
  assert.ok(tiles(first).every((tile) => tile.thumbnailUrl.startsWith('data:image/gif')),
    'While the cache is read, tiles start no Picsum request of their own');
  await settleWallpaperCaching();
  assert.deepStrictEqual(requests, shown.map((photo) => photo.thumbnailUrl), 'Each tile downloads once');
  assert.deepStrictEqual(tiles(first).map((tile) => tile.thumbnailUrl),
    shown.map((photo) => copyDataUrl(photo.thumbnailUrl)), 'Tiles show the copies kept on this device');
  assert.deepStrictEqual(Array.from(thumbs.keys()), shown.map((photo) => photo.id));

  const reopened = await openCuratedTab(online);
  await settleWallpaperCaching();
  assert.strictEqual(requests.length, shown.length, 'Opening the panel again asks Picsum for nothing');
  assert.deepStrictEqual(tiles(reopened).map((tile) => tile.thumbnailUrl),
    shown.map((photo) => copyDataUrl(photo.thumbnailUrl)));

  thumbs.clear();
  const offline = await openCuratedTab(async () => { throw new Error('offline'); });
  await settleWallpaperCaching();
  assert.deepStrictEqual(tiles(offline).map((tile) => tile.thumbnailUrl), shown.map((photo) => photo.thumbnailUrl),
    'A tile that cannot be cached loads from Picsum as before');
}

async function testCuratedPhotoOpensNewTabsFromTheCachedCopy() {
  const remote = require('../../src/newtab/remote-content.ts');
  const requests = [];
  const cache = createWallpaperImageCacheDouble();
  const fetchRemoteContent = async (url) => {
    requests.push(url);
    return { ok: true, status: 200, url, blob: async () => new Blob(['photo'], { type: 'image/jpeg' }) };
  };
  const prefs = createMemoryStorage({ [WALLPAPER_STORAGE_KEY]: DEFAULT_WALLPAPER_ID });
  const { context, runtime } = createCuratedRuntime(prefs, {
    sandbox: { localStoreApi: createLinkLocalStoreApi(cache, []) },
    fetchRemoteContent
  });
  await runtime.bootstrapInitialWallpaper();
  runtime.createControls();
  openPanel(runtime);
  panelActions(runtime).selectSourceTab('curated');
  panelActions(runtime).selectCuratedCategory('nature');
  await waitForAsyncWallpaperApply();
  const photo = remote.getCuratedWallpapers('nature')[0];
  clickTile(runtime, photo.id);
  await waitForAsyncWallpaperApply();
  await waitForAsyncWallpaperApply();
  assert.deepStrictEqual(requests, [photo.imageUrl], 'The photo downloads once');
  assert.ok(cache.images.has(photo.id), 'The downscaled photo is cached on this device');
  assert.ok(context.documentObj.documentElement.style.getPropertyValue('--x-nt-wallpaper-image')
    .includes('data:image/webp;base64,bGluaw=='), 'The wallpaper shows the cached copy');

  const nextTab = createCuratedRuntime(prefs, {
    sandbox: { localStoreApi: createLinkLocalStoreApi(cache, []) },
    fetchRemoteContent
  });
  await nextTab.runtime.bootstrapInitialWallpaper();
  await waitForAsyncWallpaperApply();
  assert.deepStrictEqual(requests, [photo.imageUrl], 'A new tab does not wait on Picsum again');
  assert.ok(nextTab.context.documentObj.documentElement.style.getPropertyValue('--x-nt-wallpaper-image')
    .includes('data:image/webp;base64,bGluaw=='), 'A new tab opens on the cached copy');
}

function createOfflineImageClass(requests) {
  return class OfflineImage {
    constructor() {
      this.onload = null;
      this.onerror = null;
      this.decoding = '';
      this._src = '';
    }

    set src(value) {
      this._src = String(value || '');
      if (!this._src) return;
      requests.push(this._src);
      setTimeout(() => {
        const callback = /^https?:/i.test(this._src) ? this.onerror : this.onload;
        if (typeof callback === 'function') callback();
      }, 0);
    }

    get src() {
      return this._src;
    }

    decode() {
      return Promise.resolve();
    }
  };
}

async function testNetworkWallpaperWaitsForThePageAndFallsBackOffline() {
  const remote = require('../../src/newtab/remote-content.ts');
  const photo = remote.getCuratedWallpapers('nature')[0];
  const prefs = createMemoryStorage({
    [WALLPAPER_STORAGE_KEY]: DEFAULT_WALLPAPER_ID,
    [ONLINE_WALLPAPER_STORAGE_KEY]: { value: photo.id, shared: DEFAULT_WALLPAPER_ID }
  });
  const requests = [];
  const offline = {
    sandbox: { Image: createOfflineImageClass(requests) },
    fetchRemoteContent: async () => { throw new Error('offline'); }
  };
  const { context, runtime } = createCuratedRuntime(prefs, offline);
  const image = () => context.documentObj.documentElement.style.getPropertyValue('--x-nt-wallpaper-image');
  context.documentObj.readyState = 'loading';
  await runtime.bootstrapInitialWallpaper();
  await waitForAsyncWallpaperApply();
  assert.strictEqual(image(), 'none', 'A photo without a cached copy does not paint from the network on load');
  assert.ok(!requests.some((url) => /^https?:/.test(url)), 'Network images wait for the page, so the tab stops loading');

  context.documentObj.readyState = 'complete';
  context.windowObj.__dispatchEvent('load');
  await waitForAsyncWallpaperApply();
  assert.ok(requests.includes(photo.thumbnailUrl), 'The thumbnail loads once the page has');
  assert.ok(image().includes('lumno-newtab-monet-coastal-white.webp'),
    'An image the network cannot deliver falls back to the bundled default instead of a blank page');
  const preload = JSON.parse(context.windowObj.localStorage.getItem(WALLPAPER_PRELOAD_STORAGE_KEY));
  assert.strictEqual(preload.wallpapers.light, null, 'The next tab does not start on a network image either');
}

async function testBingPhotoOpensNewTabsFromTheCachedCopy() {
  const id = 'bing-20261002-OHR.River_ZH-CN123';
  const remote = require('../../src/newtab/remote-content.ts');
  const photo = remote.wallpaperFromId(id);
  assert.strictEqual(photo.cacheImage, true, 'Bing photos are cached once per device');
  const requests = [];
  const cache = createWallpaperImageCacheDouble();
  const prefs = createMemoryStorage({
    [WALLPAPER_STORAGE_KEY]: DEFAULT_WALLPAPER_ID,
    [ONLINE_WALLPAPER_STORAGE_KEY]: { value: id, shared: DEFAULT_WALLPAPER_ID }
  });
  const options = {
    sandbox: { localStoreApi: createLinkLocalStoreApi(cache, []) },
    fetchRemoteContent: async (url) => {
      requests.push(url);
      return { ok: true, status: 200, url, blob: async () => new Blob(['photo'], { type: 'image/jpeg' }) };
    }
  };
  const first = createCuratedRuntime(prefs, options);
  await first.runtime.bootstrapInitialWallpaper();
  await waitForAsyncWallpaperApply();
  await waitForAsyncWallpaperApply();
  assert.deepStrictEqual(requests, [photo.imageUrl], 'The photo downloads once');
  assert.ok(cache.images.has(id), 'The downscaled photo is cached on this device');

  const nextTab = createCuratedRuntime(prefs, options);
  await nextTab.runtime.bootstrapInitialWallpaper();
  assert.ok(nextTab.context.documentObj.documentElement.style.getPropertyValue('--x-nt-wallpaper-image')
    .includes('data:image/webp;base64,bGluaw=='), 'A new tab opens on the cached copy');
  await waitForAsyncWallpaperApply();
  assert.deepStrictEqual(requests, [photo.imageUrl], 'A new tab does not wait on Bing again');
}

async function testRandomDailyWallpaperReopensOnTheRandomMix() {
  const remote = require('../../src/newtab/remote-content.ts');
  const prefs = createMemoryStorage({ [WALLPAPER_STORAGE_KEY]: DEFAULT_WALLPAPER_ID });
  const { runtime } = createCuratedRuntime(prefs);
  await runtime.bootstrapInitialWallpaper();
  runtime.createControls();
  openPanel(runtime);
  panelActions(runtime).selectSourceTab('curated');
  await waitForAsyncWallpaperApply();
  panelActions(runtime).setCuratedDaily(true);
  await waitForAsyncWallpaperApply();
  assert.strictEqual(readPickedWallpaper(prefs), 'curated-daily-random', 'Daily updates can draw from every category');
  const today = remote.getCuratedDailyWallpaper('random', Date.now());

  const other = createCuratedRuntime(prefs);
  await other.runtime.bootstrapInitialWallpaper();
  other.runtime.createControls();
  openPanel(other.runtime);
  await waitForAsyncWallpaperApply();
  assert.strictEqual(panelState(other.runtime).wallpaper.curated.category.tabs.active, 'random',
    'A random daily choice reopens on the random mix, not on the photo\'s own category');
  assert.strictEqual(findTile(other.runtime, today.id).selected, true,
    'The mix opens on the page that holds today\'s photo');
}

async function testLinkedWallpaperSyncsItsUrlAndCachesTheImage() {
  const requests = [];
  const built = [];
  const cache = createWallpaperImageCacheDouble();
  const prefs = createMemoryStorage({ [WALLPAPER_STORAGE_KEY]: DEFAULT_WALLPAPER_ID });
  const localStorageArea = createMemoryStorage();
  const fetchRemoteContent = async (url, init) => {
    requests.push({ url, init });
    return { ok: true, status: 200, url, blob: async () => new Blob(['image'], { type: 'application/octet-stream' }) };
  };
  const { context, runtime, toasts } = createCuratedRuntime(prefs, {
    sandbox: { localStoreApi: createLinkLocalStoreApi(cache, built) },
    localStorageArea,
    fetchRemoteContent
  });
  await runtime.bootstrapInitialWallpaper();
  runtime.createControls();
  const view = panelOf(runtime);
  const urlForm = () => panelState(runtime).wallpaper.local.url;
  openPanel(runtime);
  panelActions(runtime).selectSourceTab('local');
  panelActions(runtime).toggleUrlForm();
  await waitForAsyncWallpaperApply();
  assert.strictEqual(urlForm().open, true, 'The link tile opens the link form');
  assert.strictEqual(view.focused[view.focused.length - 1], 'urlInput', 'Opening the form focuses the field');

  panelActions(runtime).submitWallpaperUrl('javascript:alert(1)');
  assert.strictEqual(requests.length, 0, 'Only web links are fetched');
  assert.strictEqual(urlForm().invalid, true);
  assert.ok(toasts.some((toast) => toast.isError));
  panelActions(runtime).clearUrlInvalid();
  assert.strictEqual(urlForm().invalid, false, 'Editing the link clears the error');

  const url = 'https://images.example/photos/Lake%20View.JPG';
  panelActions(runtime).submitWallpaperUrl(` ${url} `);
  assert.strictEqual(urlForm().disabled, true, 'The form waits while the image downloads');
  await waitForAsyncWallpaperApply();
  await waitForAsyncWallpaperApply();
  assert.strictEqual(requests[0].url, url);
  assert.strictEqual(requests[0].init.credentials, 'omit', 'Linked images load without cookies');
  assert.deepStrictEqual(built, [{ name: 'Lake View', type: 'image/jpeg' }],
    'A generic binary type falls back to the file extension');
  const links = JSON.parse(JSON.stringify(prefs.data[LINK_WALLPAPERS_STORAGE_KEY]));
  assert.strictEqual(links.length, 1);
  assert.strictEqual(links[0].url, url, 'The link itself syncs');
  const linkId = links[0].id;
  assert.strictEqual(readPickedWallpaper(prefs), linkId, 'The selection syncs like an online pick');
  assert.strictEqual(prefs.data[WALLPAPER_STORAGE_KEY], DEFAULT_WALLPAPER_ID,
    'Older versions see a built-in stand-in instead of an ID they would clear');
  assert.ok(!localStorageArea.data[LOCAL_WALLPAPER_STORAGE_KEY], 'No device-only selection is left behind');
  assert.strictEqual(cache.images.get(linkId).url, url, 'This device keeps a cached copy');
  assert.ok(context.documentObj.documentElement.style.getPropertyValue('--x-nt-wallpaper-image')
    .includes('data:image/webp;base64,bGluaw=='), 'The wallpaper shows the cached copy');
  assert.strictEqual(urlForm().open, false, 'A successful import closes the form');
  assert.strictEqual(urlForm().clearToken, 1, 'A successful import clears the field');
  assert.strictEqual(urlForm().disabled, false);
  assert.ok(findTile(runtime, linkId), 'The link appears among local tiles');
  assert.strictEqual(findTile(runtime, linkId).source, 'local');

  panelActions(runtime).toggleUrlForm();
  await waitForAsyncWallpaperApply();
  assert.strictEqual(runtime.closeOpenMenu(), true, 'Escape closes the link form before the panel');
  assert.strictEqual(urlForm().open, false);
  assert.strictEqual(runtime.closeOpenMenu(), false);

  // Another device receives the link and selection, then caches the image on its own.
  const otherRequests = [];
  const otherCache = createWallpaperImageCacheDouble();
  const other = createCuratedRuntime(prefs, {
    sandbox: { localStoreApi: createLinkLocalStoreApi(otherCache, []) },
    fetchRemoteContent: async (target, init) => {
      otherRequests.push(target);
      return fetchRemoteContent(target, init);
    }
  });
  await other.runtime.bootstrapInitialWallpaper();
  await waitForAsyncWallpaperApply();
  assert.deepStrictEqual(otherRequests, [url], 'The other device downloads the synced link once');
  assert.strictEqual(otherCache.images.get(linkId).url, url);
  assert.ok(other.context.documentObj.documentElement.style.getPropertyValue('--x-nt-wallpaper-image')
    .includes('data:image/webp;base64,bGluaw=='));

  panelActions(runtime).deleteWallpaper(linkId);
  await waitForAsyncWallpaperApply();
  assert.deepStrictEqual(JSON.parse(JSON.stringify(prefs.data[LINK_WALLPAPERS_STORAGE_KEY])), [],
    'Deleting a link removes it from every synced device');
  assert.strictEqual(readPickedWallpaper(prefs), DEFAULT_WALLPAPER_ID, 'A deleted selected link falls back to the default');
  assert.strictEqual(cache.images.has(linkId), false);
  assert.strictEqual(findTile(runtime, linkId), null);
}

Promise.resolve()
  .then(() => {
    assertBrandMarkCopy();
    assertThemeAwareAlternateFaviconAsset();
    assertSquareFaviconOptionCss('newtab.html');
    assertSegmentedTabRadiusCss('newtab.html');
    assertEffectSelectCss('newtab.html');
  })
  .then(testBingDailySelectionAndManualOverride)
  .then(testLegacyOnlineWallpaperMigratesToBing)
  .then(testUnrecognizedSyncedWallpaperIsNotWrittenBack)
  .then(testOnlineWallpaperSurvivesOlderVersions)
  .then(testCuratedWallpapersSyncAsIdsAndRotateDaily)
  .then(testCuratedMixChoosesItsCategories)
  .then(testLinkedWallpaperSyncsItsUrlAndCachesTheImage)
  .then(testRandomDailyWallpaperReopensOnTheRandomMix)
  .then(testCuratedArtCachesOneDownscaledPrintPerDevice)
  .then(testCuratedPhotoOpensNewTabsFromTheCachedCopy)
  .then(testNetworkWallpaperWaitsForThePageAndFallsBackOffline)
  .then(testBingPhotoOpensNewTabsFromTheCachedCopy)
  .then(testPreloadPaintsTheCachedOnlineCopyBeforeTheRuntime)
  .then(testPreloadPaintsTheUploadFromTheLocalLibrary)
  .then(testRuntimeAdoptsThePreloadedUploadAndItsBlobUrl)
  .then(testShortDataUrlsStayInlineForCss)
  .then(testPreloadHandsOverLuminanceAndTheDecodedImage)
  .then(testOpenTabRollsOverWithoutOpeningThePanel)
  .then(testCuratedDailyCachesTomorrowsPhotoAhead)
  .then(testDailySlotKeepsThePreviousCopyUntilTheNewOneIsCached)
  .then(testCuratedTilesComeFromTheThumbnailCache)
  .then(testWallpaperSourcesHintWaitsForFinalFocusRoute)
  .then(testNewtabFaviconPreloadAppliesCachedAlternateBeforeMainRuntime)
  .then(testWallpaperPreloadUsesTheCachedResolvedMode)
  .then(testBuiltInWallpaperBootstrapDefersCustomCatalogRead)
  .then(testWallpaperTileIntentReusesDecodedImagePromise)
  .then(testRapidWallpaperSelectionNeverAppliesStaleDecode)
  .then(testSyncedCustomWallpaperWithoutLocalRecordFallsBackToDefault)
  .then(testLegacySyncedCustomWallpaperMigratesToLocalOnlySelection)
  .then(testOversizedDataUrlWallpaperRendersThroughBlobUrl)
  .then(testInitialThemeResolutionDoesNotPaintFallbackBeforeCustomWallpaper)
  .then(testWallpaperModeConsistencyDefaultsOnAndCopiesLegacySelectionWhenDisabled)
  .then(testDisablingWallpaperModeConsistencyIgnoresStaleLocalDisabledOverride)
  .then(testSplitWallpaperPanelOpensOnTheShownMode)
  .then(testWallpaperLuminanceIsCachedForThePreload)
  .then(testSplitBuiltInWallpaperSelectionFollowsResolvedTheme)
  .then(testWallpaperPreloadCacheRetainsMinimumLightOverlay)
  .then(testSplitLocalWallpaperSelectionStaysLocalOnly)
  .then(testDeletingLocalWallpapersKeepsTheLocalTabOpen)
  .then(testNewtabFaviconOptionsRenderBelowLogoAndPersistSelection)
  .then(testNewtabFaviconThemeBroadcastRefreshesBackgroundTabs)
  .then(testWallpaperEffectInkToneControlPersistsAndFollowsEffectType)
  .then(testBlocksExposeReliefControls)
  .then(testEffectSpecificParametersRoundTrip)
  .then(testOverlayAndStrengthSnapToTheirMarksWhileDragged)
  .then(testTimeSettingsFollowTheContentAboveTheSearchBar)
  .then(testGlassBlurCanBeEnabledAndDisabled)
  .then(testGlassBlurFilterSwitchPreservesTheOutgoingFrame)
  .then(testCrtFilterPersistsAndShowsDisplayControls)
  .then(() => {
    console.log('newtab wallpaper panel tests passed');
  })
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
