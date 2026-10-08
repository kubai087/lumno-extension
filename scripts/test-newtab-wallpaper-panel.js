const assert = require('assert');
const fs = require('fs');
const vm = require('vm');
const { readPageSource } = require('./helpers/page-source');
const { readNewtabRuntimeSource } = require('./helpers/newtab-source');

// Real page dependencies, loaded the way newtab.html loads them before wallpaper.js.
require('../src/shared/settings.js');
require('../src/newtab/wallpaper-adaptive-tone.js');
require('../src/newtab/wallpaper-effects.js');
require('../src/newtab/wallpaper-local-store.js');
require('../src/newtab/remote-content.js');
const REAL_WALLPAPER_DEPENDENCIES = {
  LumnoSettings: globalThis.LumnoSettings,
  LumnoNewtabRemoteContent: globalThis.LumnoNewtabRemoteContent,
  LumnoNewtabWallpaperAdaptiveTone: globalThis.LumnoNewtabWallpaperAdaptiveTone,
  LumnoNewtabWallpaperEffects: globalThis.LumnoNewtabWallpaperEffects,
  LumnoNewtabWallpaperLocalStore: globalThis.LumnoNewtabWallpaperLocalStore
};

const WALLPAPER_STORAGE_KEY = '_x_extension_newtab_wallpaper_2026_unique_';
const LOCAL_WALLPAPER_STORAGE_KEY = '_x_extension_newtab_local_wallpaper_2026_unique_';
const ONLINE_WALLPAPER_STORAGE_KEY = '_x_extension_newtab_online_wallpaper_2026_unique_';
const LINK_WALLPAPERS_STORAGE_KEY = '_x_extension_newtab_link_wallpapers_2026_unique_';
const DAILY_WALLPAPER_PICKS_STORAGE_KEY = '_x_extension_newtab_daily_wallpaper_picks_2026_unique_';
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

function getEffectOption(control, type) {
  const host = getDescendantByAttribute(control, 'data-wallpaper-ref', 'effectSelectHost');
  return getDescendantByAttribute(host, 'data-value', type);
}

