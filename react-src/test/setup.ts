import { afterEach } from 'vitest';

(globalThis as typeof globalThis & {
  IS_REACT_ACT_ENVIRONMENT?: boolean;
}).IS_REACT_ACT_ENVIRONMENT = true;

// JSDOM has no AnimationEvent but knows the prefixed WebkitAnimation style,
// so React DOM would listen for webkitAnimationEnd instead of animationend.
// Chrome has AnimationEvent; give JSDOM one before React DOM loads.
if (typeof window.AnimationEvent !== 'function') {
  class AnimationEventShim extends Event {
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
  window.AnimationEvent = AnimationEventShim as typeof AnimationEvent;
}

afterEach(() => {
  document.body.replaceChildren();
});
