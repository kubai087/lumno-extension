import { afterEach } from 'vitest';

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

afterEach(() => {
  document.body.replaceChildren();
});