function createFakeWallpaperViewController(config) {
  const documentObj = config.documentObj;
  const model = config.model || {};
  const refs = Object.create(null);
  const create = (tagName, className, attributes) => {
    const element = documentObj.createElement(tagName);
    element.className = className || '';
    Object.entries(attributes || {}).forEach(([name, value]) => {
      element.setAttribute(name, value);
    });
    return element;
  };
  const add = (parent, tagName, className, attributes, refName) => {
    const element = create(tagName, className, attributes);
    parent.appendChild(element);
    if (refName) {
      refs[refName] = element;
      element.setAttribute('data-wallpaper-ref', refName);
    }
    return element;
  };
  const addSwitch = (parent, refName) => {
    const label = add(parent, 'label', 'x-nt-wallpaper-switch');
    return add(label, 'input', '', { role: 'switch', type: 'checkbox' }, refName);
  };
  const addSliderControl = (parent, names, className) => {
    const dynamicRange = Boolean(names.dynamicRange);
    const control = add(
      parent,
      'div',
      className || 'x-nt-effect-slider-control',
      { 'data-visible': 'true', 'aria-hidden': 'false' },
      names.control
    );
    const header = add(control, 'div', 'x-nt-overlay-control-header');
    add(header, 'span', 'x-nt-effect-slider-label', {}, names.label);
    const row = add(control, 'div', 'x-nt-range-slider-row');
    const wrap = add(row, 'div', 'x-nt-overlay-slider-wrap');
    const sliderAttributes = {
      type: 'range',
      min: '0',
      max: '100',
      step: dynamicRange ? 'any' : '1',
      value: '50'
    };
    if (dynamicRange) {
      sliderAttributes['data-wallpaper-dynamic-range'] = 'true';
    }
    const slider = add(
      wrap,
      'input',
      'x-nt-overlay-slider',
      sliderAttributes,
      names.slider
    );
    slider.type = 'range';
    const scale = add(wrap, 'div', 'x-nt-overlay-scale');
    [
      { align: 'start', label: '0' },
      { align: 'center', key: 'default', label: 'Default' },
      { align: 'end', label: '100%' }
    ].forEach((tick) => {
      const tickElement = add(scale, 'span', 'x-nt-overlay-tick', {
        'data-align': tick.align,
        ...(tick.key ? { 'data-overlay-tick': tick.key } : {})
      });
      tickElement.textContent = tick.label;
    });
    const valueInputAttributes = dynamicRange
      ? { type: 'number', step: 'any', value: '50' }
      : { type: 'number', min: '0', max: '100', step: '1', value: '50' };
    const valueInput = add(
      row,
      'input',
      '_x_extension_shortcut_input_2024_unique_ _x_extension_range_slider_value_input_2026_unique_',
      valueInputAttributes,
      `${names.slider}ValueInput`
    );
    valueInput.type = 'number';
    return control;
  };

  const control = create('div', 'x-nt-wallpaper-control', {
    'data-panel-open': 'false',
    'data-react-island': 'newtab-wallpaper'
  });
  const panel = add(
    control,
    'div',
    'x-nt-wallpaper-panel',
    { 'data-open': 'false', role: 'dialog' },
    'panel'
  );
  const appearanceHeader = add(panel, 'div', 'x-nt-appearance-header');
  add(
    appearanceHeader,
    'div',
    'x-nt-wallpaper-panel-title',
    {},
    'appearanceTitle'
  );
  const moreSettings = add(
    appearanceHeader,
    'a',
    'x-nt-appearance-more-settings',
    { href: model.moreSettingsUrl || '' },
    'moreSettingsLink'
  );
  add(
    moreSettings,
    'span',
    'x-nt-appearance-more-settings-text',
    {},
    'moreSettingsText'
  );
  const scroll = add(panel, 'div', 'x-nt-wallpaper-panel-scroll');
  const appearanceSection = add(scroll, 'div', 'x-nt-appearance-section');
  const themeSectionHeader = add(
    appearanceSection,
    'div',
    'x-nt-wallpaper-panel-header'
  );
  const appearanceTitleGroup = add(
    themeSectionHeader,
    'div',
    'x-nt-appearance-title-group'
  );
  add(
    appearanceTitleGroup,
    'div',
    'x-nt-wallpaper-panel-title',
    {},
    'themeSectionTitle'
  );
  add(
    appearanceTitleGroup,
    'button',
    'x-nt-appearance-info-button',
    { type: 'button' },
    'appearanceInfoButton'
  );
  const scopeTabs = add(
    themeSectionHeader,
    'div',
    'x-nt-segmented-tabs x-nt-wallpaper-tabs x-nt-appearance-scope-tabs',
    { role: 'group' },
    'appearanceScopeTabs'
  );
  add(
    scopeTabs,
    'span',
    'x-nt-segmented-tabs-indicator x-nt-wallpaper-tabs-indicator',
    {},
    'appearanceScopeTabsIndicator'
  );
  ['global', 'home'].forEach((scope) => {
    add(scopeTabs, 'button', 'x-nt-segmented-tab x-nt-wallpaper-tab x-nt-appearance-scope-tab', {
      type: 'button',
      'data-theme-scope': scope,
      'data-active': 'false'
    });
  });
  const appearanceOptions = add(
    appearanceSection,
    'div',
    'x-nt-appearance-options',
    {},
    'appearanceOptions'
  );
  (model.appearanceOptions || []).forEach((item) => {
    add(appearanceOptions, 'button', 'x-nt-appearance-option', {
      type: 'button',
      'data-theme-mode': item.mode,
      'data-selected': 'false'
    });
  });
  const widthControl = add(
    appearanceSection,
    'div',
    'x-nt-overlay-control x-nt-search-width-control',
    { 'data-visible': 'false', 'aria-hidden': 'true' },
    'searchWidthControl'
  );
  const widthHeader = add(widthControl, 'div', 'x-nt-overlay-control-header');
  add(widthHeader, 'span', 'x-nt-overlay-label', {}, 'searchWidthLabel');
  const widthRow = add(widthControl, 'div', 'x-nt-range-slider-row');
  const widthWrap = add(
    widthRow,
    'div',
    'x-nt-overlay-slider-wrap x-nt-search-width-slider-wrap'
  );
  const widthSlider = add(
    widthWrap,
    'input',
    'x-nt-overlay-slider x-nt-search-width-slider',
    {
      type: 'range',
      min: String(model.searchWidth && model.searchWidth.min || 0),
      max: String(model.searchWidth && model.searchWidth.max || 1200),
      step: '1'
    },
    'searchWidthSlider'
  );
  widthSlider.type = 'range';
  widthSlider.value = String(model.searchWidth && model.searchWidth.min || 0);
  const widthScale = add(widthWrap, 'div', 'x-nt-search-width-scale');
  (model.searchWidth && model.searchWidth.ticks || []).forEach((tick) => {
    add(widthScale, 'span', 'x-nt-search-width-tick', {
      'data-search-width-tick': tick.searchKey || ''
    });
  });
  const widthValueInput = add(
    widthRow,
    'input',
    '_x_extension_shortcut_input_2024_unique_ _x_extension_range_slider_value_input_2026_unique_',
    {
      type: 'number',
      min: widthSlider.min,
      max: widthSlider.max,
      step: widthSlider.step,
      value: widthSlider.value
    },
    'searchWidthSliderValueInput'
  );
  widthValueInput.type = 'number';
  const inputAutoFocusRow = add(
    widthControl,
    'div',
    'x-nt-appearance-setting-row'
  );
  const inputAutoFocusTitleGroup = add(
    inputAutoFocusRow,
    'span',
    'x-nt-appearance-setting-title-group'
  );
  add(
    inputAutoFocusTitleGroup,
    'span',
    'x-nt-appearance-setting-title',
    {},
    'inputAutoFocusTitle'
  );
  add(
    inputAutoFocusTitleGroup,
    'button',
    'x-nt-appearance-info-button',
    { type: 'button' },
    'inputAutoFocusInfoButton'
  );
  addSwitch(inputAutoFocusRow, 'inputAutoFocusToggle');
  const shortcutsAccordion = add(
    widthControl,
    'div',
    'x-nt-shortcuts-accordion',
    { 'data-expanded': 'false', 'data-enabled': 'true' },
    'shortcutsAccordion'
  );
  const shortcutsRow = add(
    shortcutsAccordion,
    'div',
    'x-nt-appearance-setting-row x-nt-shortcuts-accordion-row'
  );
  const shortcutsTrigger = add(
    shortcutsRow,
    'button',
    'x-nt-shortcuts-accordion-trigger',
    {
      'aria-controls': '_x_extension_newtab_shortcuts_settings_2026_unique_',
      'aria-expanded': 'false',
      id: '_x_extension_newtab_shortcuts_accordion_trigger_2026_unique_',
      type: 'button'
    },
    'shortcutsAccordionTrigger'
  );
  add(shortcutsTrigger, 'span', 'x-nt-appearance-setting-title', {}, 'shortcutsTitle');
  add(shortcutsTrigger, 'span', 'x-nt-shortcuts-accordion-icon');
  addSwitch(shortcutsRow, 'shortcutsToggle');
  const shortcutsDetails = add(
    shortcutsAccordion,
    'div',
    'x-nt-shortcuts-accordion-details',
    {
      'aria-hidden': 'true',
      'aria-labelledby': '_x_extension_newtab_shortcuts_accordion_trigger_2026_unique_',
      'data-visible': 'false',
      id: '_x_extension_newtab_shortcuts_settings_2026_unique_',
      role: 'region'
    },
    'shortcutsDetails'
  );
  shortcutsDetails.hidden = true;
  const shortcutsDetailsInner = add(
    shortcutsDetails,
    'div',
    'x-nt-shortcuts-accordion-details-inner'
  );
  const shortcutAddRow = add(shortcutsDetailsInner, 'div', 'x-nt-appearance-setting-row');
  add(shortcutAddRow, 'span', 'x-nt-appearance-setting-title', {}, 'shortcutAddTitle');
  addSwitch(shortcutAddRow, 'shortcutAddToggle');
  const shortcutDockRow = add(shortcutsDetailsInner, 'div', 'x-nt-appearance-setting-row');
  add(
    shortcutDockRow,
    'span',
    'x-nt-appearance-setting-title',
    {},
    'shortcutDockMagnificationTitle'
  );
  addSwitch(shortcutDockRow, 'shortcutDockMagnificationToggle');
  const shortcutColumnsControl = add(
    shortcutsDetailsInner,
    'div',
    'x-nt-overlay-control x-nt-shortcut-columns-control',
    { 'data-visible': 'false', 'aria-hidden': 'true' },
    'shortcutColumnsControl'
  );
  const shortcutColumnsHeader = add(
    shortcutColumnsControl,
    'div',
    'x-nt-overlay-control-header'
  );
  add(
    shortcutColumnsHeader,
    'span',
    'x-nt-overlay-label',
    {},
    'shortcutColumnsLabel'
  );
  const shortcutColumnsRow = add(
    shortcutColumnsControl,
    'div',
    'x-nt-range-slider-row'
  );
  const shortcutColumnsWrap = add(
    shortcutColumnsRow,
    'div',
    'x-nt-overlay-slider-wrap x-nt-shortcut-columns-slider-wrap'
  );
  const shortcutColumnsSlider = add(
    shortcutColumnsWrap,
    'input',
    'x-nt-overlay-slider x-nt-shortcut-columns-slider',
    {
      type: 'range',
      min: String(model.shortcutColumns && model.shortcutColumns.min || 4),
      max: String(model.shortcutColumns && model.shortcutColumns.max || 16),
      step: '1'
    },
    'shortcutColumnsSlider'
  );
  shortcutColumnsSlider.type = 'range';
  shortcutColumnsSlider.value = String(
    model.shortcutColumns && model.shortcutColumns.defaultValue || 10
  );
  const shortcutColumnsScale = add(
    shortcutColumnsWrap,
    'div',
    'x-nt-overlay-scale x-nt-shortcut-columns-scale'
  );
  [4, 8, 12, 16].forEach((value, index) => {
    add(shortcutColumnsScale, 'span', 'x-nt-overlay-tick', {
      'data-align': index === 0 ? 'start' : (index === 3 ? 'end' : 'center')
    }).textContent = String(value);
  });
  const shortcutColumnsSliderValueInput = add(
    shortcutColumnsRow,
    'input',
    '_x_extension_shortcut_input_2024_unique_ _x_extension_range_slider_value_input_2026_unique_',
    {
      type: 'number',
      min: String(model.shortcutColumns && model.shortcutColumns.min || 4),
      max: String(model.shortcutColumns && model.shortcutColumns.max || 16),
      step: '1'
    },
    'shortcutColumnsSliderValueInput'
  );
  shortcutColumnsSliderValueInput.type = 'number';
  shortcutColumnsSliderValueInput.value = shortcutColumnsSlider.value;

  const wallpaperSection = add(scroll, 'div', 'x-nt-wallpaper-section');
  const panelHeader = add(
    wallpaperSection,
    'div',
    'x-nt-wallpaper-panel-header',
    {},
    'panelHeader'
  );
  const wallpaperAccordionTrigger = add(panelHeader, 'button', 'x-nt-wallpaper-accordion-trigger', {}, 'wallpaperAccordionTrigger');
  add(wallpaperAccordionTrigger, 'span', 'x-nt-wallpaper-panel-title', {}, 'panelTitle');
  addSwitch(panelHeader, 'enabledToggle');
  add(
    wallpaperSection,
    'input',
    'x-nt-wallpaper-file-input',
    { type: 'file' },
    'customInput'
  );
  const body = add(
    wallpaperSection,
    'div',
    'x-nt-wallpaper-body',
    { 'data-visible': 'true', 'data-active-tab': model.activeTab || 'built-in' },
    'body'
  );
  const modeSync = add(body, 'div', 'x-nt-wallpaper-mode-sync');
  add(modeSync, 'span', 'x-nt-wallpaper-mode-sync-title', {}, 'modeSyncTitle');
  addSwitch(modeSync, 'modeSyncToggle');
  const modeRow = add(body, 'div', 'x-nt-appearance-setting-row x-nt-wallpaper-mode-row',
    { 'data-visible': 'false' }, 'modeRow');
  add(modeRow, 'span', 'x-nt-appearance-setting-title', {}, 'modeLabel');
  const modeTabs = add(
    modeRow,
    'div',
    'x-nt-segmented-tabs x-nt-wallpaper-tabs x-nt-wallpaper-mode-tabs',
    {},
    'modeTabs'
  );
  add(
    modeTabs,
    'span',
    'x-nt-segmented-tabs-indicator x-nt-wallpaper-tabs-indicator',
    {},
    'modeTabsIndicator'
  );
  add(
    modeTabs,
    'button',
    'x-nt-segmented-tab x-nt-wallpaper-tab x-nt-wallpaper-mode-tab',
    { 'data-wallpaper-mode': 'light', 'data-active': 'false' },
    'lightModeTab'
  );
  add(
    modeTabs,
    'button',
    'x-nt-segmented-tab x-nt-wallpaper-tab x-nt-wallpaper-mode-tab',
    { 'data-wallpaper-mode': 'dark', 'data-active': 'false' },
    'darkModeTab'
  );
  const tabs = add(body, 'div', 'x-nt-segmented-tabs x-nt-wallpaper-tabs', {}, 'tabs');
  add(
    tabs,
    'span',
    'x-nt-segmented-tabs-indicator x-nt-wallpaper-tabs-indicator',
    {},
    'tabsIndicator'
  );
  add(
    tabs,
    'button',
    'x-nt-segmented-tab x-nt-wallpaper-tab',
    { 'data-wallpaper-tab': 'built-in', 'data-active': 'false' },
    'builtInTab'
  );
  add(
    tabs,
    'button',
    'x-nt-segmented-tab x-nt-wallpaper-tab',
    { 'data-wallpaper-tab': 'local', 'data-active': 'false' },
    'localTab'
  );
  add(tabs, 'button', 'x-nt-segmented-tab x-nt-wallpaper-tab',
    { 'data-wallpaper-tab': 'bing', 'data-active': 'false' }, 'bingTab');
  add(tabs, 'button', 'x-nt-segmented-tab x-nt-wallpaper-tab',
    { 'data-wallpaper-tab': 'curated', 'data-active': 'false' }, 'curatedTab');
  const builtInGrid = add(
    body,
    'div',
    'x-nt-wallpaper-grid x-nt-wallpaper-grid--built-in',
    { 'data-wallpaper-panel': 'built-in' },
    'builtInGrid'
  );
  (model.wallpapers || []).forEach((item) => {
    add(builtInGrid, 'button', 'x-nt-wallpaper-tile', {
      'data-wallpaper-id': item.id,
      'data-wallpaper-path': item.path || '',
      'data-selected': 'false'
    });
  });
  const localGrid = add(
    body,
    'div',
    'x-nt-wallpaper-grid x-nt-wallpaper-grid--local',
    { 'data-wallpaper-panel': 'local' },
    'localGrid'
  );
  add(
    localGrid,
    'div',
    'x-nt-wallpaper-tile x-nt-wallpaper-upload-tile',
    { 'data-upload': 'true', 'data-loading': 'false', 'data-selected': 'false' },
    'uploadTile'
  );
  add(localGrid, 'div', 'x-nt-wallpaper-tile x-nt-wallpaper-upload-tile x-nt-wallpaper-url-tile',
    { 'data-selected': 'false' }, 'urlTile');
  const customItemsHost = add(
    localGrid,
    'span',
    '',
    { 'data-wallpaper-custom-items': '' },
    'customItemsHost'
  );
  const urlForm = add(body, 'form', 'x-nt-wallpaper-url-form', {}, 'urlForm');
  urlForm.hidden = true;
  add(urlForm, 'input', 'x-nt-wallpaper-url-input', { type: 'url' }, 'urlInput');
  add(urlForm, 'button', 'x-nt-wallpaper-url-submit', { type: 'submit' }, 'urlSubmit');
  const bingPanel = add(body, 'div', 'x-nt-bing-panel', { 'data-wallpaper-panel': 'bing' }, 'bingPanel');
  for (const name of ['bingDailyLabel', 'bingRecentLabel', 'bingStatus', 'bingSelectedTitle', 'bingSelectedMeta']) {
    add(bingPanel, 'span', '', {}, name);
  }
  addSwitch(bingPanel, 'bingDailyToggle');
  add(bingPanel, 'button', '', {}, 'bingDailyRestore').hidden = true;
  add(bingPanel, 'button', '', {}, 'bingRefresh');
  add(bingPanel, 'div', '', {}, 'bingSelectedSource');
  add(bingPanel, 'a', '', {}, 'bingSelectedLink');
  add(bingPanel, 'button', '', {}, 'bingDailyInfoButton');
  const bingItemsHost = add(bingPanel, 'div', 'x-nt-wallpaper-grid x-nt-wallpaper-grid--bing', {}, 'bingItemsHost');
  const curatedPanel = add(body, 'div', 'x-nt-curated-panel', { 'data-wallpaper-panel': 'curated' }, 'curatedPanel');
  for (const name of ['curatedDailyLabel', 'curatedCategoryLabel', 'curatedListLabel', 'curatedSelectedTitle',
    'curatedSelectedMeta']) {
    add(curatedPanel, 'span', '', {}, name);
  }
  addSwitch(curatedPanel, 'curatedDailyToggle');
  add(curatedPanel, 'button', '', {}, 'curatedDailyRestore').hidden = true;
  add(curatedPanel, 'button', '', {}, 'curatedDailyInfoButton');
  const curatedCategoryTabs = add(curatedPanel, 'div', 'x-nt-segmented-tabs', {}, 'curatedCategoryTabs');
  add(curatedCategoryTabs, 'span', 'x-nt-segmented-tabs-indicator', {}, 'curatedCategoryIndicator');
  (model.curatedCategories || []).forEach((item) => {
    add(curatedCategoryTabs, 'button', 'x-nt-segmented-tab',
      { 'data-curated-category': item.value, 'data-active': 'false' });
  });
  add(curatedPanel, 'button', '', {}, 'curatedRefresh');
  add(curatedPanel, 'div', '', {}, 'curatedSelectedSource');
  add(curatedPanel, 'a', '', {}, 'curatedSelectedLink');
  const curatedItemsHost = add(curatedPanel, 'div', 'x-nt-wallpaper-grid x-nt-wallpaper-grid--curated', {},
    'curatedItemsHost');
  const effectControl = add(body, 'div', 'x-nt-effect-control');
  addSliderControl(
    effectControl,
    { control: 'overlayControl', label: 'overlayLabel', slider: 'overlaySlider' },
    'x-nt-overlay-control x-nt-overlay-control--effect'
  );
  const effectHeader = add(
    effectControl,
    'div',
    'x-nt-appearance-setting-row x-nt-effect-control-header'
  );
  add(effectHeader, 'span', 'x-nt-appearance-setting-title x-nt-effect-label', {}, 'effectLabel');
  const effectSelectHost = add(effectHeader, 'div', 'x-nt-row-select', {}, 'effectSelectHost');
  const effectInkToneControl = add(
    effectControl,
    'div',
    'x-nt-effect-slider-control x-nt-effect-ink-tone-control',
    { 'data-visible': 'false', 'aria-hidden': 'true' },
    'effectInkToneControl'
  );
  const effectInkToneOptions = add(
    effectInkToneControl,
    'div',
    'x-nt-segmented-tabs x-nt-effect-options x-nt-effect-ink-tone-options',
    {},
    'effectInkToneOptions'
  );
  add(
    effectInkToneOptions,
    'span',
    'x-nt-segmented-tabs-indicator x-nt-effect-indicator',
    {},
    'effectInkToneIndicator'
  );
  (model.effectInkTones || []).forEach((item) => {
    add(effectInkToneOptions, 'button', 'x-nt-segmented-tab x-nt-effect-option x-nt-effect-ink-tone-option', {
      'data-wallpaper-effect-ink-tone': item.tone,
      'data-active': 'false',
      'aria-pressed': 'false'
    });
  });
  addSliderControl(effectControl, {
    control: 'effectStrengthControl',
    label: 'effectStrengthLabel',
    slider: 'effectStrengthSlider'
  });
  addSliderControl(effectControl, {
    control: 'effectSizeControl',
    label: 'effectSizeLabel',
    slider: 'effectSizeSlider'
  });
  addSliderControl(effectControl, {
    control: 'effectSpacingControl',
    label: 'effectSpacingLabel',
    slider: 'effectSpacingSlider'
  });
  addSliderControl(effectControl, {
    control: 'effectTextureControl',
    label: 'effectTextureLabel',
    slider: 'effectTextureSlider'
  });
  addSliderControl(effectControl, {
    control: 'effectCrtBloomControl',
    label: 'effectCrtBloomLabel',
    slider: 'effectCrtBloomSlider'
  });
  addSliderControl(effectControl, {
    control: 'effectCrtRgbOffsetControl',
    label: 'effectCrtRgbOffsetLabel',
    slider: 'effectCrtRgbOffsetSlider'
  });
  addSliderControl(effectControl, {
    control: 'effectCrtCurvatureControl',
    label: 'effectCrtCurvatureLabel',
    slider: 'effectCrtCurvatureSlider'
  });

  const brandSection = add(scroll, 'div', 'x-nt-wallpaper-section');
  const topContentHeader = add(brandSection, 'div', 'x-nt-wallpaper-panel-header x-nt-top-content-header');
  add(topContentHeader, 'div', 'x-nt-wallpaper-panel-title', {}, 'topContentTitle');
  const topContentTabs = add(
    topContentHeader,
    'div',
    'x-nt-segmented-tabs x-nt-wallpaper-tabs x-nt-top-content-tabs',
    {},
    'topContentTabs'
  );
  add(
    topContentTabs,
    'span',
    'x-nt-segmented-tabs-indicator x-nt-wallpaper-tabs-indicator',
    {},
    'topContentTabsIndicator'
  );
  (model.topContentOptions || []).forEach((item) => {
    add(
      topContentTabs,
      'button',
      'x-nt-segmented-tab x-nt-wallpaper-tab x-nt-top-content-tab',
      {
        'data-newtab-top-content': item.value,
        'data-active': item.value === 'brand' ? 'true' : 'false'
      },
      item.value === 'brand'
        ? 'topContentBrandTab'
        : item.value === 'time'
          ? 'topContentTimeTab'
          : 'topContentOffTab'
    );
  });
  const topContentWeightControl = add(
    brandSection,
    'div',
    'x-nt-time-weight-control',
    { 'data-visible': 'false', 'aria-hidden': 'true', hidden: '' },
    'topContentWeightControl'
  );
  const topContentWeightHeader = add(
    topContentWeightControl,
    'div',
    'x-nt-overlay-control-header'
  );
  add(
    topContentWeightHeader,
    'span',
    '',
    {},
    'topContentWeightTitle'
  );
  const topContentWeightRow = add(
    topContentWeightControl,
    'div',
    'x-nt-range-slider-row'
  );
  const topContentWeightWrap = add(
    topContentWeightRow,
    'div',
    'x-nt-overlay-slider-wrap x-nt-time-weight-slider-wrap'
  );
  const topContentWeightSlider = add(
    topContentWeightWrap,
    'input',
    'x-nt-overlay-slider x-nt-time-weight-slider',
    { type: 'range', min: '300', max: '800', step: '1', value: '320' },
    'topContentWeightSlider'
  );
  topContentWeightSlider.type = 'range';
  const topContentWeightSliderValueInput = add(
    topContentWeightRow,
    'input',
    '_x_extension_shortcut_input_2024_unique_ _x_extension_range_slider_value_input_2026_unique_',
    { type: 'number', min: '300', max: '800', step: '1', value: '320' },
    'topContentWeightSliderValueInput'
  );
  topContentWeightSliderValueInput.type = 'number';
  const topContentSecondsRow = add(
    brandSection,
    'div',
    'x-nt-top-content-seconds-row',
    { 'data-visible': 'false', 'aria-hidden': 'true', hidden: '' },
    'topContentSecondsRow'
  );
  add(
    topContentSecondsRow,
    'span',
    'x-nt-top-content-seconds-title',
    {},
    'topContentSecondsTitle'
  );
  const topContentSecondsSwitch = add(
    topContentSecondsRow,
    'label',
    'x-nt-wallpaper-switch'
  );
  add(
    topContentSecondsSwitch,
    'input',
    '',
    { type: 'checkbox', role: 'switch' },
    'topContentSecondsToggle'
  );
  add(topContentSecondsSwitch, 'span', 'x-nt-wallpaper-switch-slider');
  const faviconGroup = add(brandSection, 'div', 'x-nt-favicon-group');
  add(
    faviconGroup,
    'div',
    'x-nt-wallpaper-panel-title x-nt-favicon-title',
    {},
    'faviconTitle'
  );
  const faviconOptions = add(
    faviconGroup,
    'div',
    'x-nt-favicon-options',
    {},
    'faviconOptions'
  );
  (model.favicons || []).forEach((item) => {
    const tile = add(faviconOptions, 'button', 'x-nt-wallpaper-tile x-nt-favicon-option', {
      'data-newtab-favicon-id': item.id,
      'data-selected': 'false'
    });
    const thumb = add(tile, 'span', 'x-nt-wallpaper-thumb x-nt-favicon-thumb');
    if (item.inlineSvg) {
      const preview = add(
        thumb,
        'span',
        'x-nt-favicon-image x-nt-favicon-svg-preview'
      );
      preview.innerHTML = item.inlineSvg;
    } else {
      add(thumb, 'img', 'x-nt-favicon-image', { src: item.previewUrl || '' });
    }
  });
  const button = add(
    control,
    'button',
    'x-nt-wallpaper-button',
    { 'data-open': 'false', 'aria-expanded': 'false' },
    'button'
  );

  const effectSelectRows = new Map();
  let effectSelectOpen = false;
  const effectSelectTrigger = add(effectSelectHost, 'button', '_x_extension_select_trigger_2024_unique_');
  effectSelectTrigger.addEventListener('click', () => {
    effectSelectOpen = !effectSelectOpen;
  });

  return {
    control,
    panel,
    button,
    getRefs() {
      return refs;
    },
    closeOpenSelect() {
      const wasOpen = effectSelectOpen;
      effectSelectOpen = false;
      return wasOpen;
    },
    containsSelectMenuTarget(target) {
      return Array.from(effectSelectRows.values()).includes(target);
    },
    renderEffectSelect(select) {
      effectSelectTrigger.setAttribute('aria-label', select.ariaLabel);
      select.options.forEach((option) => {
        let row = effectSelectRows.get(option.value);
        if (!row) {
          row = add(effectSelectHost, 'div', '_x_extension_select_option_2024_unique_', {
            'data-value': option.value
          });
          effectSelectRows.set(option.value, row);
        }
        row.textContent = option.label;
        row.setAttribute('data-selected', option.value === select.value ? 'true' : 'false');
        row._listeners.click = [() => {
          effectSelectOpen = false;
          select.onChange(option.value);
        }];
      });
    },
    renderOnlineWallpapers(items) {
      bingItemsHost.children.length = 0;
      return items.map((item) => add(bingItemsHost, 'button', 'x-nt-wallpaper-tile',
        { 'data-wallpaper-id': item.id, 'data-selected': 'false' }));
    },
    renderCuratedWallpapers(items) {
      curatedItemsHost.children.length = 0;
      return items.map((item) => add(curatedItemsHost, 'button', 'x-nt-wallpaper-tile',
        { 'data-wallpaper-id': item.id, 'data-selected': 'false', 'data-thumbnail-url': item.thumbnailUrl }));
    },
    renderCustomWallpapers(items) {
      customItemsHost.children.length = 0;
      return (Array.isArray(items) ? items : []).map((item) => {
        const tile = add(
          customItemsHost,
          'div',
          'x-nt-wallpaper-tile x-nt-wallpaper-custom-tile',
          {
            'data-wallpaper-id': item.id,
            'data-custom-wallpaper': 'true',
            'data-selected': 'false'
          }
        );
        add(tile, 'button', 'x-nt-wallpaper-delete-button');
        return tile;
      });
    },
    destroy() {}
  };
}

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

