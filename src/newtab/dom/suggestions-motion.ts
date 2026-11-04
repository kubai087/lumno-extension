// Eases the New Tab search results as they open, close and change height.
// The backplate (surface), its outline and the rows (content) are separate
// fixed layers. They move together through the Web Animations API, so the
// list's own layout box and its hit tests never change.
//
// Nothing plays while the system or Lumno's settings turn motion off, and
// turning it off mid-way stops what is playing. An animation that is cut
// short hands where it was drawn to the next one, which starts from there.
interface SuggestionsMotionLayers {
  content: HTMLElement;
  surface: HTMLElement | null;
  outline: HTMLElement | null;
}

interface AnimatableLayers extends SuggestionsMotionLayers {
  surface: HTMLElement;
  outline: HTMLElement;
}

// Where an interrupted animation left the layers.
interface SuggestionsMotionSnapshot {
  height: number;
  contentOpacity: string;
  contentTransform: string;
  contentClip: string;
  surfaceOpacity: string;
}

interface SuggestionsMotion {
  // Where the playing animation has the layers now; null when none plays.
  capture(layers: SuggestionsMotionLayers): SuggestionsMotionSnapshot | null;
  cancel(): void;
  // Opens the list from the input's height, or closes it back to it.
  play(
    open: boolean,
    layers: SuggestionsMotionLayers,
    collapsedHeight: number,
    previous: SuggestionsMotionSnapshot | null
  ): void;
  // Follows a change of the open list's height.
  resize(layers: SuggestionsMotionLayers, fromHeight: number, toHeight: number, anchorHeight: number): void;
}

interface MotionTiming {
  duration: number;
  easing: string;
}

// The surface's target height, which the layout writes with its frame.
const SUGGESTIONS_MOTION_HEIGHT_PROPERTY = '--x-nt-suggestions-motion-height';
const MOTION_EFFECTS_ATTRIBUTE = 'data-lumno-motion-effects';
const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)';

const OPEN_TIMING: MotionTiming = { duration: 260, easing: 'cubic-bezier(0.16, 1, 0.3, 1)' };
const CLOSE_TIMING: MotionTiming = { duration: 190, easing: 'cubic-bezier(0.4, 0, 0.8, 0.4)' };
const RESIZE_TIMING: MotionTiming = { duration: 160, easing: 'cubic-bezier(0.22, 1, 0.36, 1)' };
// The rows drop in from just above, and lift a little as they leave.
const OPEN_CONTENT_OFFSET_PX = -6;
const CLOSE_CONTENT_OFFSET_PX = -4;
// A closing backplate stays above the page blocks it fades over.
const CLOSING_Z_INDEX = '11';
const MIN_RESIZE_PX = 1;

function px(value: number): string {
  return `${value}px`;
}

function translateY(offsetPx: number): string {
  return `translateY(${offsetPx}px)`;
}

// Hides the bottom `amount` (a length or a percentage) of the rows.
function clipBottom(amount: string): string {
  return `inset(0 0 ${amount} 0)`;
}

// How much of a list growing to `toHeight` is still to be revealed: the
// part below what was drawn, and never the input's own part.
function hiddenBelow(fromHeight: number, toHeight: number, anchorHeight: number): number {
  return Math.max(0, Math.min(toHeight - anchorHeight, toHeight - fromHeight));
}

function readMotionHeight(surface: HTMLElement): number {
  return Number.parseFloat(surface.style.getPropertyValue(SUGGESTIONS_MOTION_HEIGHT_PROPERTY)) || 0;
}

function isMotionAllowed(win: Window, doc: Document): boolean {
  if (doc.documentElement.getAttribute(MOTION_EFFECTS_ATTRIBUTE) === 'off') {
    return false;
  }
  return !(typeof win.matchMedia === 'function' && win.matchMedia(REDUCED_MOTION_QUERY).matches);
}

function hasAnimatableLayers(layers: SuggestionsMotionLayers): layers is AnimatableLayers {
  return typeof layers.content.animate === 'function' &&
    Boolean(layers.surface && typeof layers.surface.animate === 'function') &&
    Boolean(layers.outline && typeof layers.outline.animate === 'function');
}

