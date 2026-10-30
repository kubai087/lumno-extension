import { vi } from 'vitest';

class FakeAnimationPlaybackEvent extends Event implements AnimationPlaybackEvent {
  readonly currentTime: CSSNumberish | null = null;
  readonly timelineTime: CSSNumberish | null = null;
}

// An Animation for tests, where jsdom has none. Its methods are spies that
// do nothing; a test ends it with emitFinish or emitCancel, which call the
// handlers the code under test set.
export class FakeAnimation extends EventTarget implements Animation {
  currentTime: CSSNumberish | null = null;
  effect: AnimationEffect | null = null;
  id = '';
  oncancel: ((this: Animation, event: AnimationPlaybackEvent) => unknown) | null = null;
  onfinish: ((this: Animation, event: AnimationPlaybackEvent) => unknown) | null = null;
  onremove: ((this: Animation, event: Event) => unknown) | null = null;
  readonly pending = false;
  playState: AnimationPlayState = 'running';
  playbackRate = 1;
  readonly replaceState: AnimationReplaceState = 'active';
  startTime: CSSNumberish | null = null;
  timeline: AnimationTimeline | null = null;
  readonly finished: Promise<Animation>;
  readonly ready: Promise<Animation>;
  private readonly resolveFinished: (animation: Animation) => void;

  cancel = vi.fn<() => void>();
  commitStyles = vi.fn<() => void>();
  finish = vi.fn<() => void>();
  pause = vi.fn<() => void>();
  persist = vi.fn<() => void>();
  play = vi.fn<() => void>();
  reverse = vi.fn<() => void>();
  updatePlaybackRate = vi.fn<(playbackRate: number) => void>();

  constructor() {
    super();
    let resolveFinished: (animation: Animation) => void = () => {};
    this.finished = new Promise<Animation>((resolve) => {
      resolveFinished = resolve;
    });
    this.resolveFinished = resolveFinished;
    this.ready = Promise.resolve(this);
  }

  emitFinish(): void {
    this.playState = 'finished';
    this.onfinish?.call(this, new FakeAnimationPlaybackEvent('finish'));
    this.resolveFinished(this);
  }

  emitCancel(): void {
    this.playState = 'idle';
    this.oncancel?.call(this, new FakeAnimationPlaybackEvent('cancel'));
  }
}
