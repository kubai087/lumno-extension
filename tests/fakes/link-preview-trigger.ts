// The link preview trigger (src/content/link-preview-trigger.ts) started in
// the test document as a page at a given address, with the window listeners
// it adds kept here: jsdom events are never trusted, so a test hands the
// listeners the events of a real press itself, the way Chrome orders them.
import { afterEach, vi } from 'vitest';
import { installWorkerFake } from './worker';
import type { WorkerFakeOptions } from './worker';

interface TriggerOptions extends Pick<WorkerFakeOptions, 'sync' | 'local'> {
  url?: string;
  body?: string;
  // The page's Navigation API.
  navigation?: object;
  // Run as the page inside the preview's own frame.
  previewFrame?: boolean;
}

interface AddedListener {
  target: string;
  type: string;
  listener: EventListenerOrEventListenerObject;
}

interface PressOptions extends Record<string, unknown> {
  // Event types left out of the press.
  skip?: string[];
  // Shift let go before the click.
  shiftOnClick?: boolean;
}

const LINKS = `
  <a id="out" href="https://other.example/page">out</a>
  <a id="hash" href="#section">hash</a>
  <a id="file" href="https://other.example/file.zip" download>file</a>
  <a id="mail" href="mailto:a@example.com">mail</a>`;

function importMarkup(html: string, into: Element): void {
  const parsed = new DOMParser().parseFromString(`<body>${html}</body>`, 'text/html');
  into.replaceChildren(...Array.from(parsed.body.childNodes, (node) => document.importNode(node, true)));
}

function recordListeners(target: EventTarget, name: string, added: AddedListener[]): void {
  vi.spyOn(target, 'addEventListener').mockImplementation((type, listener) => {
    if (listener) added.push({ target: name, type, listener });
  });
  vi.spyOn(target, 'removeEventListener').mockImplementation((type, listener) => {
    const index = added.findIndex((entry) => entry.target === name && entry.type === type && entry.listener === listener);
    if (index >= 0) added.splice(index, 1);
  });
}

function callListener(entry: AddedListener, event: object): void {
  if (typeof entry.listener === 'function') {
    Reflect.apply(entry.listener, window, [event]);
  } else {
    Reflect.apply(entry.listener.handleEvent, entry.listener, [event]);
  }
}

const stops: (() => void)[] = [];

afterEach(() => {
  stops.splice(0).forEach((stop) => stop());
});

async function loadLinkPreviewTrigger(options: TriggerOptions = {}) {
  const url = options.url || 'https://docs.example.test/page';
  const fake = installWorkerFake({ sync: options.sync, local: options.local });
  const parentMessages: unknown[] = [];
  const assign = vi.fn();
  vi.stubGlobal('__lumnoContent', undefined);
  vi.stubGlobal('location', Object.assign(new URL(url), { assign, reload: vi.fn() }));
  if (options.navigation) vi.stubGlobal('navigation', options.navigation);
  if (options.previewFrame) {
    const parent = { postMessage: (message: unknown) => parentMessages.push(message) };
    vi.stubGlobal('top', parent);
    vi.stubGlobal('parent', parent);
    vi.stubGlobal('name', 'lumno-link-preview');
  }
  const base = document.createElement('base');
  base.href = url;
  document.head.replaceChildren(base);
  importMarkup(`${options.previewFrame ? '' : LINKS}${options.body || ''}`, document.body);
  const added: AddedListener[] = [];
  recordListeners(window, 'window', added);
  recordListeners(document, 'document', added);
  await import('../../src/content/link-preview-trigger');
  // The same runtime instance, which ends this trigger after the test.
  const runtime = await import('../../src/content/link-preview-trigger-runtime');
  stops.push(runtime.cleanup);

  const element = (id: string) => document.getElementById(id);
  const pathOf = (target: Node | null) => {
    const path: unknown[] = [];
    for (let node = target; node; node = node.parentNode) path.push(node);
    return path.concat(window);
  };
  const dispatch = (type: string, event: object) => {
    added.filter((entry) => entry.target === 'window' && entry.type === type).forEach((entry) => callListener(entry, event));
  };
  // The page's claim on each event type of the last press.
  const claimed: string[] = [];

  return {
    fake,
    added,
    claimed,
    parentMessages,
    assign,
    // What the trigger sent the worker.
    sent: () => fake.chrome.runtime.sendMessage.mock.calls.map(([message]) => message),
    clearSent: () => fake.chrome.runtime.sendMessage.mockClear(),
    // One press at an element, in Chrome's order; answers the types whose
    // default was prevented.
    press(id: string, pressOptions: PressOptions = {}) {
      const target = element(id);
      const prevented: string[] = [];
      claimed.length = 0;
      const { skip = [], shiftOnClick, ...overrides } = pressOptions;
      ['pointerdown', 'mousedown', 'pointerup', 'mouseup', 'click'].filter((type) => !skip.includes(type)).forEach((type) => {
        dispatch(type, {
          type,
          isTrusted: true,
          button: 0,
          shiftKey: true,
          ctrlKey: false,
          metaKey: false,
          altKey: false,
          clientX: 30,
          clientY: 40,
          target,
          composedPath: () => pathOf(target),
          preventDefault: () => prevented.push(type),
          stopImmediatePropagation: () => claimed.push(type),
          ...overrides,
          ...(type === 'click' && shiftOnClick === false ? { shiftKey: false } : {})
        });
      });
      return prevented;
    },
    // One event at an element (or the window), with Shift held unless
    // the options say not.
    fire(type: string, id: string | null, eventOptions: Record<string, unknown> = {}) {
      const target = id ? element(id) : null;
      dispatch(type, {
        type,
        isTrusted: true,
        pointerType: 'mouse',
        shiftKey: true,
        ctrlKey: false,
        metaKey: false,
        altKey: false,
        repeat: false,
        target,
        relatedTarget: null,
        composedPath: () => pathOf(target),
        ...eventOptions
      });
    }
  };
}

type LinkPreviewTriggerPage = Awaited<ReturnType<typeof loadLinkPreviewTrigger>>;

export { loadLinkPreviewTrigger };
export type { LinkPreviewTriggerPage };
