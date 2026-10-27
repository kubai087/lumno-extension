// The demo cursor carries across some forward slide changes: where it stood
// on the old slide is where it starts on the new one.
import { getHtmlElement } from '../../shared/dom-lookup';
import * as MODEL from '../onboarding-content';
import type { OnboardingBlueprint, OnboardingState } from '../onboarding-content';

function clearCursorTransitionStart(root: HTMLElement): void {
  root.style.removeProperty('--onboarding-cursor-transition-left');
  root.style.removeProperty('--onboarding-cursor-transition-top');
  root.style.removeProperty('--onboarding-cursor-transition-transform');
}

function captureCursorTransitionStart(root: HTMLElement, blueprint: OnboardingBlueprint, state: OnboardingState, nextState: OnboardingState): void {
  const cursorLayer = getHtmlElement(root.ownerDocument, 'onboarding-cursor-layer');
  if (!cursorLayer) {
    clearCursorTransitionStart(root);
    return;
  }
  const currentSlide = MODEL.getSlideByIndex(blueprint, state.index);
  const nextSlide = MODEL.getSlideByIndex(blueprint, nextState.index);
  const shouldCapture =
    currentSlide &&
    nextSlide &&
    (
      (currentSlide.id === 'intro' && nextSlide.id === 'setup') ||
      (currentSlide.id === 'setup' && nextSlide.id === 'search') ||
      (currentSlide.id === 'search' && nextSlide.id === 'newtab') ||
      (currentSlide.id === 'newtab' && nextSlide.id === 'finish')
    ) &&
    nextState.direction === 'forward';
  if (!shouldCapture) {
    clearCursorTransitionStart(root);
    return;
  }
  const cursor = cursorLayer.querySelector('.demo-cursor');
  if (!cursor) {
    clearCursorTransitionStart(root);
    return;
  }
  const style = getComputedStyle(cursor);
  const leftPx = Number.parseFloat(style.left);
  const topPx = Number.parseFloat(style.top);
  const layerWidth = cursorLayer.clientWidth;
  const layerHeight = cursorLayer.clientHeight;
  if (!Number.isFinite(leftPx) || !Number.isFinite(topPx) || !layerWidth || !layerHeight) {
    clearCursorTransitionStart(root);
    return;
  }
  const left = (leftPx / layerWidth) * 100;
  const top = (topPx / layerHeight) * 100;
  const transform = String(style.transform || '').trim();
  root.style.setProperty('--onboarding-cursor-transition-left', `${Math.max(0, Math.min(100, left)).toFixed(2)}%`);
  root.style.setProperty('--onboarding-cursor-transition-top', `${Math.max(0, Math.min(100, top)).toFixed(2)}%`);
  if (transform && transform !== 'none') {
    root.style.setProperty('--onboarding-cursor-transition-transform', transform);
  } else {
    root.style.removeProperty('--onboarding-cursor-transition-transform');
  }
}

export { captureCursorTransitionStart };