function getChildByClassName(element, className) {
  return (element.children || []).find((child) => {
    const classes = String(child.className || '').split(/\s+/);
    return classes.includes(className);
  });
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

function getDescendantByTagName(element, tagName) {
  const needle = String(tagName || '').toUpperCase();
  let match = null;
  (function visit(node) {
    if (!node || match) {
      return;
    }
    (node.children || []).forEach((child) => {
      if (match) {
        return;
      }
      if (child.tagName === needle) {
        match = child;
        return;
      }
      visit(child);
    });
  })(element);
  return match;
}

function getDescendantByAttribute(element, name, value) {
  let match = null;
  (function visit(node) {
    if (!node || match) {
      return;
    }
    (node.children || []).forEach((child) => {
      if (match) {
        return;
      }
      if (child.getAttribute && child.getAttribute(name) === value) {
        match = child;
        return;
      }
      visit(child);
    });
  })(element);
  return match;
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
  const source = readPageSource(filePath);
  const optionsRule = source.match(/\.x-nt-favicon-options\s*\{[\s\S]*?\}/);
  assert.ok(optionsRule, `${filePath} should define favicon options layout`);
  assert.match(optionsRule[0], /display:\s*flex;/, `${filePath} favicon options should not stretch as a grid`);
  assert.match(optionsRule[0], /justify-content:\s*flex-start;/, `${filePath} favicon options should align left`);
  assert.match(optionsRule[0], /gap:\s*var\(--x-nt-panel-grid-gap\);/, `${filePath} favicon options should use wallpaper grid gap`);
  assert.doesNotMatch(optionsRule[0], /grid-template-columns/, `${filePath} favicon options should not use equal-width columns`);

  const titleRule = source.match(/\.x-nt-favicon-title\s*\{[\s\S]*?\}/);
  if (titleRule) {
    assert.doesNotMatch(titleRule[0], /font-size:\s*13px;/, `${filePath} favicon title should match panel title size`);
    assert.doesNotMatch(titleRule[0], /font-weight:\s*500;/, `${filePath} favicon title should match panel title weight`);
  }

  const optionRule = source.match(/\.x-nt-favicon-option\s*\{[\s\S]*?\}/);
  assert.ok(optionRule, `${filePath} should define wallpaper-sized favicon option size`);
  assert.match(
    optionRule[0],
    /width:\s*calc\(\(100% - \(var\(--x-nt-panel-grid-gap\) \* 3\)\) \/ 4\);/,
    `${filePath} favicon option should use a quarter-width column`
  );
  assert.match(
    optionRule[0],
    /flex:\s*0\s+0\s+calc\(\(100% - \(var\(--x-nt-panel-grid-gap\) \* 3\)\) \/ 4\);/,
    `${filePath} favicon option flex basis should use a quarter-width column`
  );

  const thumbRule = source.match(/\.x-nt-favicon-thumb\s*\{[\s\S]*?\}/);
  assert.ok(thumbRule, `${filePath} should define favicon thumb size`);
  assert.match(thumbRule[0], /width:\s*100%;/, `${filePath} favicon thumb should fill the wallpaper-width option`);
  assert.match(thumbRule[0], /aspect-ratio:\s*1\s*\/\s*1;/, `${filePath} favicon thumb should use a square rounded rectangle`);
  assert.match(thumbRule[0], /border:\s*none;/, `${filePath} favicon thumb should not add its own border`);
  assert.doesNotMatch(thumbRule[0], /height:\s*44px;/, `${filePath} favicon thumb should not keep the compact fixed height`);

  const selectedRule = source.match(/\.x-nt-favicon-option\[data-selected="true"\]\s+\.x-nt-favicon-thumb::after\s*\{[\s\S]*?\}/);
  assert.ok(selectedRule, `${filePath} should define selected favicon outline alignment`);
  assert.match(selectedRule[0], /inset:\s*0;/, `${filePath} selected favicon outline should not have inner spacing`);
  assert.match(selectedRule[0], /border-radius:\s*inherit;/, `${filePath} selected favicon outline should inherit thumb radius`);
}

function assertSegmentedTabRadiusCss(filePath) {
  const source = readPageSource(filePath);
  const tokensRule = source.match(/\.x-nt-segmented-tabs\s*\{[\s\S]*?\n\s*\}/);
  assert.ok(tokensRule, `${filePath} should define shared segmented-tab radius tokens`);
  assert.match(tokensRule[0], /--x-nt-segmented-tabs-radius:\s*10px;/);
  assert.match(tokensRule[0], /--x-nt-segmented-tabs-border-width:\s*1px;/);
  assert.match(tokensRule[0], /--x-nt-segmented-tabs-inset:\s*2px;/);
  assert.match(
    tokensRule[0],
    /--x-nt-segmented-tabs-inner-radius:\s*calc\([\s\S]*?radius\)[\s\S]*?border-width\)[\s\S]*?inset\)/,
    `${filePath} should derive the inner radius from the full visual inset`
  );
  assert.match(
    source,
    /\.x-nt-segmented-tabs-indicator,\s*\n\s*\.x-nt-segmented-tab\s*\{\s*border-radius:\s*var\(--x-nt-segmented-tabs-inner-radius\);/,
    `${filePath} should apply one inner radius to indicators and buttons`
  );
}

function assertEffectSelectCss(filePath) {
  const source = readPageSource(filePath);
  assert.match(
    source,
    /\.x-nt-row-select\s*\{[\s\S]*?flex:\s*0 0 var\(--x-nt-row-control-width\);/,
    `${filePath} should size the filter dropdown like the other row controls`
  );
  assert.match(
    source,
    /\.x-nt-row-select \._x_extension_select_trigger_2024_unique_\s*\{[\s\S]*?height:\s*30px;/,
    `${filePath} should match the filter trigger height to the slider value inputs`
  );
  assert.doesNotMatch(
    source,
    /\.x-nt-effect-options:not\(\.x-nt-effect-ink-tone-options\)|\.x-nt-effect-select-menu/,
    `${filePath} should use the shared select menu as-is instead of restyling it`
  );
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
    assert.strictEqual(messages.newtab_time_font_weight_title.message, expected[locale].weight);
    assert.strictEqual(messages.newtab_time_show_seconds_title.message, expected[locale].seconds);
  });

  const wallpaperSource = fs.readFileSync('src/newtab/wallpaper.js', 'utf8');
  assert.match(
    wallpaperSource,
    /t\('settings_newtab_wordmark_title', 'Content above the search bar'\)/
  );
  assert.match(wallpaperSource, /data-newtab-top-content/);
  assert.match(wallpaperSource, /newtab_time_font_weight_title/);
  assert.match(wallpaperSource, /newtab_time_show_seconds_title/);
  assert.doesNotMatch(
    wallpaperSource,
    /\$\{label\} value/,
    'slider value boxes should reuse the localized slider name without an English suffix'
  );
  const optionsHtml = readPageSource('src/options/options.html');
  assert.match(optionsHtml, /data-newtab-top-content="brand"/);
  assert.match(optionsHtml, /data-newtab-top-content="time"/);
  assert.match(optionsHtml, /data-newtab-top-content="off"/);
  assert.match(optionsHtml, /_x_extension_newtab_time_font_weight_row_2026_unique_/);
  assert.match(optionsHtml, /_x_extension_newtab_time_seconds_row_2026_unique_/);
  assert.match(optionsHtml, /_x_extension_newtab_time_seconds_toggle_2026_unique_/);
}

