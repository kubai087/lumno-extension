import { afterAll, afterEach } from 'vitest';

declare global {
  // Tells React that tests drive updates through act().
  var IS_REACT_ACT_ENVIRONMENT: boolean | undefined;
}

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

// JSDOM has no AnimationEvent but knows the prefixed WebkitAnimation style,
// so React DOM would listen for webkitAnimationEnd instead of animationend.
// Chrome has AnimationEvent; give JSDOM one before React DOM loads.
if (typeof window.AnimationEvent !== 'function') {
  class AnimationEventShim extends Event implements AnimationEvent {
    readonly animationName: string;
    readonly elapsedTime: number;
    readonly pseudoElement: string;

    constructor(type: string, init: AnimationEventInit = {}) {
      super(type, init);
      this.animationName = init.animationName ?? '';
      this.elapsedTime = init.elapsedTime ?? 0;
      this.pseudoElement = init.pseudoElement ?? '';
    }
  }
  window.AnimationEvent = AnimationEventShim;
}

// Tests run offline: a request that no test answered fails as it would
// without a connection, instead of reaching the network. A test that needs an
// answer stubs fetch (vi.stubGlobal), and unstubbing comes back to this.
globalThis.fetch = async (input) => {
  const url = input instanceof Request ? input.url : String(input);
  throw new TypeError(`Failed to fetch ${url} (tests run offline)`);
};

// JSDOM's selector engine adds window listeners (focus, keys, mouse) the first
// time the document runs a selector, and reads :hover and :focus-visible from
// them for the document's lifetime. Start it here, before any test: a page
// boot that removes the listeners added while its page ran would otherwise
// take the engine's with them, and :hover would never match again in the file.
document.querySelector('*');

afterEach(() => {
  document.body.replaceChildren();
});

// Timers the file's code started and left running are cleared once its tests
// are done. A page or runtime under test may still have one due as the file's
// environment is torn down, and it would then run against a window that is
// gone. Fake timers replace these while a test uses them, and give them back
// after.
const fileTimers = new Set<ReturnType<typeof setTimeout>>();
const startTimeout = globalThis.setTimeout;
const startInterval = globalThis.setInterval;

Reflect.set(globalThis, 'setTimeout', (handler: unknown, ms?: number, ...args: unknown[]) => {
  const id = startTimeout(() => {
    fileTimers.delete(id);
    if (typeof handler === 'function') Reflect.apply(handler, undefined, args);
  }, ms);
  fileTimers.add(id);
  return id;
});
Reflect.set(globalThis, 'setInterval', (handler: unknown, ms?: number, ...args: unknown[]) => {
  const id = startInterval(() => {
    if (typeof handler === 'function') Reflect.apply(handler, undefined, args);
  }, ms);
  fileTimers.add(id);
  return id;
});

afterAll(() => {
  fileTimers.forEach((id) => {
    clearTimeout(id);
    clearInterval(id);
  });
  fileTimers.clear();
});
