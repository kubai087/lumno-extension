// A page the selection toolbar's content script runs in: a Chinese article
// with links, buttons, text controls and sensitive fields, an in-memory
// browser whose UI language is zh-CN, fixed selection geometry, and fake
// timers. bootSelectionToolbar() runs the script fresh; a test drives
// selections like a reader would and reads the toolbar through its closed
// shadow root.
import { afterEach, vi } from 'vitest';
import zhCnMessages from '../../_locales/zh_CN/messages.json';
import { createBrowserFake } from './browser';
import type { BrowserFake } from './browser';
import { required } from './dom';

export const HOST_ID = '_x_extension_selection_quick_actions_host_2026_unique_';
export const TOAST_HOST_ID = '_x_extension_selection_quick_actions_toast_host_2026_unique_';
export const ENABLED_KEY = '_x_extension_selection_quick_actions_enabled_2026_unique_';
export const TRIGGER_STYLE_KEY = '_x_extension_selection_quick_actions_trigger_style_2026_unique_';
export const ICON_SET_KEY = '_x_extension_selection_quick_actions_icon_set_2026_unique_';
export const LANGUAGE_KEY = '_x_extension_language_2024_unique_';

// Page CSS that tries to hide, move and restyle the toolbar's host.
const HOSTILE_HOST_CSS = `#${HOST_ID} {
  all: unset !important; display: none !important; position: static !important; z-index: -1 !important;
  margin: 120px !important; padding: 120px !important; opacity: 0 !important; visibility: hidden !important;
  pointer-events: none !important; transform: scale(0.1) !important; filter: blur(20px) !important;
}`;

const ARTICLE = '今年初，一款名为 Bookology 的读书管理应用进入我的视野，它集合了我需要的原本分散在各个读书应用中的功能。总结来说，Bookology 将书籍管理、阅读进度、阅读笔记和数据统计整合在一个简洁的数字书架中，在这一个 App 中就可以建立专属于我自己的阅读档案。';

const PAGE_BODY = `
  <style>${HOSTILE_HOST_CSS}</style>
  <p id="copy">serendipity</p>
  <p id="question">How should I structure this rollout?</p>
  <p id="article-paragraph">${ARTICLE}</p>
  <p><span id="generic-context"><em id="generic">React</em> trailing text</span></p>
  <p id="cjk">这是你需要的资料</p>
  <div id="dark-context" style="background-color: rgb(20, 24, 32);"><span id="dark-copy">serendipity</span></div>
  <button id="selectable-button" type="button">Why is this unavailable?</button>
  <a id="selectable-link" href="#selected-link">React components</a>
  <span id="selectable-role-button" role="button" tabindex="0">React components</span>
  <span id="selectable-custom" tabindex="0">React components</span>
  <div id="selectable-editable" contenteditable="true">React components</div>
  <input id="selectable-input" type="text" value="React components">
  <textarea id="selectable-textarea">Why is this unavailable?</textarea>
  <input id="sensitive-password" type="password" value="secret token">
  <input id="sensitive-payment" type="text" autocomplete="cc-number" value="4111111111111111">
  <article id="x-post"><div><span id="x-body">为什么这条来自 X 的帖子无法加载？</span> <a href="https://t.co/example">https://t.co/example</a></div></article>`;

const TEXT_CONTROL_IDS = ['selectable-input', 'selectable-textarea', 'sensitive-password', 'sensitive-payment'];

export interface AnimationRecord {
  target: Element;
  keyframes: Keyframe[];
  options: KeyframeAnimationOptions;
  cancelled: boolean;
}

type ActionReply = { ok: boolean } | 'defer';
type ReplyCallback = (response: unknown) => void;

interface BootOptions {
  sync?: Record<string, unknown>;
  local?: Record<string, unknown>;
  // Whether the engine has Web Animations (Element.animate).
  webAnimations?: boolean;
  visualViewport?: boolean;
}

const zhMessages: Record<string, { message: string }> = zhCnMessages;
const restorers: Array<() => void> = [];
let current: { browser: BrowserFake } | null = null;

// Replaces a property for the rest of the test.
export function patchProperty(target: object, key: PropertyKey, descriptor: PropertyDescriptor): void {
  const original = Object.getOwnPropertyDescriptor(target, key);
  Object.defineProperty(target, key, { configurable: true, ...descriptor });
  restorers.push(() => {
    if (original) {
      Object.defineProperty(target, key, original);
    } else {
      Reflect.deleteProperty(target, key);
    }
  });
}