// Plays an animation again from its start with new keyframes and timing.
function restart(animation: Animation, keyframes: Keyframe[], timing: MotionTiming): void {
  if (!(animation.effect instanceof KeyframeEffect)) {
    return;
  }
  animation.effect.setKeyframes(keyframes);
  animation.effect.updateTiming(timing);
  animation.currentTime = 0;
}

function createSuggestionsMotion(win: Window, doc: Document): SuggestionsMotion {
  // Surface, outline, then content, in that order.
  let running: Animation[] = [];
  let mode: 'visibility' | 'resize' | null = null;
  let stopWatching: (() => void) | null = null;
  // Bumped by every cancel, so a cancelled run's finish does nothing.
  let generation = 0;

  function canPlay(layers: SuggestionsMotionLayers): layers is AnimatableLayers {
    return isMotionAllowed(win, doc) && hasAnimatableLayers(layers);
  }

  function capture(layers: SuggestionsMotionLayers): SuggestionsMotionSnapshot | null {
    if (!running.length || !layers.surface) {
      return null;
    }
    const contentStyle = win.getComputedStyle(layers.content);
    return {
      height: layers.surface.getBoundingClientRect().height,
      contentOpacity: contentStyle.opacity,
      contentTransform: contentStyle.transform === 'none' ? translateY(0) : contentStyle.transform,
      contentClip: contentStyle.clipPath === 'none' ? clipBottom('0%') : contentStyle.clipPath,
      surfaceOpacity: win.getComputedStyle(layers.surface).opacity
    };
  }

  function stopWatchingPreference(): void {
    if (stopWatching) {
      stopWatching();
    }
    stopWatching = null;
  }

  function cancel(): void {
    generation += 1;
    stopWatchingPreference();
    running.forEach((animation) => animation.cancel());
    running = [];
    mode = null;
  }

  function finish(): void {
    stopWatchingPreference();
    running = [];
    mode = null;
  }

  function finishWith(animation: Animation): void {
    const runGeneration = generation;
    animation.onfinish = () => {
      if (generation === runGeneration) {
        finish();
      }
    };
  }

  // The motion preference can change while the list moves, so listen for
  // as long as an animation plays.
  function watchMotionPreference(layers: SuggestionsMotionLayers): void {
    const media = typeof win.matchMedia === 'function' ? win.matchMedia(REDUCED_MOTION_QUERY) : null;
    const onChange = () => {
      if (!canPlay(layers)) {
        cancel();
      }
    };
    if (media && typeof media.addEventListener === 'function') {
      media.addEventListener('change', onChange);
    }
    const observer = typeof MutationObserver === 'function' ? new MutationObserver(onChange) : null;
    if (observer) {
      observer.observe(doc.documentElement, { attributes: true, attributeFilter: [MOTION_EFFECTS_ATTRIBUTE] });
    }
    stopWatching = () => {
      if (media && typeof media.removeEventListener === 'function') {
        media.removeEventListener('change', onChange);
      }
      if (observer) {
        observer.disconnect();
      }
    };
  }

  function play(
    open: boolean,
    layers: SuggestionsMotionLayers,
    collapsedHeight: number,
    previous: SuggestionsMotionSnapshot | null
  ): void {
    cancel();
    if (!canPlay(layers) || collapsedHeight <= 0) {
      return;
    }
    mode = 'visibility';
    try {
      const timing = open ? OPEN_TIMING : CLOSE_TIMING;
      const openHeight = readMotionHeight(layers.surface) || collapsedHeight;
      const fromHeight = previous ? previous.height : (open ? collapsedHeight : openHeight);
      const toHeight = open ? openHeight : collapsedHeight;
      const layering = open ? {} : { zIndex: CLOSING_Z_INDEX };
      [layers.surface, layers.outline].forEach((element) => {
        running.push(element.animate([
          { height: px(fromHeight), opacity: previous?.surfaceOpacity || '1', visibility: 'visible', ...layering },
          { height: px(toHeight), opacity: open ? '1' : '0', visibility: 'visible', ...layering }
        ], timing));
      });
      const content = layers.content.animate([
        {
          opacity: previous?.contentOpacity || (open ? '0' : '1'),
          transform: previous?.contentTransform || translateY(open ? OPEN_CONTENT_OFFSET_PX : 0),
          clipPath: previous?.contentClip || clipBottom(open ? '100%' : '0%'),
          visibility: 'visible'
        },
        {
          opacity: open ? '1' : '0',
          transform: translateY(open ? 0 : CLOSE_CONTENT_OFFSET_PX),
          clipPath: clipBottom(open ? '0%' : '100%'),
          visibility: 'visible'
        }
      ], timing);
      running.push(content);
      finishWith(content);
      watchMotionPreference(layers);
    } catch (_error) {
      // An older engine may reject a keyframe; the list still works unanimated.
      cancel();
    }
  }

  // Retargets an opening list whose height changes on the way, from where it
  // is drawn. Changing the CSS variable its keyframes read would jump to the
  // new end instead.
  function retargetOpening(
    layers: AnimatableLayers,
    fromHeight: number,
    toHeight: number,
    anchorHeight: number
  ): void {
    if (running.length !== 3) {
      return;
    }
    const canRetarget = typeof KeyframeEffect === 'function' &&
      running.every((animation) => animation.effect instanceof KeyframeEffect);
    if (!canRetarget) {
      const previous = capture(layers);
      if (previous) {
        previous.height = fromHeight;
        previous.contentClip = clipBottom(px(Math.max(0, toHeight - fromHeight)));
        play(true, layers, anchorHeight, previous);
      }
      return;
    }
    const [surfaceAnimation, outlineAnimation, contentAnimation] = running;
    const contentStyle = win.getComputedStyle(layers.content);
    [surfaceAnimation, outlineAnimation].forEach((animation) => {
      restart(animation, [
        { height: px(fromHeight), opacity: '1', visibility: 'visible' },
        { height: px(toHeight), opacity: '1', visibility: 'visible' }
      ], RESIZE_TIMING);
    });
    restart(contentAnimation, [
      {
        opacity: contentStyle.opacity,
        transform: contentStyle.transform === 'none' ? translateY(0) : contentStyle.transform,
        clipPath: clipBottom(px(hiddenBelow(fromHeight, toHeight, anchorHeight))),
        visibility: 'visible'
      },
      { opacity: '1', transform: translateY(0), clipPath: clipBottom('0px'), visibility: 'visible' }
    ], RESIZE_TIMING);
  }

  // A new batch of results can change the list's height. The rows already
  // shown stay put, and only the space added below them is revealed.
  function resize(layers: SuggestionsMotionLayers, fromHeight: number, toHeight: number, anchorHeight: number): void {
    if (!canPlay(layers) || fromHeight <= 0 || toHeight <= 0) {
      return;
    }
    if (mode === 'visibility') {
      try {
        retargetOpening(layers, fromHeight, toHeight, anchorHeight);
      } catch (_error) {
        cancel();
      }
      return;
    }
    if (Math.abs(toHeight - fromHeight) < MIN_RESIZE_PX) {
      cancel();
      return;
    }
    const startHeight = capture(layers)?.height || fromHeight;
    cancel();
    mode = 'resize';
    try {
      [layers.surface, layers.outline].forEach((element) => {
        running.push(element.animate([{ height: px(startHeight) }, { height: px(toHeight) }], RESIZE_TIMING));
      });
      if (toHeight > startHeight) {
        running.push(layers.content.animate([
          { clipPath: clipBottom(px(hiddenBelow(startHeight, toHeight, anchorHeight))) },
          { clipPath: clipBottom('0%') }
        ], RESIZE_TIMING));
      }
      const last = running[running.length - 1];
      if (last) {
        finishWith(last);
        watchMotionPreference(layers);
      }
    } catch (_error) {
      cancel();
    }
  }

  return { capture, cancel, play, resize };
}

export type { SuggestionsMotion, SuggestionsMotionLayers, SuggestionsMotionSnapshot };
export { createSuggestionsMotion, SUGGESTIONS_MOTION_HEIGHT_PROPERTY };