function assertThemeAwareAlternateFaviconAsset() {
  const wallpaperSource = fs.readFileSync('src/newtab/wallpaper.js', 'utf8');
  const wallpaperViewReact = fs.readFileSync(
    'react-src/newtab/wallpaper-view.tsx',
    'utf8'
  );
  assert.match(
    wallpaperSource,
    /id:\s*'alternate'[\s\S]*?file:\s*'assets\/images\/lumno-newtab-favicon\.svg'/,
    'alternate favicon option should use the theme-aware SVG asset'
  );
  assert.match(
    wallpaperSource,
    /id:\s*'alternate'[\s\S]*?type:\s*'image\/svg\+xml'/,
    'alternate favicon should declare the SVG mime type'
  );
  assert.match(
    wallpaperViewReact,
    /item\.inlineSvg[\s\S]*?dangerouslySetInnerHTML=\{\{ __html: item\.inlineSvg \}\}/,
    'the React favicon picker should render alternate SVG previews inline so they can follow UI theme'
  );

  const svg = fs.readFileSync('assets/images/lumno-newtab-favicon.svg', 'utf8');
  assert.match(svg, /prefers-color-scheme:\s*dark/, 'alternate favicon SVG should adapt to dark Chrome themes');
  assert.match(svg, /color:\s*#000000;/i, 'alternate favicon light theme should use the supplied SVG base color');
  assert.match(svg, /--x-nt-favicon-main-opacity:\s*0\.5/i, 'alternate favicon should preserve the supplied SVG light opacity');
  assert.match(svg, /--x-nt-favicon-main-opacity:\s*0\.72/i, 'alternate favicon dark theme should brighten the main mark');
  assert.match(svg, /M14\.1832/, 'alternate favicon should use the supplied lumno1.svg shadow shape');
  assert.match(svg, /M34\.0761/, 'alternate favicon should use the supplied lumno1.svg main shape');
  assert.doesNotMatch(svg, /M15\.204/, 'alternate favicon should not keep the previous two-path source shape');
  assert.match(wallpaperSource, /M14\.1832/, 'favicon picker preview should use the supplied lumno1.svg shadow shape');
  assert.match(wallpaperSource, /M34\.0761/, 'favicon picker preview should use the supplied lumno1.svg main shape');
  assert.doesNotMatch(wallpaperSource, /M15\.204/, 'favicon picker preview should not keep the previous two-path source shape');
  assert.doesNotMatch(svg, /M41\.4736/, 'alternate favicon should not keep the older decorative source path');
  assert.match(svg, /currentColor/, 'alternate favicon SVG should be tintable from its root color');
  assert.doesNotMatch(svg, /fill="black"/i, 'alternate favicon should not keep fixed black fills');
  assert.doesNotMatch(svg, /url\(#paint/i, 'alternate favicon should not depend on fixed gradient paints');

  ['newtab.html'].forEach((filePath) => {
    const html = readPageSource(filePath);
    assert.match(
      html,
      /body\[data-theme="dark"\]\s+\.x-nt-favicon-svg-preview\s*\{[\s\S]*?color:\s*#f1f3f4;[\s\S]*?--x-nt-favicon-main-opacity:\s*0\.72;/,
      `${filePath} should tint the SVG picker preview from the actual UI dark theme`
    );
  });
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

  vm.runInNewContext(fs.readFileSync('src/newtab/wallpaper-preload.js', 'utf8'), sandbox, {
    filename: 'src/newtab/wallpaper-preload.js'
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

  ['newtab.html'].forEach((filePath) => {
    const html = readPageSource(filePath);
    const staticFaviconIndex = html.indexOf('data-lumno-newtab-favicon="true"');
    const firstStylesheetIndex = html.indexOf('<link rel="stylesheet"');
    assert.ok(staticFaviconIndex !== -1, `${filePath} should include a static monochrome favicon link`);
    assert.ok(
      staticFaviconIndex < html.indexOf('<title>'),
      `${filePath} should expose the monochrome favicon before the title can use the extension default icon`
    );
    assert.ok(
      staticFaviconIndex < html.indexOf('<script src="wallpaper-preload.js"></script>'),
      `${filePath} should expose the monochrome favicon before the external preload script runs`
    );
    if (firstStylesheetIndex !== -1) {
      assert.ok(
        html.indexOf('<script src="wallpaper-preload.js"></script>') < firstStylesheetIndex,
        `${filePath} should run wallpaper-preload before stylesheets so favicon is set early`
      );
    }
  });

  const fallbackHtml = fs.readFileSync('src/newtab/lumno-newtab.html', 'utf8');
  const fallbackRedirectJs = fs.readFileSync('src/newtab/lumno-newtab.js', 'utf8');
  assert.match(
    fallbackHtml,
    /<script src="lumno-newtab\.js"><\/script>/,
    'lumno-newtab fallback should load the redirect through an external script allowed by extension CSP'
  );
  assert.doesNotMatch(
    fallbackHtml,
    /wallpaper-preload\.js/,
    'lumno-newtab fallback should not paint a wallpaper before redirecting to the primary page'
  );
  assert.doesNotMatch(
    fallbackHtml,
    /<script\b(?![^>]*\bsrc=)[^>]*>[\s\S]*?<\/script>/,
    'lumno-newtab fallback should not use inline scripts because extension pages disallow them by CSP'
  );
  assert.match(
    fallbackRedirectJs,
    /new URL\('\.\.\/\.\.\/newtab\.html', window\.location\.href\)/,
    'lumno-newtab fallback should redirect into the maintained primary newtab document'
  );
  assert.doesNotMatch(
    fallbackHtml,
    /<script src="newtab\.js"><\/script>/,
    'lumno-newtab fallback should not duplicate the primary newtab runtime dependency list'
  );
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
    vm.runInNewContext(fs.readFileSync('src/newtab/wallpaper-preload.js', 'utf8'), preloadSandbox, {
      filename: 'src/newtab/wallpaper-preload.js'
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
  const preloadedEffectPrefs = await preloadSandbox.LumnoNewtabWallpaperPreload.effectPrefsReady;
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

function assertWallpaperBootstrapWaitsForTheme() {
  const newtabSource = readNewtabRuntimeSource();
  assert.match(
    newtabSource,
    /function bootstrapInitialWallpaper\(\)\s*\{[\s\S]*?return bootstrapInitialThemeMode\(\)\.then\(\(\) => wallpaperRuntime\.bootstrapInitialWallpaper\(\)\);[\s\S]*?\}/,
    'initial wallpaper resolution should wait until the page theme has been resolved'
  );
}

function assertInitialWallpaperToneStartsBeforeDeferredRefresh() {
  const wallpaperSource = fs.readFileSync('src/newtab/wallpaper.js', 'utf8');
  assert.match(
    wallpaperSource,
    /if \(isInitialWallpaperApply\) \{\s*applyWallpaperVisualState\(wallpaper\);\s*refreshWallpaperAdaptiveSampler\(\);\s*scheduleWallpaperVisualRefresh\(visualSeq\);\s*finalizeInitialWallpaper\(\);/,
    'initial wallpaper tone sampling should start before the deferred visual refresh can repaint the top bar'
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
    LumnoNewtabWallpaperView: {
      createController: createFakeWallpaperViewController
    }
  };
  testSandbox.globalThis = testSandbox;
  vm.runInNewContext(fs.readFileSync('src/newtab/wallpaper.js', 'utf8'), testSandbox, {
    filename: 'src/newtab/wallpaper.js'
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
  LumnoNewtabWallpaperView: {
    createController: createFakeWallpaperViewController
  }
};
sandbox.globalThis = sandbox;

vm.runInNewContext(fs.readFileSync('src/newtab/wallpaper.js', 'utf8'), sandbox, {
  filename: 'src/newtab/wallpaper.js'
});

let inputAutoFocusEnabled = false;
const inputAutoFocusWrites = [];
const inputAutoFocusTooltips = [];
let shortcutsVisible = true;
let shortcutAddVisible = true;
let shortcutDockMagnificationEnabled = true;
let shortcutColumns = 10;
const shortcutPreferenceWrites = [];
const runtime = sandbox.LumnoNewtabWallpaper.createWallpaperRuntime({
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
  setShortcutColumns(value) {
    shortcutColumns = Number(value);
    shortcutPreferenceWrites.push(['columns', shortcutColumns]);
  },
  showTopActionTooltip(anchor, text) {
    inputAutoFocusTooltips.push({ anchor, text });
  },
  t: (_key, fallback) => fallback || '',
  getRiSvg: () => ''
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
  const tile = getDescendantByAttribute(control, 'data-wallpaper-id', item.id);
  assert.ok(tile, `${item.id} should render as a built-in wallpaper`);
  assert.strictEqual(
    tile.getAttribute('data-wallpaper-path'),
    item.path,
    `${item.id} should point to its full-size wallpaper asset`
  );
});
const panel = control.children[0];
const slider = documentObj.createElement('input');
slider.type = 'range';
panel.appendChild(slider);
documentObj.activeElement = slider;

runtime.closePanel();

assert.strictEqual(slider._blurred, true, 'closing the appearance panel should blur an active slider inside it');
assert.strictEqual(documentObj.activeElement, null, 'closing the appearance panel should clear activeElement for panel sliders');

const appearanceButton = control.children[1];
appearanceButton.click();
const renderedPanel = control.children[0];
const rangeSliderRows = renderedPanel.querySelectorAll('.x-nt-range-slider-row');
assert.strictEqual(rangeSliderRows.length, 11, 'every New Tab slider should include an editable numeric value');
rangeSliderRows.forEach((row) => {
  const rowSlider = row.querySelector('input[type="range"]');
  const rowValueInput = row.querySelector('input[type="number"]');
  assert.ok(rowSlider, 'each shared slider row should contain a range input');
  assert.ok(rowValueInput, 'each shared slider row should contain a number input');
  if (rowSlider.getAttribute('data-wallpaper-dynamic-range') === 'true') {
    assert.strictEqual(rowValueInput.getAttribute('min'), null);
    assert.strictEqual(rowValueInput.getAttribute('max'), null);
  } else {
    assert.strictEqual(
      rowValueInput.max,
      rowSlider.max,
      'bounded numeric values should inherit the maximum from their slider'
    );
  }
});
const appearanceHeader = getChildByClassName(renderedPanel, 'x-nt-appearance-header');
const appearanceScrollBody = getChildByClassName(renderedPanel, 'x-nt-wallpaper-panel-scroll');
const appearanceSection = getChildByClassName(appearanceScrollBody, 'x-nt-appearance-section');
const searchWidthControl = getChildByClassName(appearanceSection, 'x-nt-search-width-control');
const searchWidthSlider = searchWidthControl.children[1].children[0];
const inputAutoFocusRow = getChildByClassName(searchWidthControl, 'x-nt-appearance-setting-row');
const inputAutoFocusTitleGroup = getChildByClassName(
  inputAutoFocusRow,
  'x-nt-appearance-setting-title-group'
);
const inputAutoFocusInfoButton = getChildByClassName(
  inputAutoFocusTitleGroup,
  'x-nt-appearance-info-button'
);
const inputAutoFocusToggle = inputAutoFocusRow.children[1].children[0];
const moreSettingsLink = getChildByClassName(appearanceHeader, 'x-nt-appearance-more-settings');
const shortcutsAccordion = getChildByClassName(searchWidthControl, 'x-nt-shortcuts-accordion');
const shortcutsRow = shortcutsAccordion.children[0];
const shortcutsTrigger = shortcutsRow.children[0];
const shortcutsToggle = shortcutsRow.children[1].children[0];
const shortcutsDetails = shortcutsAccordion.children[1];
const shortcutsDetailsInner = shortcutsDetails.children[0];
const shortcutAddToggle = shortcutsDetailsInner.children[0].children[1].children[0];
const shortcutDockToggle = shortcutsDetailsInner.children[1].children[1].children[0];
const shortcutColumnsControl = shortcutsDetailsInner.children[2];
const shortcutColumnsRow = shortcutColumnsControl.children[1];
const shortcutColumnsSlider = shortcutColumnsRow.children[0].children[0];
const shortcutColumnsSliderValueInput = shortcutColumnsRow.children[1];

assert.ok(appearanceHeader, 'appearance header should be a direct panel child above the scrollable content');
assert.ok(appearanceScrollBody, 'appearance panel content should use one dedicated internal scroll container');
assert.strictEqual(searchWidthControl.getAttribute('data-visible'), 'true');
assert.strictEqual(searchWidthSlider.disabled, false, 'global scope should still show the search width slider');
assert.strictEqual(searchWidthSlider.tabIndex, 0, 'global scope search width slider should be tabbable');
assert.strictEqual(inputAutoFocusToggle.checked, false, 'input auto-focus should default to disabled');
assert.strictEqual(inputAutoFocusToggle.getAttribute('role'), 'switch');
assert.strictEqual(inputAutoFocusToggle.getAttribute('aria-checked'), 'false');
assert.strictEqual(shortcutsToggle.checked, true, 'shortcuts should default to enabled');
assert.strictEqual(shortcutsTrigger.getAttribute('aria-expanded'), 'false');
assert.strictEqual(shortcutsTrigger.disabled, false);
assert.strictEqual(shortcutsDetails.hidden, true, 'shortcut details should default to collapsed');
assert.strictEqual(shortcutAddToggle.disabled, true, 'collapsed shortcut details should not be tabbable');
assert.strictEqual(shortcutDockToggle.disabled, true, 'collapsed shortcut details should disable nested toggles');
assert.strictEqual(shortcutColumnsSlider.disabled, true, 'collapsed shortcut details should disable the column slider');
assert.strictEqual(shortcutColumnsSliderValueInput.disabled, true, 'collapsed shortcut details should disable the numeric value');
shortcutsTrigger.click();
assert.strictEqual(shortcutsTrigger.getAttribute('aria-expanded'), 'true');
assert.strictEqual(shortcutsDetails.hidden, false, 'clicking the shortcut row should expand its details');
assert.strictEqual(shortcutAddToggle.disabled, false);
assert.strictEqual(shortcutDockToggle.disabled, false);
assert.strictEqual(shortcutColumnsSlider.disabled, false);
assert.strictEqual(shortcutColumnsSliderValueInput.disabled, false);
assert.strictEqual(shortcutColumnsSlider.value, '10');
assert.strictEqual(shortcutColumnsSliderValueInput.value, '10');
shortcutColumnsSlider.value = '7';
shortcutColumnsSlider._listeners.input[0]();
shortcutColumnsSlider._listeners.change[0]();
assert.strictEqual(shortcutColumns, 7, 'the slider should preserve every integer without snapping');
shortcutColumnsSliderValueInput.value = '11';
shortcutColumnsSliderValueInput._listeners.keydown[0]({
  key: 'Enter',
  preventDefault() {}
});
assert.strictEqual(shortcutColumns, 11, 'Enter should commit a typed exact integer');
shortcutColumnsSliderValueInput.value = '13';
shortcutColumnsSliderValueInput._listeners.blur[0]();
assert.strictEqual(shortcutColumns, 13, 'clicking outside should commit the numeric value through blur');
shortcutColumnsSliderValueInput.value = '';
shortcutColumnsSliderValueInput._listeners.blur[0]();
assert.strictEqual(shortcutColumnsSliderValueInput.value, '13', 'an empty draft should restore the saved value');
shortcutColumnsSliderValueInput.value = '99';
shortcutColumnsSliderValueInput._listeners.blur[0]();
assert.strictEqual(shortcutColumns, 16, 'typed values should clamp to the supported range');
shortcutsTrigger.click();
assert.strictEqual(shortcutsTrigger.getAttribute('aria-expanded'), 'false');
assert.strictEqual(shortcutsDetails.hidden, true, 'clicking the shortcut row again should collapse its details');
assert.strictEqual(shortcutAddToggle.disabled, true);
assert.strictEqual(shortcutDockToggle.disabled, true);
assert.strictEqual(shortcutColumnsSlider.disabled, true);
assert.strictEqual(shortcutColumnsSliderValueInput.disabled, true);
shortcutsTrigger.click();
assert.strictEqual(shortcutsDetails.hidden, false, 'shortcut details should reopen after being collapsed');
shortcutsToggle.checked = false;
shortcutsToggle._listeners.change.forEach((listener) => listener({ target: shortcutsToggle }));
assert.strictEqual(shortcutsTrigger.disabled, true, 'turning shortcuts off should disable the accordion trigger');
assert.strictEqual(shortcutsDetails.hidden, true, 'turning shortcuts off should collapse shortcut details');
shortcutsTrigger.click();
assert.strictEqual(shortcutsDetails.hidden, true, 'disabled shortcut accordion should not reopen');
shortcutsToggle.checked = true;
shortcutsToggle._listeners.change.forEach((listener) => listener({ target: shortcutsToggle }));
assert.strictEqual(shortcutsTrigger.disabled, false, 're-enabling shortcuts should restore the accordion trigger');
assert.strictEqual(shortcutsDetails.hidden, true, 're-enabling shortcuts should keep the accordion collapsed');
assert.strictEqual(
  inputAutoFocusInfoButton.getAttribute('aria-label'),
  'Input auto-focus info'
);
inputAutoFocusInfoButton._listeners.focus.forEach((listener) => listener());
assert.strictEqual(inputAutoFocusTooltips.length, 1);
assert.strictEqual(inputAutoFocusTooltips[0].anchor, inputAutoFocusInfoButton);
assert.strictEqual(
  inputAutoFocusTooltips[0].text,
  'If you prefer to use the browser’s native address bar, turn this option off. The extension URL will no longer appear in the address bar.'
);
inputAutoFocusToggle.checked = true;
inputAutoFocusToggle._listeners.change.forEach((listener) => listener({ target: inputAutoFocusToggle }));
assert.deepStrictEqual(inputAutoFocusWrites, [true]);
assert.strictEqual(inputAutoFocusToggle.getAttribute('aria-checked'), 'true');
assert.strictEqual(moreSettingsLink.tabIndex, 0, 'more settings link in the sticky header should be tabbable');

const newtabHtml = readPageSource('newtab.html');
assert.match(
  newtabHtml,
  /\.x-nt-appearance-setting-row\s*\{[\s\S]*?margin-top:\s*8px;/,
  'input auto-focus should have more separation from the search-width slider'
);
const zhCNMessages = JSON.parse(fs.readFileSync('_locales/zh_CN/messages.json', 'utf8'));
assert.strictEqual(
  zhCNMessages.newtab_input_auto_focus_help.message,
  '如倾向使用浏览器原生地址栏，可关闭该选项。关闭后地址栏中的扩展 URL 将不再显示。'
);

async function testWallpaperSourcesHintWaitsForFinalFocusRoute() {
  const pendingRoute = createWallpaperSandbox();
  pendingRoute.documentObj.documentElement.setAttribute(
    'data-nt-focus-route-pending',
    'true'
  );
  let pendingRouteCreates = 0;
  const pendingRuntime = pendingRoute.sandbox.LumnoNewtabWallpaper.createWallpaperRuntime({
    documentObj: pendingRoute.documentObj,
    windowObj: pendingRoute.windowObj,
    storageArea: null,
    featureHints: {
      createFeatureHint() {
        pendingRouteCreates += 1;
        return null;
      }
    },
    t: (_key, fallback) => fallback || '',
    getRiSvg: () => ''
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
  const settledRuntime = settledRoute.sandbox.LumnoNewtabWallpaper.createWallpaperRuntime({
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
    t: (_key, fallback) => fallback || '',
    getRiSvg: () => ''
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
  settledRuntime.getControlElement().children[1].click();
  assert.strictEqual(
    settledRouteDismissals,
    1,
    'opening the appearance panel should acknowledge and dismiss the visible feature hint'
  );
}

const scopedRuntime = sandbox.LumnoNewtabWallpaper.createWallpaperRuntime({
  documentObj,
  windowObj,
  storageArea: null,
  t: (_key, fallback) => fallback || '',
  getRiSvg: () => '',
  getThemeScope: () => 'home'
});
scopedRuntime.createControls();
const scopedControl = scopedRuntime.getControlElement();
scopedControl.children[1].click();
const scopedScrollBody = getChildByClassName(scopedControl.children[0], 'x-nt-wallpaper-panel-scroll');
const scopedAppearanceSection = getChildByClassName(scopedScrollBody, 'x-nt-appearance-section');
const scopedSearchWidthControl = getChildByClassName(scopedAppearanceSection, 'x-nt-search-width-control');
const scopedSearchWidthSlider = scopedSearchWidthControl.children[1].children[0];
const scopedMoreSettingsLink = getChildByClassName(
  getChildByClassName(scopedControl.children[0], 'x-nt-appearance-header'),
  'x-nt-appearance-more-settings'
);

assert.strictEqual(scopedSearchWidthControl.getAttribute('data-visible'), 'true');
assert.strictEqual(scopedSearchWidthSlider.disabled, false, 'visible search width slider should be interactive');
assert.strictEqual(scopedSearchWidthSlider.tabIndex, 0, 'visible search width slider should be tabbable');
assert.strictEqual(scopedMoreSettingsLink.tabIndex, 0, 'more settings link in the sticky header should stay tabbable');

let switchingScope = 'global';
const switchingRuntime = sandbox.LumnoNewtabWallpaper.createWallpaperRuntime({
  documentObj,
  windowObj,
  storageArea: null,
  t: (_key, fallback) => fallback || '',
  getRiSvg: () => '',
  getThemeScope: () => switchingScope,
  setThemeScope: (scope) => {
    switchingScope = scope === 'home' ? 'home' : 'global';
  }
});
switchingRuntime.createControls();
const switchingControl = switchingRuntime.getControlElement();
switchingControl.children[1].click();
const switchingPanel = switchingControl.children[0];
const switchingScrollBody = getChildByClassName(switchingPanel, 'x-nt-wallpaper-panel-scroll');
const switchingAppearanceSection = getChildByClassName(switchingScrollBody, 'x-nt-appearance-section');
const switchingThemeHeader = getChildByClassName(switchingAppearanceSection, 'x-nt-wallpaper-panel-header');
const switchingScopeTabs = getChildByClassName(switchingThemeHeader, 'x-nt-appearance-scope-tabs');
const switchingSearchWidthControl = getChildByClassName(switchingAppearanceSection, 'x-nt-search-width-control');
const getSwitchingScopeTab = (scope) => switchingScopeTabs.children.find(
  (child) => child.getAttribute('data-theme-scope') === scope
);

assert.strictEqual(switchingSearchWidthControl.getAttribute('data-visible'), 'true');
assert.ok(
  getChildByClassName(switchingScopeTabs, 'x-nt-wallpaper-tabs-indicator'),
  'theme scope tabs should use the shared segmented tab indicator'
);
getSwitchingScopeTab('home').click();
assert.strictEqual(switchingScope, 'home', 'clicking New Tab should switch theme scope');
assert.strictEqual(getSwitchingScopeTab('home').getAttribute('data-active'), 'true');
assert.strictEqual(getSwitchingScopeTab('global').getAttribute('data-active'), 'false');
assert.strictEqual(
  switchingSearchWidthControl.getAttribute('data-visible'),
  'true',
  'search width control should stay visible after switching to New Tab scope'
);
getSwitchingScopeTab('global').click();
assert.strictEqual(switchingScope, 'global', 'clicking Global should switch theme scope back');
assert.strictEqual(getSwitchingScopeTab('global').getAttribute('data-active'), 'true');
assert.strictEqual(
  switchingSearchWidthControl.getAttribute('data-visible'),
  'true',
  'search width control should stay visible after switching back to Global scope'
);

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
  const testRuntime = testSandbox.LumnoNewtabWallpaper.createWallpaperRuntime({
    documentObj: testDocument,
    windowObj: testWindow,
    storageArea: createMemoryStorage({ [WALLPAPER_STORAGE_KEY]: DEFAULT_WALLPAPER_ID }),
    storageKeys: {
      wallpaper: WALLPAPER_STORAGE_KEY,
      localWallpaper: LOCAL_WALLPAPER_STORAGE_KEY
    },
    t: (_key, fallback) => fallback || '',
    getRiSvg: () => ''
  });

  await testRuntime.bootstrapInitialWallpaper();

  assert.strictEqual(localStoreCalls.readAll, 0, 'built-in startup should skip the local wallpaper catalog');
  assert.deepStrictEqual(localStoreCalls.readByIds, [], 'built-in startup should not query local wallpaper records');

  testRuntime.createControls();
  const control = testRuntime.getControlElement();
  control.children[1].click();
  assert.strictEqual(localStoreCalls.readAll, 0, 'opening the panel on Built-in should keep the catalog deferred');

  getDescendantByAttribute(control.children[0], 'data-wallpaper-tab', 'local').click();
  assert.strictEqual(localStoreCalls.readAll, 1, 'opening Local should load the full catalog once');
  await Promise.resolve();
  getDescendantByAttribute(control.children[0], 'data-wallpaper-tab', 'built-in').click();
  getDescendantByAttribute(control.children[0], 'data-wallpaper-tab', 'local').click();
  assert.strictEqual(localStoreCalls.readAll, 1, 'reopening Local should reuse the loaded catalog');
}

async function testWallpaperTileIntentReusesDecodedImagePromise() {
  const imageHarness = createDeferredWallpaperImageHarness();
  const { documentObj: testDocument, windowObj: testWindow, sandbox: testSandbox } =
    createWallpaperSandbox({ Image: imageHarness.Image });
  const testRuntime = testSandbox.LumnoNewtabWallpaper.createWallpaperRuntime({
    documentObj: testDocument,
    windowObj: testWindow,
    storageArea: createMemoryStorage({ [WALLPAPER_STORAGE_KEY]: DEFAULT_WALLPAPER_ID }),
    storageKeys: { wallpaper: WALLPAPER_STORAGE_KEY },
    t: (_key, fallback) => fallback || '',
    getRiSvg: () => ''
  });

  await testRuntime.bootstrapInitialWallpaper();
  testRuntime.createControls();
  const control = testRuntime.getControlElement();
  control.children[1].click();
  const targetTile = getDescendantByAttribute(control.children[0], 'data-wallpaper-id', 'white-shanshui');

  assert.strictEqual(targetTile._listeners.pointerenter.length, 1);
  assert.strictEqual(targetTile._listeners.focus.length, 1);
  assert.strictEqual(targetTile._listeners.pointerdown.length, 1);
  targetTile._listeners.pointerenter[0]();
  targetTile._listeners.focus[0]();
  targetTile._listeners.pointerdown[0]();
  assert.strictEqual(imageHarness.requests.length, 1, 'all selection-intent events should share one image request');

  targetTile.click();
  assert.strictEqual(imageHarness.requests.length, 1, 'click should reuse the image promise primed by selection intent');
  assert.ok(
    testDocument.documentElement.style
      .getPropertyValue('--x-nt-wallpaper-image')
      .includes('lumno-newtab-monet-coastal-white.webp'),
    'the previous wallpaper should remain visible while the target image decodes'
  );

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
  const testRuntime = testSandbox.LumnoNewtabWallpaper.createWallpaperRuntime({
    documentObj: testDocument,
    windowObj: testWindow,
    storageArea: createMemoryStorage({ [WALLPAPER_STORAGE_KEY]: DEFAULT_WALLPAPER_ID }),
    storageKeys: { wallpaper: WALLPAPER_STORAGE_KEY },
    t: (_key, fallback) => fallback || '',
    getRiSvg: () => ''
  });

  await testRuntime.bootstrapInitialWallpaper();
  testRuntime.createControls();
  const control = testRuntime.getControlElement();
  control.children[1].click();
  getDescendantByAttribute(control.children[0], 'data-wallpaper-id', 'white-shanshui').click();
  getDescendantByAttribute(control.children[0], 'data-wallpaper-id', 'dark-shanshui-moonlit').click();
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
  const testRuntime = testSandbox.LumnoNewtabWallpaper.createWallpaperRuntime({
    documentObj: testDocument,
    windowObj: testWindow,
    storageArea: syncStorage,
    storageKeys: {
      wallpaper: WALLPAPER_STORAGE_KEY,
      localWallpaper: LOCAL_WALLPAPER_STORAGE_KEY
    },
    t: (_key, fallback) => fallback || '',
    getRiSvg: () => ''
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
  const testRuntime = testSandbox.LumnoNewtabWallpaper.createWallpaperRuntime({
    documentObj: testDocument,
    windowObj: testWindow,
    storageArea: syncStorage,
    storageKeys: {
      wallpaper: WALLPAPER_STORAGE_KEY,
      localWallpaper: LOCAL_WALLPAPER_STORAGE_KEY
    },
    t: (_key, fallback) => fallback || '',
    getRiSvg: () => ''
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
  const testRuntime = testSandbox.LumnoNewtabWallpaper.createWallpaperRuntime({
    documentObj: testDocument,
    windowObj: testWindow,
    storageArea: syncStorage,
    localWallpaperStorageArea: localStorageArea,
    storageKeys: {
      wallpaper: WALLPAPER_STORAGE_KEY,
      localWallpaper: LOCAL_WALLPAPER_STORAGE_KEY
    },
    t: (_key, fallback) => fallback || '',
    getRiSvg: () => ''
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
    const testRuntime = testSandbox.LumnoNewtabWallpaper.createWallpaperRuntime({
      documentObj: testDocument,
      windowObj: testWindow,
      storageArea: syncStorage,
      localWallpaperStorageArea: localStorageArea,
      storageKeys: {
        wallpaper: WALLPAPER_STORAGE_KEY,
        localWallpaper: LOCAL_WALLPAPER_STORAGE_KEY
      },
      t: (_key, fallback) => fallback || '',
      getRiSvg: () => ''
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
    assert.strictEqual(
      preloadCache.wallpapers[mode],
      null,
      `${mode} mode should remember that its local wallpaper has no built-in preload image`
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
  const testRuntime = testSandbox.LumnoNewtabWallpaper.createWallpaperRuntime({
    documentObj: testDocument,
    windowObj: testWindow,
    storageArea: syncStorage,
    storageKeys: {
      wallpaper: WALLPAPER_STORAGE_KEY,
      localWallpaper: LOCAL_WALLPAPER_STORAGE_KEY
    },
    t: (_key, fallback) => fallback || '',
    getRiSvg: () => ''
  });

  await testRuntime.bootstrapInitialWallpaper();
  testRuntime.createControls();
  const testControl = testRuntime.getControlElement();
  testControl.children[1].click();
  const testPanel = testControl.children[0];
  const modeSyncControl = getDescendantByClassName(testPanel, 'x-nt-wallpaper-mode-sync');
  const modeSyncToggle = getDescendantByTagName(modeSyncControl, 'input');
  const modeRow = getDescendantByClassName(testPanel, 'x-nt-wallpaper-mode-row');

  assert.ok(modeSyncControl, 'wallpaper panel should render a light/dark consistency switch below the main toggle');
  assert.strictEqual(modeSyncToggle.checked, true, 'light/dark consistency should default on for legacy wallpaper values');
  assert.strictEqual(modeRow.getAttribute('data-visible'), 'false', 'the mode row should stay hidden while consistency is on');

  modeSyncToggle.checked = false;
  modeSyncToggle._listeners.change[0]();

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
  assert.strictEqual(modeRow.getAttribute('data-visible'), 'true', 'the mode row should appear after consistency is disabled');
  assert.strictEqual(getDescendantByClassName(modeRow, 'x-nt-appearance-setting-title').textContent, 'Mode',
    'the light/dark switch reads as a setting row like Source and Category');
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
  const testRuntime = testSandbox.LumnoNewtabWallpaper.createWallpaperRuntime({
    documentObj: testDocument,
    windowObj: testWindow,
    storageArea: syncStorage,
    localWallpaperStorageArea: localStorageArea,
    storageKeys: {
      wallpaper: WALLPAPER_STORAGE_KEY,
      localWallpaper: LOCAL_WALLPAPER_STORAGE_KEY
    },
    t: (_key, fallback) => fallback || '',
    getRiSvg: () => ''
  });

  await testRuntime.bootstrapInitialWallpaper();
  testRuntime.createControls();
  const testControl = testRuntime.getControlElement();
  testControl.children[1].click();
  const testPanel = testControl.children[0];
  const modeSyncToggle = getDescendantByTagName(
    getDescendantByClassName(testPanel, 'x-nt-wallpaper-mode-sync'),
    'input'
  );

  modeSyncToggle.checked = false;
  modeSyncToggle._listeners.change[0]();

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
  const testRuntime = testSandbox.LumnoNewtabWallpaper.createWallpaperRuntime({
    documentObj: testDocument,
    windowObj: testWindow,
    storageArea: syncStorage,
    storageKeys: {
      wallpaper: WALLPAPER_STORAGE_KEY,
      localWallpaper: LOCAL_WALLPAPER_STORAGE_KEY
    },
    t: (_key, fallback) => fallback || '',
    getRiSvg: () => ''
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
  const testControl = testRuntime.getControlElement();
  testControl.children[1].click();
  const darkModeTab = getDescendantByAttribute(testControl.children[0], 'data-wallpaper-mode', 'dark');
  darkModeTab.click();
  const targetTile = getDescendantByAttribute(testControl.children[0], 'data-wallpaper-id', 'dark-monet-lily-nocturne');
  targetTile.click();

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
  const testRuntime = testSandbox.LumnoNewtabWallpaper.createWallpaperRuntime({
    documentObj: testDocument,
    windowObj: testWindow,
    storageArea: syncStorage,
    storageKeys: {
      wallpaper: WALLPAPER_STORAGE_KEY,
      localWallpaper: LOCAL_WALLPAPER_STORAGE_KEY,
      overlay: WALLPAPER_OVERLAY_STORAGE_KEY
    },
    t: (_key, fallback) => fallback || '',
    getRiSvg: () => ''
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
  const testRuntime = testSandbox.LumnoNewtabWallpaper.createWallpaperRuntime({
    documentObj: testDocument,
    windowObj: testWindow,
    storageArea: syncStorage,
    localWallpaperStorageArea: localStorageArea,
    storageKeys: {
      wallpaper: WALLPAPER_STORAGE_KEY,
      localWallpaper: LOCAL_WALLPAPER_STORAGE_KEY
    },
    t: (_key, fallback) => fallback || '',
    getRiSvg: () => ''
  });

  await testRuntime.bootstrapInitialWallpaper();
  testRuntime.createControls();
  const testControl = testRuntime.getControlElement();
  testControl.children[1].click();
  getDescendantByAttribute(testControl.children[0], 'data-wallpaper-mode', 'dark').click();
  getDescendantByAttribute(testControl.children[0], 'data-wallpaper-tab', 'local').click();
  await Promise.resolve();
  await Promise.resolve();
  getDescendantByAttribute(testControl.children[0], 'data-wallpaper-id', customWallpaperId).click();

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
  assert.strictEqual(
    preloadCache.wallpapers.dark,
    null,
    'a local-only dark wallpaper should suppress the synced white fallback during preload'
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
  const testRuntime = testSandbox.LumnoNewtabWallpaper.createWallpaperRuntime({
    documentObj: testDocument,
    windowObj: testWindow,
    storageArea: syncStorage,
    localWallpaperStorageArea: localStorageArea,
    storageKeys: {
      wallpaper: WALLPAPER_STORAGE_KEY,
      localWallpaper: LOCAL_WALLPAPER_STORAGE_KEY
    },
    t: (_key, fallback) => fallback || '',
    getRiSvg: () => ''
  });

  await testRuntime.bootstrapInitialWallpaper();
  testRuntime.createControls();
  const testControl = testRuntime.getControlElement();
  testControl.children[1].click();
  getDescendantByAttribute(testControl.children[0], 'data-wallpaper-tab', 'local').click();
  await waitForAsyncWallpaperApply();
  const body = getDescendantByAttribute(testControl.children[0], 'data-active-tab', 'local');
  assert.ok(body, 'the local tab should open');

  // Every IndexedDB write publishes an asset revision, which reloads the stored state.
  const deleteWallpaper = async (id) => {
    getDescendantByAttribute(testControl.children[0], 'data-wallpaper-id', id)
      .querySelector('.x-nt-wallpaper-delete-button')
      .click();
    await waitForAsyncWallpaperApply();
    testRuntime.handleStorageChange({ [ASSET_REVISION_STORAGE_KEY]: { newValue: id } });
    await waitForAsyncWallpaperApply();
  };

  await deleteWallpaper(firstId);
  assert.strictEqual(body.getAttribute('data-active-tab'), 'local',
    'deleting an unselected local wallpaper should keep the local tab open');
  assert.strictEqual(getDescendantByAttribute(testControl.children[0], 'data-wallpaper-id', firstId), null);

  getDescendantByAttribute(testControl.children[0], 'data-wallpaper-id', secondId).click();
  testRuntime.handleStorageChange({ [LOCAL_WALLPAPER_STORAGE_KEY]: { newValue: localStorageArea.data[LOCAL_WALLPAPER_STORAGE_KEY] } });
  await waitForAsyncWallpaperApply();
  await deleteWallpaper(secondId);
  testRuntime.handleStorageChange({ [LOCAL_WALLPAPER_STORAGE_KEY]: { newValue: localStorageArea.data[LOCAL_WALLPAPER_STORAGE_KEY] } });
  await waitForAsyncWallpaperApply();
  assert.strictEqual(body.getAttribute('data-active-tab'), 'local',
    'deleting the selected local wallpaper should keep the local tab open');

  getDescendantByAttribute(testControl.children[0], 'data-wallpaper-tab', 'bing').click();
  testDocument.body.setAttribute('data-theme', 'dark');
  testRuntime.handleThemeModeChange();
  await waitForAsyncWallpaperApply();
  assert.strictEqual(body.getAttribute('data-active-tab'), 'bing',
    'a theme change that keeps the same selection should not switch source tabs');
}

async function testNewtabFaviconOptionsRenderBelowLogoAndPersistSelection() {
  const syncStorage = createMemoryStorage({
    [NEWTAB_FAVICON_STORAGE_KEY]: 'default'
  });
  const { documentObj: testDocument, windowObj: testWindow, sandbox: testSandbox } = createWallpaperSandbox();
  const testRuntime = testSandbox.LumnoNewtabWallpaper.createWallpaperRuntime({
    documentObj: testDocument,
    windowObj: testWindow,
    storageArea: syncStorage,
    storageKeys: {
      favicon: NEWTAB_FAVICON_STORAGE_KEY
    },
    t: (_key, fallback) => fallback || '',
    formatMessage: (_key, fallback, params) => String(fallback || '').replace('{name}', params.name),
    getRiSvg: () => ''
  });

  await testRuntime.bootstrapInitialNewtabFavicon();
  testRuntime.createControls();
  const testControl = testRuntime.getControlElement();
  testControl.children[1].click();
  const testPanel = testControl.children[0];
  const faviconGroup = getDescendantByClassName(testPanel, 'x-nt-favicon-group');
  const faviconTitle = getDescendantByClassName(testPanel, 'x-nt-favicon-title');
  const faviconOptions = getDescendantByClassName(testPanel, 'x-nt-favicon-options');

  assert.ok(faviconGroup, 'Logo section should render a New Tab favicon group');
  assert.strictEqual(faviconTitle.textContent, 'New Tab favicon');
  assert.strictEqual(faviconOptions.children.length, 2, 'favicon selector should reserve two icon slots');
  assert.strictEqual(faviconOptions.children[0].getAttribute('data-newtab-favicon-id'), 'default');
  assert.strictEqual(faviconOptions.children[1].getAttribute('data-newtab-favicon-id'), 'alternate');
  assert.strictEqual(faviconOptions.children[0].getAttribute('data-selected'), 'true');
  assert.strictEqual(faviconOptions.children[1].getAttribute('data-selected'), 'false');

  const firstIcon = getDescendantByTagName(faviconOptions.children[0], 'img');
  assert.ok(
    firstIcon.src.includes('assets/images/lumno.png'),
    'default favicon option should use the current extension icon'
  );
  const secondIconPreview = getDescendantByClassName(faviconOptions.children[1], 'x-nt-favicon-svg-preview');
  assert.ok(secondIconPreview, 'alternate favicon option should use an inline SVG preview');

  faviconOptions.children[1].click();

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
  assert.strictEqual(faviconOptions.children[0].getAttribute('data-selected'), 'false');
  assert.strictEqual(faviconOptions.children[1].getAttribute('data-selected'), 'true');
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
  const foregroundRuntime = foreground.sandbox.LumnoNewtabWallpaper.createWallpaperRuntime({
    documentObj: foreground.documentObj,
    windowObj: foreground.windowObj,
    storageArea: foregroundStorage,
    storageKeys: {
      favicon: NEWTAB_FAVICON_STORAGE_KEY
    },
    t: (_key, fallback) => fallback || '',
    getRiSvg: () => ''
  });
  const backgroundRuntime = background.sandbox.LumnoNewtabWallpaper.createWallpaperRuntime({
    documentObj: background.documentObj,
    windowObj: background.windowObj,
    storageArea: backgroundStorage,
    storageKeys: {
      favicon: NEWTAB_FAVICON_STORAGE_KEY
    },
    t: (_key, fallback) => fallback || '',
    getRiSvg: () => ''
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
  const testRuntime = testSandbox.LumnoNewtabWallpaper.createWallpaperRuntime({
    documentObj: testDocument,
    windowObj: testWindow,
    storageArea,
    storageKeys: { effect: WALLPAPER_EFFECT_STORAGE_KEY },
    t: (_key, fallback) => fallback || '',
    getRiSvg: () => ''
  });

  testRuntime.createControls();
  testRuntime.getControlElement().children[1].click();
  await testRuntime.bootstrapInitialWallpaperEffect();
  const control = testRuntime.getControlElement();
  const inkToneControl = getDescendantByClassName(control, 'x-nt-effect-ink-tone-control');
  const darkButton = getDescendantByAttribute(control, 'data-wallpaper-effect-ink-tone', 'dark');
  const lightButton = getDescendantByAttribute(control, 'data-wallpaper-effect-ink-tone', 'light');
  const ditherButton = getEffectOption(control, 'dither');

  assert.strictEqual(
    inkToneControl.getAttribute('data-visible'),
    'true',
    'halftone should show the shadow/highlight sampling picker beneath the effect tabs'
  );
  assert.strictEqual(
    darkButton.getAttribute('aria-pressed'),
    'true',
    'legacy automatic tone should present the expected dark default for the light wallpaper mode'
  );

  lightButton.click();
  await new Promise((resolve) => setTimeout(resolve, 150));
  assert.strictEqual(lightButton.getAttribute('aria-pressed'), 'true');
  assert.strictEqual(darkButton.getAttribute('aria-pressed'), 'false');
  assert.strictEqual(storageArea.data[WALLPAPER_EFFECT_STORAGE_KEY].light.inkTone, 'light');
  assert.strictEqual(
    storageArea.data[WALLPAPER_EFFECT_STORAGE_KEY].dark.inkTone,
    'light',
    'shared wallpaper modes should persist the chosen ink tone consistently'
  );

  getEffectOption(control, 'ascii').click();
  assert.strictEqual(
    inkToneControl.getAttribute('data-visible'),
    'true',
    'ASCII should keep the shadow/highlight sampling picker visible'
  );
  ditherButton.click();
  assert.strictEqual(
    inkToneControl.getAttribute('data-visible'),
    'false',
    'Dither should use the wallpaper palette instead of the dot or character ink picker'
  );
  getEffectOption(control, 'grain').click();
  assert.strictEqual(
    inkToneControl.getAttribute('data-visible'),
    'false',
    'grain should hide the ink tone picker because it has no dots or characters'
  );
}

async function testBlocksExposeReliefControls() {
  const storageArea = createMemoryStorage({});
  const { documentObj: testDocument, windowObj: testWindow, sandbox: testSandbox } =
    createWallpaperSandbox();
  const testRuntime = testSandbox.LumnoNewtabWallpaper.createWallpaperRuntime({
    documentObj: testDocument,
    windowObj: testWindow,
    storageArea,
    storageKeys: { effect: WALLPAPER_EFFECT_STORAGE_KEY },
    t: (_key, fallback) => fallback || '',
    getRiSvg: () => ''
  });

  testRuntime.createControls();
  testRuntime.getControlElement().children[1].click();
  await testRuntime.bootstrapInitialWallpaperEffect();
  const control = testRuntime.getControlElement();
  const blocksButton = getEffectOption(control, 'blocks');
  const inkToneControl = getDescendantByClassName(control, 'x-nt-effect-ink-tone-control');

  assert.ok(blocksButton, 'the appearance panel should include the Blocks filter');
  blocksButton.click();
  assert.strictEqual(blocksButton.getAttribute('data-selected'), 'true');
  assert.strictEqual(testDocument.body.getAttribute('data-wallpaper-effect'), 'blocks');
  assert.ok(
    testRuntime.containsTarget(blocksButton),
    'clicks inside the filter menu should not count as outside the appearance panel'
  );
  getDescendantByAttribute(control, 'data-wallpaper-ref', 'effectSelectHost').children[0].click();
  assert.strictEqual(testRuntime.closeOpenMenu(), true, 'Escape should close the open filter menu first');
  assert.strictEqual(testRuntime.closeOpenMenu(), false, 'Escape should fall through once the menu is closed');
  [
    ['effectSizeControl', 'effectSizeLabel', 'Block size']
  ].forEach(([controlRef, labelRef, label]) => {
    assert.strictEqual(
      getDescendantByAttribute(control, 'data-wallpaper-ref', controlRef).getAttribute('data-visible'),
      'true',
      `${label} should be visible for Blocks`
    );
    assert.strictEqual(
      getDescendantByAttribute(control, 'data-wallpaper-ref', labelRef).textContent,
      label
    );
  });
  assert.strictEqual(
    inkToneControl.getAttribute('data-visible'),
    'false',
    'Blocks should preserve wallpaper colors instead of exposing an ink-tone override'
  );
  assert.strictEqual(
    getDescendantByAttribute(control, 'data-wallpaper-ref', 'effectStrengthControl').getAttribute('data-visible'),
    'false',
    'fixed full-height relief should not render a redundant adjustment'
  );
  assert.strictEqual(
    getDescendantByAttribute(control, 'data-wallpaper-ref', 'effectTextureControl').getAttribute('data-visible'),
    'false',
    'fixed full-detail color should not render a redundant adjustment'
  );
  assert.strictEqual(
    getDescendantByAttribute(control, 'data-wallpaper-ref', 'effectSpacingControl').getAttribute('data-visible'),
    'false',
    'fixed zero block spacing should not render a redundant adjustment'
  );
  const sizeSlider = getDescendantByAttribute(control, 'data-wallpaper-ref', 'effectSizeSlider');
  assert.strictEqual(sizeSlider.max, '5');
  assert.strictEqual(sizeSlider.step, '1');
  assert.strictEqual(sizeSlider.getAttribute('data-value-suffix'), null);
  assert.strictEqual(sizeSlider.closest('.x-nt-range-slider-row').getAttribute('data-value-suffix'), null);
  assert.strictEqual(sizeSlider.value, '1', 'Blocks should start at the first size level');
  sizeSlider.value = '5';
  sizeSlider._listeners.input.forEach((listener) => listener({ target: sizeSlider }));
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
  const testRuntime = testSandbox.LumnoNewtabWallpaper.createWallpaperRuntime({
    documentObj: testDocument,
    windowObj: testWindow,
    storageArea,
    storageKeys: { effect: WALLPAPER_EFFECT_STORAGE_KEY },
    t: (_key, fallback) => fallback || '',
    getRiSvg: () => ''
  });

  testRuntime.createControls();
  testRuntime.getControlElement().children[1].click();
  await testRuntime.bootstrapInitialWallpaperEffect();
  const control = testRuntime.getControlElement();
  const strengthSlider = getDescendantByAttribute(
    control,
    'data-wallpaper-ref',
    'effectStrengthSlider'
  );
  const sizeSlider = getDescendantByAttribute(
    control,
    'data-wallpaper-ref',
    'effectSizeSlider'
  );
  assert.strictEqual(strengthSlider.value, '80');

  getEffectOption(control, 'crt').click();
  assert.strictEqual(strengthSlider.value, '100', 'CRT should expose its dedicated strength');
  strengthSlider.value = '50';
  strengthSlider._listeners.input.forEach((listener) => listener({ target: strengthSlider }));

  getEffectOption(control, 'grain').click();
  assert.strictEqual(
    strengthSlider.value,
    '80',
    'Grain strength should survive a round trip through CRT'
  );

  getEffectOption(control, 'blocks').click();
  assert.strictEqual(sizeSlider.value, '1', 'Blocks should expose its dedicated size');
  sizeSlider.value = '4';
  sizeSlider._listeners.input.forEach((listener) => listener({ target: sizeSlider }));

  getEffectOption(control, 'halftone').click();
  assert.strictEqual(sizeSlider.value, '65', 'generic size should survive a round trip through Blocks');
  getEffectOption(control, 'blocks').click();
  assert.strictEqual(sizeSlider.value, '4', 'Blocks size should be retained independently');
  getEffectOption(control, 'grain').click();

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
  const testRuntime = testSandbox.LumnoNewtabWallpaper.createWallpaperRuntime({
    documentObj: testDocument,
    windowObj: testWindow,
    storageArea,
    storageKeys: { effect: WALLPAPER_EFFECT_STORAGE_KEY },
    t: (_key, fallback) => fallback || '',
    getRiSvg: () => ''
  });

  testRuntime.createControls();
  testRuntime.getControlElement().children[1].click();
  await testRuntime.bootstrapInitialWallpaperEffect();
  const control = testRuntime.getControlElement();
  const blurButton = getEffectOption(control, 'blur');
  const sizeControl = getDescendantByAttribute(control, 'data-wallpaper-ref', 'effectSizeControl');
  const spacingControl = getDescendantByAttribute(control, 'data-wallpaper-ref', 'effectSpacingControl');
  const strengthValueInput = getDescendantByAttribute(control, 'data-wallpaper-ref', 'effectStrengthSliderValueInput');
  const textureSlider = getDescendantByAttribute(control, 'data-wallpaper-ref', 'effectTextureSlider');
  const textureLabel = getDescendantByAttribute(control, 'data-wallpaper-ref', 'effectTextureLabel');
  const textureValueInput = getDescendantByAttribute(control, 'data-wallpaper-ref', 'effectTextureSliderValueInput');
  const offButton = getEffectOption(control, 'none');

  blurButton.click();
  assert.strictEqual(blurButton.getAttribute('data-selected'), 'true');
  assert.strictEqual(testDocument.body.getAttribute('data-wallpaper-effect'), 'blur');
  assert.strictEqual(
    getDescendantByAttribute(control, 'data-wallpaper-blur-style', 'standard'),
    null,
    'a single standard texture style should not render a redundant style selector'
  );
  assert.strictEqual(sizeControl.getAttribute('data-visible'), 'false');
  assert.strictEqual(spacingControl.getAttribute('data-visible'), 'false');
  assert.strictEqual(textureSlider.getAttribute('data-wallpaper-dynamic-range'), null);
  assert.strictEqual(String(textureValueInput.min), '0');
  assert.strictEqual(String(textureValueInput.max), '100');
  assert.strictEqual(textureLabel.textContent, 'Texture');
  textureValueInput.value = '180.75';
  textureValueInput.blur();
  await new Promise((resolve) => setTimeout(resolve, 150));
  assert.strictEqual(
    storageArea.data[WALLPAPER_EFFECT_STORAGE_KEY].light.texture,
    100,
    'standard glass texture should clamp typed values to 0–100'
  );
  strengthValueInput.value = '150';
  strengthValueInput.blur();
  await new Promise((resolve) => setTimeout(resolve, 150));
  assert.strictEqual(storageArea.data[WALLPAPER_EFFECT_STORAGE_KEY].light.type, 'blur');
  assert.strictEqual(
    storageArea.data[WALLPAPER_EFFECT_STORAGE_KEY].light.strength,
    100,
    'bounded strength should keep its existing 0–100 contract'
  );
  offButton.click();
  assert.strictEqual(offButton.getAttribute('data-selected'), 'true');
  assert.strictEqual(testDocument.body.getAttribute('data-wallpaper-effect'), 'none');
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
  const testRuntime = testSandbox.LumnoNewtabWallpaper.createWallpaperRuntime({
    documentObj: testDocument,
    windowObj: testWindow,
    storageArea,
    storageKeys: { effect: WALLPAPER_EFFECT_STORAGE_KEY },
    t: (_key, fallback) => fallback || '',
    getRiSvg: () => ''
  });

  testRuntime.createControls();
  testRuntime.getControlElement().children[1].click();
  await testRuntime.bootstrapInitialWallpaperEffect();
  testDocument.body.setAttribute('data-nt-enter', 'done');
  const control = testRuntime.getControlElement();
  const blurButton = getEffectOption(control, 'blur');
  const grainButton = getEffectOption(control, 'grain');

  assert.strictEqual(testDocument.body.getAttribute('data-wallpaper-effect'), 'grain');
  blurButton.click();
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
  grainButton.click();
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
  const testRuntime = testSandbox.LumnoNewtabWallpaper.createWallpaperRuntime({
    documentObj: testDocument,
    windowObj: testWindow,
    storageArea,
    storageKeys: { effect: WALLPAPER_EFFECT_STORAGE_KEY },
    t: (_key, fallback) => fallback || '',
    getRiSvg: () => ''
  });

  testRuntime.createControls();
  testRuntime.getControlElement().children[1].click();
  await testRuntime.bootstrapInitialWallpaperEffect();
  const control = testRuntime.getControlElement();
  const crtButton = getEffectOption(control, 'crt');
  assert.ok(crtButton, 'the wallpaper filter picker should expose CRT');
  crtButton.click();
  assert.strictEqual(testDocument.body.getAttribute('data-wallpaper-effect'), 'crt');
  assert.strictEqual(
    getDescendantByAttribute(control, 'data-wallpaper-ref', 'effectSizeControl').getAttribute('data-visible'),
    'false',
    'CRT should use a preset-specific fixed phosphor grille instead of exposing its size'
  );
  assert.strictEqual(
    getDescendantByAttribute(control, 'data-wallpaper-ref', 'effectSpacingControl').getAttribute('data-visible'),
    'false',
    'CRT should use a fixed two-pixel scanline instead of exposing spacing'
  );
  assert.strictEqual(
    getDescendantByAttribute(control, 'data-wallpaper-ref', 'effectTextureControl').getAttribute('data-visible'),
    'false'
  );
  assert.strictEqual(
    getDescendantByAttribute(control, 'data-wallpaper-ref', 'effectStrengthLabel').textContent,
    'Display intensity'
  );
  assert.strictEqual(
    getDescendantByAttribute(control, 'data-wallpaper-ref', 'effectCrtPresetControl'),
    null,
    'RGB-only CRT should not render a redundant style selector'
  );
  assert.strictEqual(
    getDescendantByAttribute(control, 'data-wallpaper-ref', 'effectCrtGrainControl'),
    null,
    'electron grain should no longer be rendered as a setting'
  );
  [
    ['effectCrtBloomControl', 'effectCrtBloomLabel', 'Bloom'],
    ['effectCrtRgbOffsetControl', 'effectCrtRgbOffsetLabel', 'RGB offset'],
    ['effectCrtCurvatureControl', 'effectCrtCurvatureLabel', 'Screen curvature']
  ].forEach(([controlRef, labelRef, label]) => {
    assert.strictEqual(
      getDescendantByAttribute(control, 'data-wallpaper-ref', controlRef).getAttribute('data-visible'),
      'true'
    );
    assert.strictEqual(
      getDescendantByAttribute(control, 'data-wallpaper-ref', labelRef).textContent,
      label
    );
  });
  const strengthValueInput = getDescendantByAttribute(control, 'data-wallpaper-ref', 'effectStrengthSliderValueInput');
  strengthValueInput.value = '50';
  strengthValueInput.blur();
  const bloomValueInput = getDescendantByAttribute(control, 'data-wallpaper-ref', 'effectCrtBloomSliderValueInput');
  bloomValueInput.value = '140';
  bloomValueInput._listeners.input.forEach((listener) => listener({ target: bloomValueInput }));
  assert.strictEqual(bloomValueInput.value, '100', 'bounded CRT percentages should clamp while typing');
  bloomValueInput.blur();
  const curvatureValueInput = getDescendantByAttribute(control, 'data-wallpaper-ref', 'effectCrtCurvatureSliderValueInput');
  curvatureValueInput.value = '50';
  curvatureValueInput.blur();
  assert.strictEqual(
    getDescendantByAttribute(control, 'data-wallpaper-ref', 'effectCrtCurvatureSlider').value,
    '50',
    'fractional physical values should round-trip back to the same UI percentage'
  );
  const rgbOffsetValueInput = getDescendantByAttribute(control, 'data-wallpaper-ref', 'effectCrtRgbOffsetSliderValueInput');
  rgbOffsetValueInput.value = '50';
  rgbOffsetValueInput.blur();
  assert.strictEqual(String(getDescendantByAttribute(control, 'data-wallpaper-ref', 'effectStrengthSlider').max), '100');
  assert.strictEqual(String(getDescendantByAttribute(control, 'data-wallpaper-ref', 'effectCrtBloomSlider').max), '100');
  assert.strictEqual(String(getDescendantByAttribute(control, 'data-wallpaper-ref', 'effectCrtCurvatureSlider').max), '100');
  [
    'effectStrengthSlider',
    'effectCrtBloomSlider',
    'effectCrtCurvatureSlider'
  ].forEach((sliderRef) => {
    const rangeSlider = getDescendantByAttribute(control, 'data-wallpaper-ref', sliderRef);
    const row = rangeSlider.closest('.x-nt-range-slider-row');
    assert.strictEqual(
      row.querySelector('.x-nt-overlay-tick[data-overlay-tick="default"]').textContent,
      '50%',
      'CRT percentages should label the actual midpoint instead of implying it is the preset default'
    );
    assert.strictEqual(
      row.querySelector('.x-nt-overlay-tick[data-align="end"]').textContent,
      '100%'
    );
  });
  [
    'effectStrengthSlider',
    'effectCrtBloomSlider',
    'effectCrtRgbOffsetSlider',
    'effectCrtCurvatureSlider'
  ].forEach((sliderRef) => {
    const rangeSlider = getDescendantByAttribute(control, 'data-wallpaper-ref', sliderRef);
    assert.strictEqual(
      rangeSlider.closest('.x-nt-range-slider-row').getAttribute('data-value-suffix'),
      '%',
      'CRT parameter values should visibly use percentage units'
    );
    assert.strictEqual(
      rangeSlider.getAttribute('data-value-suffix'),
      '%',
      'CRT slider bubbles should include the percentage suffix'
    );
  });
  const grainButton = getEffectOption(control, 'grain');
  grainButton.click();
  assert.strictEqual(
    getDescendantByAttribute(control, 'data-wallpaper-ref', 'effectSpacingSlider').getAttribute('data-wallpaper-dynamic-range'),
    null,
    'non-CRT filter spacing should remain bounded to prevent accidental values'
  );
  assert.strictEqual(
    getDescendantByAttribute(control, 'data-wallpaper-ref', 'effectSpacingSlider').max,
    '100'
  );
  assert.strictEqual(
    getDescendantByAttribute(control, 'data-wallpaper-ref', 'effectSpacingSlider').value,
    '100',
    'legacy out-of-range spacing should render at the safe UI boundary'
  );
  assert.strictEqual(
    storageArea.data[WALLPAPER_EFFECT_STORAGE_KEY].light.spacing,
    100,
    'normalized spacing should remain within the shared slider range'
  );
  const genericSpacingSlider = getDescendantByAttribute(control, 'data-wallpaper-ref', 'effectSpacingSlider');
  assert.strictEqual(genericSpacingSlider.getAttribute('data-value-suffix'), '%');
  assert.strictEqual(genericSpacingSlider.closest('.x-nt-range-slider-row').getAttribute('data-value-suffix'), '%');
  const genericSpacingInput = getDescendantByAttribute(control, 'data-wallpaper-ref', 'effectSpacingSliderValueInput');
  genericSpacingInput.value = '240';
  genericSpacingInput._listeners.input.forEach((listener) => listener({ target: genericSpacingInput }));
  assert.strictEqual(genericSpacingInput.value, '100', 'other filter spacing should clamp accidental values');
  genericSpacingInput.blur();
  crtButton.click();
  assert.strictEqual(
    getDescendantByAttribute(control, 'data-wallpaper-ref', 'effectSpacingControl').getAttribute('data-visible'),
    'false',
    'returning to CRT should keep the removed spacing control hidden'
  );
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
  const remote = require('../src/newtab/remote-content.js');
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
  const runtime = context.sandbox.LumnoNewtabWallpaper.createWallpaperRuntime({
    documentObj: context.documentObj, windowObj: context.windowObj,
    storageArea: prefs, localWallpaperStorageArea: createMemoryStorage(), getRiSvg: () => ''
  });
  await runtime.bootstrapInitialWallpaper();
  runtime.createControls();
  const control = runtime.getControlElement();
  control.querySelector('.x-nt-wallpaper-button').click();
  getDescendantByAttribute(control, 'data-wallpaper-tab', 'bing').click();
  await waitForAsyncWallpaperApply();
  const daily = getDescendantByAttribute(control, 'data-wallpaper-ref', 'bingDailyToggle');
  daily.checked = true;
  daily.dispatchEvent(new context.windowObj.Event('change'));
  await waitForAsyncWallpaperApply();
  assert.strictEqual(readPickedWallpaper(prefs).light, 'bing-daily', 'Persist daily intent instead of a fixed image ID');
  assert.strictEqual(prefs.data[WALLPAPER_STORAGE_KEY].light, DEFAULT_WALLPAPER_ID,
    'The shared key keeps a built-in stand-in that older versions accept');
  assert.strictEqual(readPickedWallpaper(prefs).dark, 'dark-linocut-topographic', 'Respect split light/dark settings');
  assert.strictEqual(daily.checked, true);
  assert.strictEqual(getDescendantByAttribute(control, 'data-wallpaper-ref', 'bingSelectedMeta').textContent,
    'River bank · © Photographer', 'Split Bing credits into place and photographer');
  assert.strictEqual(getDescendantByAttribute(control, 'data-wallpaper-ref', 'bingSelectedTitle').textContent, 'River');
  assert.strictEqual(getDescendantByAttribute(control, 'data-wallpaper-id', id).getAttribute('data-selected'), 'true',
    'Daily mode should highlight the dated tile it resolves to');
  daily.checked = false;
  daily.dispatchEvent(new context.windowObj.Event('change'));
  await waitForAsyncWallpaperApply();
  assert.strictEqual(readPickedWallpaper(prefs).light, id, 'Turning off daily should fix the current photo');
  assert.strictEqual(daily.checked, false);
  const tile = getDescendantByAttribute(control, 'data-wallpaper-id', id);
  tile.onclick();
  await waitForAsyncWallpaperApply();
  assert.strictEqual(readPickedWallpaper(prefs).light, id);

  let completeDownload;
  waitForDownload = new Promise((resolve) => { completeDownload = resolve; });
  daily.checked = true;
  daily.dispatchEvent(new context.windowObj.Event('change'));
  const builtIn = getDescendantByAttribute(control, 'data-wallpaper-id', 'dark-monet-lily-nocturne');
  builtIn.click();
  completeDownload();
  await waitForAsyncWallpaperApply();
  assert.strictEqual(readPickedWallpaper(prefs).light, 'dark-monet-lily-nocturne',
    'A completed Bing download must not override a newer manual choice');
  assert.strictEqual(daily.checked, false);

  const accordion = getDescendantByAttribute(control, 'data-wallpaper-ref', 'wallpaperAccordionTrigger');
  const body = getDescendantByAttribute(control, 'data-wallpaper-ref', 'body');
  accordion.click();
  assert.strictEqual(body.getAttribute('data-visible'), 'false', 'Collapsing hides the wallpaper options');
  assert.strictEqual(accordion.getAttribute('aria-expanded'), 'false');
  accordion.click();
  assert.strictEqual(body.getAttribute('data-visible'), 'true', 'Expanding shows the wallpaper options again');
  assert.strictEqual(accordion.getAttribute('aria-expanded'), 'true');
}

async function testLegacyOnlineWallpaperMigratesToBing() {
  const remote = require('../src/newtab/remote-content.js');
  const ensured = [];
  const photo = { ...remote.wallpaperFromId('bing-20261002-OHR.River_ZH-CN123'),
    id: remote.BING_DAILY_ID };
  const client = { getWallpaper: () => photo, restoreWallpaper: async () => photo,
    ensureWallpaper: async (id) => { ensured.push(id); return photo; }, setPinnedIds() {} };
  const context = createWallpaperSandbox({ remoteApi: { ...remote, createClient: () => client } });
  const prefs = createMemoryStorage({ [WALLPAPER_STORAGE_KEY]: 'wallhaven-abc123' });
  const runtime = context.sandbox.LumnoNewtabWallpaper.createWallpaperRuntime({
    documentObj: context.documentObj, windowObj: context.windowObj,
    storageArea: prefs, localWallpaperStorageArea: createMemoryStorage(), getRiSvg: () => ''
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
  const remote = require('../src/newtab/remote-content.js');
  const photo = { ...remote.wallpaperFromId('bing-20261002-OHR.River_ZH-CN123'), id: remote.BING_DAILY_ID };
  const client = { getWallpaper: () => photo, restoreWallpaper: async () => photo,
    ensureWallpaper: async () => photo, setPinnedIds() {} };
  const prefs = createMemoryStorage({ [WALLPAPER_STORAGE_KEY]: 'bing-daily' });
  const boot = async () => {
    const context = createWallpaperSandbox({ remoteApi: { ...remote, createClient: () => client } });
    const runtime = context.sandbox.LumnoNewtabWallpaper.createWallpaperRuntime({
      documentObj: context.documentObj, windowObj: context.windowObj,
      storageArea: prefs, localWallpaperStorageArea: createMemoryStorage(), getRiSvg: () => ''
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
  const runtime = context.sandbox.LumnoNewtabWallpaper.createWallpaperRuntime({
    documentObj: context.documentObj, windowObj: context.windowObj,
    storageArea: prefs, localWallpaperStorageArea: (options && options.localStorageArea) || createMemoryStorage(),
    showToast: (message, isError) => toasts.push({ message, isError }),
    fetchRemoteContent: options && options.fetchRemoteContent,
    t: (_key, fallback) => fallback || '',
    getRiSvg: () => ''
  });
  return { context, runtime, toasts };
}

function getCuratedTileIds(control) {
  return getDescendantByAttribute(control, 'data-wallpaper-ref', 'curatedItemsHost').children
    .map((tile) => tile.getAttribute('data-wallpaper-id'));
}

async function testCuratedWallpapersSyncAsIdsAndRotateDaily() {
  const remote = require('../src/newtab/remote-content.js');
  const prefs = createMemoryStorage({ [WALLPAPER_STORAGE_KEY]: DEFAULT_WALLPAPER_ID });
  const { context, runtime } = createCuratedRuntime(prefs);
  await runtime.bootstrapInitialWallpaper();
  runtime.createControls();
  const control = runtime.getControlElement();
  const ref = (name) => getDescendantByAttribute(control, 'data-wallpaper-ref', name);
  control.querySelector('.x-nt-wallpaper-button').click();
  getDescendantByAttribute(control, 'data-wallpaper-tab', 'curated').click();
  await waitForAsyncWallpaperApply();
  assert.deepStrictEqual(getCuratedTileIds(control),
    remote.getCuratedWallpapers('random').slice(0, 9).map((item) => item.id),
    'The curated source opens on the random mix with three full rows');
  getDescendantByAttribute(control, 'data-curated-category', 'nature').click();
  await waitForAsyncWallpaperApply();
  const nature = remote.getCuratedWallpapers('nature');
  assert.deepStrictEqual(getCuratedTileIds(control), nature.slice(0, 9).map((item) => item.id));

  const picked = nature[1];
  getDescendantByAttribute(control, 'data-wallpaper-id', picked.id).onclick();
  await waitForAsyncWallpaperApply();
  assert.strictEqual(readPickedWallpaper(prefs), picked.id, 'A curated photo syncs as its ID alone');
  assert.strictEqual(prefs.data[WALLPAPER_STORAGE_KEY], DEFAULT_WALLPAPER_ID,
    'The shared key keeps a built-in stand-in that older versions accept');
  assert.ok(context.documentObj.documentElement.style.getPropertyValue('--x-nt-wallpaper-image')
    .includes(picked.thumbnailUrl), 'The photo shows its Picsum thumbnail until this device caches a copy');
  assert.strictEqual(ref('curatedSelectedTitle').textContent, `Photo by ${picked.name}`,
    'Bundled credits name the photographer');
  assert.strictEqual(ref('curatedSelectedLink').href, picked.sourceUrl);

  ref('curatedRefresh').click();
  assert.deepStrictEqual(getCuratedTileIds(control), nature.slice(9, 18).map((item) => item.id),
    'Showing others pages through the category without moving the chosen photo into it');
  getDescendantByAttribute(control, 'data-curated-category', 'city').click();
  await waitForAsyncWallpaperApply();
  assert.strictEqual(readPickedWallpaper(prefs), picked.id, 'Browsing another category keeps the wallpaper');
  assert.deepStrictEqual(getCuratedTileIds(control),
    remote.getCuratedWallpapers('city').slice(0, 9).map((item) => item.id));

  const daily = ref('curatedDailyToggle');
  daily.checked = true;
  daily.dispatchEvent(new context.windowObj.Event('change'));
  await waitForAsyncWallpaperApply();
  const todayCity = remote.getCuratedDailyWallpaper('city', Date.now());
  assert.strictEqual(readPickedWallpaper(prefs), 'curated-daily-city',
    'Daily mode syncs the category, so each device resolves the same photo for the date');
  assert.strictEqual(daily.checked, true);
  assert.strictEqual(getDescendantByAttribute(control, 'data-wallpaper-id', todayCity.id).getAttribute('data-selected'),
    'true', 'The list opens on the page that holds the daily photo');

  const shownBefore = context.documentObj.documentElement.style.getPropertyValue('--x-nt-wallpaper-image');
  getDescendantByAttribute(control, 'data-curated-category', 'water').click();
  await waitForAsyncWallpaperApply();
  assert.strictEqual(readPickedWallpaper(prefs), 'curated-daily-city', 'A category tab only browses, even with daily on');
  assert.strictEqual(context.documentObj.documentElement.style.getPropertyValue('--x-nt-wallpaper-image'), shownBefore,
    'Browsing another category keeps the wallpaper');
  daily.checked = false;
  daily.dispatchEvent(new context.windowObj.Event('change'));
  await waitForAsyncWallpaperApply();
  daily.checked = true;
  daily.dispatchEvent(new context.windowObj.Event('change'));
  await waitForAsyncWallpaperApply();
  assert.strictEqual(readPickedWallpaper(prefs), 'curated-daily-water',
    'Turning daily on uses the category on screen');

  const todayWater = remote.getCuratedDailyWallpaper('water', Date.now());
  const otherWater = getCuratedTileIds(control).find((tileId) => tileId !== todayWater.id);
  getDescendantByAttribute(control, 'data-wallpaper-id', otherWater).onclick();
  await waitForAsyncWallpaperApply();
  assert.strictEqual(readPickedWallpaper(prefs), 'curated-daily-water', 'Picking a photo keeps daily updates on');
  assert.strictEqual(daily.checked, true);
  assert.deepStrictEqual(clonePlain(prefs.data[DAILY_WALLPAPER_PICKS_STORAGE_KEY].picks),
    { 'curated-daily-water': otherWater }, 'The pick for today syncs with the daily choice');
  assert.ok(context.documentObj.documentElement.style.getPropertyValue('--x-nt-wallpaper-image')
    .includes(remote.wallpaperFromId(otherWater).thumbnailUrl), 'The picked photo shows instead of the scheduled one');
  assert.strictEqual(getDescendantByAttribute(control, 'data-wallpaper-id', otherWater).getAttribute('data-selected'), 'true');
  assert.strictEqual(ref('curatedDailyRestore').hidden, false, 'A restore button appears once today is overridden');

  ref('curatedDailyRestore').click();
  await waitForAsyncWallpaperApply();
  assert.strictEqual(prefs.data[DAILY_WALLPAPER_PICKS_STORAGE_KEY], '', 'Restoring drops the pick');
  assert.strictEqual(ref('curatedDailyRestore').hidden, true);
  assert.strictEqual(getDescendantByAttribute(control, 'data-wallpaper-id', todayWater.id).getAttribute('data-selected'),
    'true', 'Restoring shows the scheduled photo again');

  getDescendantByAttribute(control, 'data-wallpaper-id', otherWater).onclick();
  await waitForAsyncWallpaperApply();
  const stalePicks = createMemoryStorage(clonePlain(prefs.data));
  stalePicks.data[DAILY_WALLPAPER_PICKS_STORAGE_KEY] = { day: '2000-1-1', picks: { 'curated-daily-water': otherWater } };
  const nextDay = createCuratedRuntime(stalePicks);
  await nextDay.runtime.bootstrapInitialWallpaper();
  await waitForAsyncWallpaperApply();
  assert.ok(nextDay.context.documentObj.documentElement.style.getPropertyValue('--x-nt-wallpaper-image')
    .includes(todayWater.thumbnailUrl), 'A pick from another day no longer counts');

  daily.checked = false;
  daily.dispatchEvent(new context.windowObj.Event('change'));
  await waitForAsyncWallpaperApply();
  assert.strictEqual(readPickedWallpaper(prefs), otherWater,
    'Turning off daily keeps the photo on screen, including today\'s pick');

  const second = createCuratedRuntime(prefs);
  await second.runtime.bootstrapInitialWallpaper();
  second.runtime.createControls();
  await waitForAsyncWallpaperApply();
  const restored = second.runtime.getControlElement();
  restored.querySelector('.x-nt-wallpaper-button').click();
  await waitForAsyncWallpaperApply();
  assert.ok(getDescendantByAttribute(restored, 'data-active-tab', 'curated'),
    'Another device opens the curated source for a synced curated pick');
  assert.strictEqual(getDescendantByAttribute(restored, 'data-curated-category', 'water').getAttribute('data-active'),
    'true', 'The list shows the category of the synced photo');
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
  const remote = require('../src/newtab/remote-content.js');
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
  const control = runtime.getControlElement();
  const image = () => context.documentObj.documentElement.style.getPropertyValue('--x-nt-wallpaper-image');
  control.querySelector('.x-nt-wallpaper-button').click();
  getDescendantByAttribute(control, 'data-wallpaper-tab', 'curated').click();
  getDescendantByAttribute(control, 'data-curated-category', 'art').click();
  await waitForAsyncWallpaperApply();
  const [first, second] = remote.getCuratedWallpapers('art');
  assert.strictEqual(getCuratedTileIds(control)[0], first.id);
  assert.ok(getDescendantByAttribute(control, 'data-wallpaper-id', first.id).getAttribute('data-thumbnail-url')
    .endsWith('_web.jpg'), 'Tiles use the museum web image');

  getDescendantByAttribute(control, 'data-wallpaper-id', first.id).onclick();
  await waitForAsyncWallpaperApply();
  await waitForAsyncWallpaperApply();
  assert.strictEqual(readPickedWallpaper(prefs), first.id, 'A painting syncs as its ID alone');
  assert.deepStrictEqual(requests, [first.imageUrl], 'The print downloads once');
  assert.ok(cache.images.has(first.id), 'The downscaled print is cached on this device');
  assert.ok(image().includes('data:image/webp;base64,bGluaw=='), 'The wallpaper shows the cached copy');
  const ref = (name) => getDescendantByAttribute(control, 'data-wallpaper-ref', name);
  assert.strictEqual(ref('curatedSelectedTitle').textContent, first.title, 'Paintings are credited by title');
  assert.ok(ref('curatedSelectedMeta').textContent.includes('The Cleveland Museum of Art'));
  assert.strictEqual(ref('curatedSelectedLink').href, first.sourceUrl);

  getDescendantByAttribute(control, 'data-wallpaper-id', second.id).onclick();
  await waitForAsyncWallpaperApply();
  await waitForAsyncWallpaperApply();
  assert.deepStrictEqual(Array.from(cache.images.keys()), [second.id],
    'A print no mode shows is dropped, so daily art does not pile up');

  const preload = JSON.parse(context.windowObj.localStorage.getItem(WALLPAPER_PRELOAD_STORAGE_KEY));
  assert.strictEqual(preload.wallpapers.light, null, 'The first frame never loads a multi-megabyte print');
}

async function testCuratedPhotoOpensNewTabsFromTheCachedCopy() {
  const remote = require('../src/newtab/remote-content.js');
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
  const control = runtime.getControlElement();
  control.querySelector('.x-nt-wallpaper-button').click();
  getDescendantByAttribute(control, 'data-wallpaper-tab', 'curated').click();
  getDescendantByAttribute(control, 'data-curated-category', 'nature').click();
  await waitForAsyncWallpaperApply();
  const photo = remote.getCuratedWallpapers('nature')[0];
  getDescendantByAttribute(control, 'data-wallpaper-id', photo.id).onclick();
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
  const remote = require('../src/newtab/remote-content.js');
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
  const remote = require('../src/newtab/remote-content.js');
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
  const remote = require('../src/newtab/remote-content.js');
  const prefs = createMemoryStorage({ [WALLPAPER_STORAGE_KEY]: DEFAULT_WALLPAPER_ID });
  const { context, runtime } = createCuratedRuntime(prefs);
  await runtime.bootstrapInitialWallpaper();
  runtime.createControls();
  const control = runtime.getControlElement();
  control.querySelector('.x-nt-wallpaper-button').click();
  getDescendantByAttribute(control, 'data-wallpaper-tab', 'curated').click();
  await waitForAsyncWallpaperApply();
  const daily = getDescendantByAttribute(control, 'data-wallpaper-ref', 'curatedDailyToggle');
  daily.checked = true;
  daily.dispatchEvent(new context.windowObj.Event('change'));
  await waitForAsyncWallpaperApply();
  assert.strictEqual(readPickedWallpaper(prefs), 'curated-daily-random', 'Daily updates can draw from every category');
  const today = remote.getCuratedDailyWallpaper('random', Date.now());

  const other = createCuratedRuntime(prefs);
  await other.runtime.bootstrapInitialWallpaper();
  other.runtime.createControls();
  const otherControl = other.runtime.getControlElement();
  otherControl.querySelector('.x-nt-wallpaper-button').click();
  await waitForAsyncWallpaperApply();
  assert.strictEqual(getDescendantByAttribute(otherControl, 'data-curated-category', 'random').getAttribute('data-active'),
    'true', 'A random daily choice reopens on the random mix, not on the photo\'s own category');
  assert.strictEqual(getDescendantByAttribute(otherControl, 'data-wallpaper-id', today.id).getAttribute('data-selected'),
    'true', 'The mix opens on the page that holds today\'s photo');
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
  const control = runtime.getControlElement();
  const ref = (name) => getDescendantByAttribute(control, 'data-wallpaper-ref', name);
  control.querySelector('.x-nt-wallpaper-button').click();
  getDescendantByAttribute(control, 'data-wallpaper-tab', 'local').click();
  ref('urlTile').click();
  await waitForAsyncWallpaperApply();
  assert.strictEqual(ref('urlForm').hidden, false, 'The link tile opens the link form');
  const submit = () => ref('urlForm').dispatchEvent({ type: 'submit', preventDefault() {} });

  ref('urlInput').value = 'javascript:alert(1)';
  submit();
  assert.strictEqual(requests.length, 0, 'Only web links are fetched');
  assert.strictEqual(ref('urlInput').getAttribute('aria-invalid'), 'true');
  assert.ok(toasts.some((toast) => toast.isError));

  const url = 'https://images.example/photos/Lake%20View.JPG';
  ref('urlInput').value = ` ${url} `;
  submit();
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
  assert.strictEqual(ref('urlForm').hidden, true, 'A successful import closes the form');
  assert.strictEqual(ref('urlInput').value, '');
  assert.ok(getDescendantByAttribute(control, 'data-wallpaper-id', linkId), 'The link appears among local tiles');

  ref('urlTile').click();
  await waitForAsyncWallpaperApply();
  assert.strictEqual(runtime.closeOpenMenu(), true, 'Escape closes the link form before the panel');
  assert.strictEqual(ref('urlForm').hidden, true);
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

  getDescendantByAttribute(control, 'data-wallpaper-id', linkId)
    .querySelector('.x-nt-wallpaper-delete-button').click();
  await waitForAsyncWallpaperApply();
  assert.deepStrictEqual(JSON.parse(JSON.stringify(prefs.data[LINK_WALLPAPERS_STORAGE_KEY])), [],
    'Deleting a link removes it from every synced device');
  assert.strictEqual(readPickedWallpaper(prefs), DEFAULT_WALLPAPER_ID, 'A deleted selected link falls back to the default');
  assert.strictEqual(cache.images.has(linkId), false);
}

Promise.resolve()
  .then(() => {
    assertBrandMarkCopy();
    assertThemeAwareAlternateFaviconAsset();
    assertSquareFaviconOptionCss('newtab.html');
    assertSegmentedTabRadiusCss('newtab.html');
    assertEffectSelectCss('newtab.html');
    assertWallpaperBootstrapWaitsForTheme();
    assertInitialWallpaperToneStartsBeforeDeferredRefresh();
  })
  .then(testBingDailySelectionAndManualOverride)
  .then(testLegacyOnlineWallpaperMigratesToBing)
  .then(testUnrecognizedSyncedWallpaperIsNotWrittenBack)
  .then(testOnlineWallpaperSurvivesOlderVersions)
  .then(testCuratedWallpapersSyncAsIdsAndRotateDaily)
  .then(testLinkedWallpaperSyncsItsUrlAndCachesTheImage)
  .then(testRandomDailyWallpaperReopensOnTheRandomMix)
  .then(testCuratedArtCachesOneDownscaledPrintPerDevice)
  .then(testCuratedPhotoOpensNewTabsFromTheCachedCopy)
  .then(testNetworkWallpaperWaitsForThePageAndFallsBackOffline)
  .then(testBingPhotoOpensNewTabsFromTheCachedCopy)
  .then(testWallpaperSourcesHintWaitsForFinalFocusRoute)
  .then(testNewtabFaviconPreloadAppliesCachedAlternateBeforeMainRuntime)
  .then(testWallpaperPreloadUsesTheCachedResolvedMode)
  .then(testBuiltInWallpaperBootstrapDefersCustomCatalogRead)
  .then(testWallpaperTileIntentReusesDecodedImagePromise)
  .then(testRapidWallpaperSelectionNeverAppliesStaleDecode)
  .then(testSyncedCustomWallpaperWithoutLocalRecordFallsBackToDefault)
  .then(testLegacySyncedCustomWallpaperMigratesToLocalOnlySelection)
  .then(testInitialThemeResolutionDoesNotPaintFallbackBeforeCustomWallpaper)
  .then(testWallpaperModeConsistencyDefaultsOnAndCopiesLegacySelectionWhenDisabled)
  .then(testDisablingWallpaperModeConsistencyIgnoresStaleLocalDisabledOverride)
  .then(testSplitBuiltInWallpaperSelectionFollowsResolvedTheme)
  .then(testWallpaperPreloadCacheRetainsMinimumLightOverlay)
  .then(testSplitLocalWallpaperSelectionStaysLocalOnly)
  .then(testDeletingLocalWallpapersKeepsTheLocalTabOpen)
  .then(testNewtabFaviconOptionsRenderBelowLogoAndPersistSelection)
  .then(testNewtabFaviconThemeBroadcastRefreshesBackgroundTabs)
  .then(testWallpaperEffectInkToneControlPersistsAndFollowsEffectType)
  .then(testBlocksExposeReliefControls)
  .then(testEffectSpecificParametersRoundTrip)
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