export function rect(left: number, top: number, width: number, height: number): DOMRect {
  return new DOMRect(left, top, width, height);
}

function rangeElement(range: Range): Element | null {
  const node = range.commonAncestorContainer;
  return node instanceof Element ? node : node.parentElement;
}

function installGeometry(): void {
  patchProperty(Range.prototype, 'getBoundingClientRect', {
    value(this: Range) {
      const element = rangeElement(this);
      return element && element.id === 'copy' ? rect(20, 26, 880, 62) : rect(20, 26, 90, 18);
    }
  });
  patchProperty(Range.prototype, 'getClientRects', {
    value(this: Range) {
      const element = rangeElement(this);
      if (element && element.id === 'generic') return [rect(20, 70, 50, 18)];
      if (element && element.id === 'copy') return [rect(20, 26, 880, 18), rect(20, 70, 90, 18)];
      return [];
    }
  });
  patchProperty(HTMLElement.prototype, 'getBoundingClientRect', { value: () => rect(0, 0, 0, 0) });
  TEXT_CONTROL_IDS.forEach((id, index) => {
    patchProperty(required(document.getElementById(id), id), 'getBoundingClientRect', {
      value: () => rect(20, 164 + index * 28, 220, 24)
    });
  });
}

function installAnimations(animations: AnimationRecord[]): void {
  patchProperty(Element.prototype, 'animate', {
    value(this: Element, keyframes: Keyframe[], options: KeyframeAnimationOptions) {
      const record: AnimationRecord = { target: this, keyframes, options, cancelled: false };
      animations.push(record);
      return { cancel() { record.cancelled = true; } };
    }
  });
}

function installVisualViewport(): EventTarget & { width: number; height: number; offsetLeft: number; offsetTop: number } {
  const viewport = Object.assign(new EventTarget(), { width: 1024, height: 768, offsetLeft: 0, offsetTop: 0 });
  patchProperty(window, 'visualViewport', { value: viewport });
  return viewport;
}

function renderPage(): void {
  document.documentElement.lang = 'zh-CN';
  const parsed = new DOMParser().parseFromString(`<body>${PAGE_BODY}</body>`, 'text/html');
  Array.from(parsed.body.childNodes).forEach((node) => document.body.appendChild(document.importNode(node, true)));
}

function isActionRequest(message: unknown): boolean {
  return typeof message === 'object' && message !== null && 'action' in message && message.action === 'runSelectionQuickAction';
}

export async function flush(ms = 0): Promise<void> {
  await vi.advanceTimersByTimeAsync(ms);
}

function pointer(type: string, x: number, y: number): MouseEvent {
  return new MouseEvent(type, { bubbles: true, button: 0, clientX: x, clientY: y });
}

export async function bootSelectionToolbar(options: BootOptions = {}) {
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'requestAnimationFrame', 'cancelAnimationFrame'] });
  renderPage();
  const browser = createBrowserFake({
    sync: { [ENABLED_KEY]: true, ...options.sync },
    local: options.local
  });
  browser.i18n.getMessage = (key: string) => (zhMessages[key] ? zhMessages[key].message : '');
  browser.i18n.getUILanguage = () => 'zh-CN';
  const actionReplies: ActionReply[] = [];
  const pendingReplies: ReplyCallback[] = [];
  browser.runtime.sendMessage.mockImplementation((message: unknown, callback?: ReplyCallback) => {
    const reply: ActionReply = isActionRequest(message) && actionReplies.length ? actionReplies.shift() || { ok: true } : { ok: true };
    if (reply === 'defer') {
      if (callback) pendingReplies.push(callback);
      return undefined;
    }
    if (callback) queueMicrotask(() => callback(reply));
    return undefined;
  });
  current = { browser };

  let reduceMotion = false;
  vi.stubGlobal('chrome', browser);
  vi.stubGlobal('matchMedia', (query: string) => ({ matches: reduceMotion && query === '(prefers-reduced-motion: reduce)', media: query }));
  const resizeObserver: { callback: ResizeObserverCallback | null; target: Element | null } = { callback: null, target: null };
  vi.stubGlobal('ResizeObserver', class {
    constructor(callback: ResizeObserverCallback) { resizeObserver.callback = callback; }
    observe(target: Element) { resizeObserver.target = target; }
    disconnect() {}
  });
  installGeometry();
  const animations: AnimationRecord[] = [];
  if (options.webAnimations !== false) {
    installAnimations(animations);
  }
  const visualViewport = options.visualViewport ? installVisualViewport() : null;

  const shadows = new Map<string, ShadowRoot>();
  const attachShadow = Element.prototype.attachShadow;
  vi.spyOn(Element.prototype, 'attachShadow').mockImplementation(function (this: Element, init: ShadowRootInit) {
    const root = attachShadow.call(this, init);
    shadows.set(this.id, root);
    return root;
  });

  Reflect.deleteProperty(globalThis, '__lumnoContent');
  vi.resetModules();
  await import('../../src/content/selection-quick-actions');
  await flush();

  const host = () => document.getElementById(HOST_ID);
  const shadow = () => required(shadows.get(HOST_ID), 'the toolbar shadow root');
  const query = (selector: string) => required(shadow().querySelector(selector), selector);

  // A pointer selection of an element's text, as a reader drags over it.
  async function selectText(element: Element, selectOptions: { clickAfterPointerUp?: boolean } = {}): Promise<void> {
    document.dispatchEvent(new Event('copy', { bubbles: true }));
    const selection = required(window.getSelection(), 'selection');
    selection.removeAllRanges();
    element.dispatchEvent(pointer('pointerdown', 20, 150));
    const range = document.createRange();
    range.selectNodeContents(element);
    selection.addRange(range);
    element.dispatchEvent(pointer('pointerup', 150, 150));
    if (selectOptions.clickAfterPointerUp && element instanceof HTMLElement) {
      element.click();
    }
    await flush(460);
  }

  async function selectControl(element: HTMLInputElement | HTMLTextAreaElement, start: number, end: number, beforePointerUp?: () => void): Promise<void> {
    document.dispatchEvent(new Event('copy', { bubbles: true }));
    required(window.getSelection(), 'selection').removeAllRanges();
    element.focus();
    element.setSelectionRange(0, 0);
    element.dispatchEvent(pointer('pointerdown', 36, 176));
    element.setSelectionRange(start, end);
    if (beforePointerUp) beforePointerUp();
    element.dispatchEvent(pointer('pointerup', 164, 176));
    await flush(460);
  }

  // The toolbar's actions, in order, after opening it from the entry.
  function openToolbar(): HTMLElement[] {
    const main = query('.lumno-selection-main');
    if (main instanceof HTMLElement) main.click();
    return Array.from(shadow().querySelectorAll('.lumno-selection-toolbar [data-intent]')).filter((node) => node instanceof HTMLElement);
  }

  // Boxes for the entry (18 px at 300, 66) and the open toolbar (240 px
  // wide, starting at expandedLeft); JSDOM lays nothing out.
  function stubToolbarGeometry(expandedLeft = 300): void {
    const surface = query('.lumno-selection-surface');
    const main = query('.lumno-selection-main');
    const iconOnly = (element: Element) => element instanceof HTMLElement && element.dataset.iconOnly === 'true';
    patchProperty(surface, 'getBoundingClientRect', {
      value: () => (iconOnly(surface) ? rect(300, 66, 18, 18) : rect(expandedLeft, 66, 240, 38))
    });
    patchProperty(main, 'getBoundingClientRect', {
      value: () => (iconOnly(main) ? rect(300, 66, 18, 18) : rect(506, 70, 30, 30))
    });
  }

  return {
    browser,
    animations,
    resizeObserver,
    visualViewport,
    pendingReplies,
    host,
    shadow,
    query,
    toastShadow: () => required(shadows.get(TOAST_HOST_ID), 'the toast shadow root'),
    selectText,
    selectControl,
    openToolbar,
    pointer,
    setReducedMotion(value: boolean) { reduceMotion = value; },
    replyToActions(...replies: ActionReply[]) { actionReplies.push(...replies); },
    messages: () => browser.runtime.sendMessage.mock.calls.map(([message]) => message),
    stubToolbarGeometry,
    // A change made in another page, or by another copy of the extension.
    storageChange(values: Record<string, unknown>, area: 'sync' | 'local' = 'sync') {
      browser.storage[area].externalSet(values);
    }
  };
}

export type SelectionToolbarPage = Awaited<ReturnType<typeof bootSelectionToolbar>>;

afterEach(async () => {
  if (current) {
    // Turning the feature off detaches the script's page listeners.
    current.browser.storage.sync.externalSet({ [ENABLED_KEY]: false });
    current = null;
    await flush();
  }
  restorers.splice(0).reverse().forEach((restore) => restore());
  document.querySelectorAll(`[id="${HOST_ID}"], [id="${TOAST_HOST_ID}"]`).forEach((element) => element.remove());
  document.documentElement.removeAttribute('lang');
  vi.useRealTimers();
  vi.unstubAllGlobals();
});
